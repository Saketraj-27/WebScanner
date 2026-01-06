const scanSite = require('../services/scannerService');
const ScanResult = require('../models/ScanResult');
const Baseline = require('../models/Baseline');
const { contentDiff, scriptDiff } = require('../utils/diffEngine');

// Simple in-memory queue for development (fallback when Redis is unavailable)
class SimpleQueue {
  constructor() {
    this.jobs = new Map();
    this.waiting = [];
    this.active = [];
    this.completed = [];
    this.failed = [];
    this.jobId = 1;
    this.processing = false;
  }

  async add(data, options = {}) {
    const job = {
      id: this.jobId++,
      data,
      opts: options,
      progress: () => 0,
      getState: async () => 'waiting',
      finishedOn: null,
      processedOn: null,
    };
    this.jobs.set(job.id, job);
    this.waiting.push(job);

    // Start processing if not already processing
    if (!this.processing) {
      this.startProcessing();
    }

    return job;
  }

  async getJob(jobId) {
    return this.jobs.get(parseInt(jobId)) || null;
  }

  async getWaiting() {
    return this.waiting;
  }

  async getActive() {
    return this.active;
  }

  async getCompleted() {
    return this.completed;
  }

  async getFailed() {
    return this.failed;
  }

  async startProcessing() {
    this.processing = true;
    const MAX_CONCURRENT_JOBS = 3; // Allow up to 3 concurrent jobs

    const processNextJob = async () => {
      if (this.waiting.length === 0) return;

      const job = this.waiting.shift();
      this.active.push(job);

      try {
        job.processedOn = Date.now();
        job.getState = async () => 'active';

        const jobPromise = this.processJob(job);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Job processing timeout after 1 minute')), 60000)
        );

        const result = await Promise.race([jobPromise, timeoutPromise]);

        job.finishedOn = Date.now();
        job.getState = async () => 'completed';
        job.returnvalue = result;

        this.active = this.active.filter(j => j.id !== job.id);
        this.completed.push(job);

        console.log(`Job ${job.id} completed for ${job.data.url}`);
      } catch (error) {
        job.finishedOn = Date.now();
        job.getState = async () => 'failed';
        job.failedReason = error.message;

        this.active = this.active.filter(j => j.id !== job.id);
        this.failed.push(job);

        console.error(`Job ${job.id} failed for ${job.data.url}:`, error.message);
      }

      // Process next job if available and we're still processing
      if (this.processing) {
        setTimeout(processNextJob, 10); // Small delay to prevent stack overflow
      }
    };

    // Start initial batch of concurrent jobs
    const initialJobs = Math.min(MAX_CONCURRENT_JOBS, this.waiting.length);
    for (let i = 0; i < initialJobs; i++) {
      setTimeout(processNextJob, 10 * i); // Stagger the jobs slightly
    }

    // Wait for all jobs to complete
    const checkCompletion = () => {
      if (this.waiting.length === 0 && this.active.length === 0) {
        this.processing = false;
      } else {
        setTimeout(checkCompletion, 100);
      }
    };
    setTimeout(checkCompletion, 100);
  }

  async processJob(job) {
    const { url, userId, options = {} } = job.data;
    const { auditLog } = options;
    const startTime = Date.now();

    try {
      console.log(`Starting scan for ${url}`);

      // Emit job started event
      if (global.io && userId) {
        global.io.to(`user_${userId}`).emit('scan.started', {
          jobId: job.id,
          url,
          timestamp: new Date().toISOString(),
        });
      }
      if (global.io) {
        global.io.to(`scan_${job.id}`).emit('scan.started', {
          jobId: job.id,
          url,
          timestamp: new Date().toISOString(),
        });
      }

      // Perform the scan
      const scanResult = await scanSite(url, options);
      const scanDuration = Date.now() - startTime;

      // For dynamic-only analysis, we skip baseline comparison
      // since we don't have static HTML content to compare
      let baseline = null;
      let diffReport = null;

      // Save scan result with audit logging
      const savedResult = await ScanResult.create({
        url,
        contentHash: scanResult.hash,
        corrupted: scanResult.corrupted,
        score: scanResult.score,
        severity: scanResult.severity,
        reasons: scanResult.reasons,
        threats: scanResult.threats,
        staticAnalysis: {
          scripts: scanResult.staticAnalysis.scripts,
          iframes: scanResult.staticAnalysis.iframes,
          obfuscatedScripts: scanResult.staticAnalysis.obfuscatedScripts,
        },
        dynamicAnalysis: {
          requests: scanResult.dynamicAnalysis.requests,
          responses: scanResult.dynamicAnalysis.responses,
          consoleMessages: scanResult.dynamicAnalysis.consoleMessages,
          networkErrors: scanResult.dynamicAnalysis.networkErrors,
          redirects: scanResult.dynamicAnalysis.redirects,
          domMutations: scanResult.dynamicAnalysis.domMutations ? scanResult.dynamicAnalysis.domMutations.length : 0,
          finalURL: scanResult.dynamicAnalysis.finalURL,
        },
        scanDuration,
        userId,
        auditLog: {
          initiatedBy: userId,
          completedAt: new Date(),
        },
      });

      console.log(`Scan completed for ${url} in ${scanDuration}ms`);

      // Emit job completed event
      if (global.io && userId) {
        global.io.to(`user_${userId}`).emit('scan.completed', {
          jobId: job.id,
          url,
          scanId: savedResult._id,
          score: scanResult.score,
          severity: scanResult.severity,
          duration: scanDuration,
          timestamp: new Date().toISOString(),
        });
      }
      if (global.io) {
        global.io.to(`scan_${job.id}`).emit('scan.completed', {
          jobId: job.id,
          url,
          scanId: savedResult._id,
          score: scanResult.score,
          severity: scanResult.severity,
          duration: scanDuration,
          timestamp: new Date().toISOString(),
        });
        // Emit to public room for unauthenticated users
        global.io.to('public').emit('scan.completed', {
          jobId: job.id,
          url,
          scanId: savedResult._id,
          score: scanResult.score,
          severity: scanResult.severity,
          duration: scanDuration,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        scanId: savedResult._id,
        score: scanResult.score,
        severity: scanResult.severity,
        diffReport,
        duration: scanDuration,
      };

    } catch (error) {
      console.error(`Scan failed for ${url}:`, error);

      // Emit job failed event
      if (global.io && userId) {
        global.io.to(`user_${userId}`).emit('scan.failed', {
          jobId: job.id,
          url,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
      if (global.io) {
        global.io.to(`scan_${job.id}`).emit('scan.failed', {
          jobId: job.id,
          url,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        // Emit to public room for unauthenticated users
        global.io.to('public').emit('scan.failed', {
          jobId: job.id,
          url,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      throw error;
    }
  }

  on(event, callback) {
    // Simple event handling for compatibility
    console.log(`Queue event: ${event}`);
  }

  async close() {
    // Cleanup
    this.jobs.clear();
    this.waiting = [];
    this.active = [];
    this.completed = [];
    this.failed = [];
  }
}

// Initialize queue with Redis check
let scanQueue;
(async () => {
  try {
    const Redis = require('ioredis');
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: false,
      connectTimeout: 2000,
      commandTimeout: 2000,
    });

    // Handle Redis connection errors to prevent unhandled error events
    redis.on('error', (err) => {
      // Suppress Redis connection errors as they are handled in the catch block
    });

    await redis.ping();
    redis.disconnect();

    // Redis is available, use Bull queue
    const Queue = require('bull');
    scanQueue = new Queue('website-scan', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        retryDelayOnFailover: 1000,
        enableReadyCheck: false,
        lazyConnect: false,
      },
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    // Handle Bull queue errors to prevent unhandled error events
    scanQueue.on('error', (err) => {
      console.warn('Bull queue error:', err.message);
    });

    console.log("Using Bull queue with Redis. Job processing is handled by scanQueue.js");

  // Process scan jobs with Bull
  scanQueue.process(async (job) => {
    const { url, userId, options = {} } = job.data;
    const { auditLog } = options;
    const startTime = Date.now();

    try {
      console.log(`Starting scan for ${url}`);

      // Emit job started event
      if (global.io && userId) {
        global.io.to(`user_${userId}`).emit('scan.started', {
          jobId: job.id,
          url,
          timestamp: new Date().toISOString(),
        });
      }
      if (global.io) {
        global.io.to(`scan_${job.id}`).emit('scan.started', {
          jobId: job.id,
          url,
          timestamp: new Date().toISOString(),
        });
        // Emit to public room for unauthenticated users
        global.io.to('public').emit('scan.started', {
          jobId: job.id,
          url,
          timestamp: new Date().toISOString(),
        });
      }

      // Perform the scan with timeout
      const scanPromise = scanSite(url, options);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Scan processing timeout after 1 minute')), 60000)
      );

      const scanResult = await Promise.race([scanPromise, timeoutPromise]);
      const scanDuration = Date.now() - startTime;

      // For dynamic-only analysis, we skip baseline comparison
      // since we don't have static HTML content to compare
      let baseline = null;
      let diffReport = null;

      // Save scan result with audit logging
      const savedResult = await ScanResult.create({
        url,
        contentHash: scanResult.hash,
        corrupted: scanResult.corrupted,
        score: scanResult.score,
        severity: scanResult.severity,
        reasons: scanResult.reasons,
        threats: scanResult.threats,
        staticAnalysis: {
          scripts: scanResult.staticAnalysis.scripts,
          iframes: scanResult.staticAnalysis.iframes,
          obfuscatedScripts: scanResult.staticAnalysis.obfuscatedScripts,
        },
        dynamicAnalysis: {
          requests: scanResult.dynamicAnalysis.requests,
          responses: scanResult.dynamicAnalysis.responses,
          consoleMessages: scanResult.dynamicAnalysis.consoleMessages,
          networkErrors: scanResult.dynamicAnalysis.networkErrors,
          redirects: scanResult.dynamicAnalysis.redirects,
          domMutations: scanResult.dynamicAnalysis.domMutations ? scanResult.dynamicAnalysis.domMutations.length : 0,
          finalURL: scanResult.dynamicAnalysis.finalURL,
        },
        scanDuration,
        userId,
        auditLog: {
          initiatedBy: userId,
          completedAt: new Date(),
        },
      });

      console.log(`Scan completed for ${url} in ${scanDuration}ms`);

      return {
        scanId: savedResult._id,
        score: scanResult.score,
        severity: scanResult.severity,
        diffReport,
        duration: scanDuration,
      };

    } catch (error) {
      console.error(`Scan failed for ${url}:`, error);
      throw error;
    }
  });

  // Enhanced job event handlers with WebSocket emissions
  scanQueue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed for ${job.data.url}`);

    // Emit job completed event
    if (global.io && job.data.userId) {
      global.io.to(`user_${job.data.userId}`).emit('scan.completed', {
        jobId: job.id,
        url: job.data.url,
        scanId: result.scanId,
        score: result.score,
        severity: result.severity,
        duration: result.duration,
        timestamp: new Date().toISOString(),
      });
    }
    if (global.io) {
      global.io.to(`scan_${job.id}`).emit('scan.completed', {
        jobId: job.id,
        url: job.data.url,
        scanId: result.scanId,
        score: result.score,
        severity: result.severity,
        duration: result.duration,
        timestamp: new Date().toISOString(),
      });
      // Emit to public room for unauthenticated users
      global.io.to('public').emit('scan.completed', {
        jobId: job.id,
        url: job.data.url,
        scanId: result.scanId,
        score: result.score,
        severity: result.severity,
        duration: result.duration,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Handle job failure
  scanQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed for ${job.data.url}:`, err.message);

    // Emit job failed event
    if (global.io && job.data.userId) {
      global.io.to(`user_${job.data.userId}`).emit('scan.failed', {
        jobId: job.id,
        url: job.data.url,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
    if (global.io) {
      global.io.to(`scan_${job.id}`).emit('scan.failed', {
        jobId: job.id,
        url: job.data.url,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
      // Emit to public room for unauthenticated users
      global.io.to('public').emit('scan.failed', {
        jobId: job.id,
        url: job.data.url,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Handle job completion
  scanQueue.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed for ${job.data.url}`);
  });

  // Handle job failure
  scanQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed for ${job.data.url}:`, err.message);
  });

  } catch (error) {
    console.warn('Redis not available, using in-memory queue:', error.message);
    scanQueue = new SimpleQueue();
    console.log("Using in-memory SimpleQueue. Jobs will be processed automatically.");
  }
})();



// Add job to queue
const addScanJob = async (url, userId = null, options = {}) => {
  const job = await scanQueue.add({
    url,
    userId,
    options,
  }, {
    priority: options.priority || 0,
    delay: options.delay || 0,
  });

  return job;
};

// Get queue status
const getQueueStatus = async () => {
  const status = {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
  };

  try {
    // Check if it's Bull queue (has Redis) or SimpleQueue
    if (scanQueue.constructor.name === 'Queue') {
      // Bull queue with Redis
      const [waiting, active, completed, failed] = await Promise.all([
        scanQueue.getWaiting().catch(() => []),
        scanQueue.getActive().catch(() => []),
        scanQueue.getCompleted().catch(() => []),
        scanQueue.getFailed().catch(() => []),
      ]);

      status.waiting = waiting.length;
      status.active = active.length;
      status.completed = completed.length;
      status.failed = failed.length;
    } else {
      // SimpleQueue (in-memory fallback)
      status.waiting = scanQueue.waiting.length;
      status.active = scanQueue.active.length;
      status.completed = scanQueue.completed.length;
      status.failed = scanQueue.failed.length;
    }
  } catch (error) {
    console.error('Error getting queue status:', error);
    status.error = 'Queue status unavailable';
  }

  return status;
};

// Get job status
const getJobStatus = async (jobId) => {
  const job = await scanQueue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress();

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    opts: job.opts,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  };
};

module.exports = {
  scanQueue,
  addScanJob,
  getQueueStatus,
  getJobStatus,
};
