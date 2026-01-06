const mongoose = require("mongoose");

const scheduledScanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
    match: [/^https?:\/\/.*/, 'URL must start with http:// or https://'],
  },
  schedule: {
    frequency: {
      type: String,
      enum: ['hourly', 'daily', 'weekly', 'monthly', 'custom'],
      required: true,
    },
    cronExpression: {
      type: String,
      required: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
  },
  options: {
    useBrowser: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0,
      min: -10,
      max: 10,
    },
    timeout: {
      type: Number,
      default: 30000,
      min: 5000,
      max: 120000,
    },
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastRun: {
    type: Date,
  },
  nextRun: {
    type: Date,
  },
  runCount: {
    type: Number,
    default: 0,
  },
  successCount: {
    type: Number,
    default: 0,
  },
  failureCount: {
    type: Number,
    default: 0,
  },
  lastResult: {
    scanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScanResult',
    },
    score: Number,
    severity: String,
    completedAt: Date,
  },
  notifications: {
    onFailure: {
      type: Boolean,
      default: true,
    },
    onThreshold: {
      score: {
        type: Number,
        min: 0,
        max: 100,
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient querying
scheduledScanSchema.index({ userId: 1, isActive: 1 });
scheduledScanSchema.index({ nextRun: 1 });

// Pre-save middleware to calculate next run
scheduledScanSchema.pre('save', function(next) {
  if (this.isModified('schedule') || this.isNew) {
    this.calculateNextRun();
  }
  next();
});

// Method to calculate next run time
scheduledScanSchema.methods.calculateNextRun = function() {
  // This is a simplified implementation
  // In production, you'd use a proper cron parser
  const now = new Date();

  switch (this.schedule.frequency) {
    case 'hourly':
      this.nextRun = new Date(now.getTime() + 60 * 60 * 1000);
      break;
    case 'daily':
      this.nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      this.nextRun = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      this.nextRun = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      break;
    case 'custom':
      // For custom cron expressions, you'd need a cron parser library
      // For now, just set to daily as fallback
      this.nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;
    default:
      this.nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
};

// Method to execute the scheduled scan
scheduledScanSchema.methods.execute = async function() {
  const { addScanJob } = require('../queues/scanQueue');

  try {
    const job = await addScanJob(this.url, this.userId, {
      useBrowser: this.options.useBrowser,
      priority: this.options.priority,
      timeout: this.options.timeout,
      scheduledScanId: this._id,
    });

    this.lastRun = new Date();
    this.runCount += 1;
    this.calculateNextRun();
    await this.save();

    return { success: true, jobId: job.id };
  } catch (error) {
    this.failureCount += 1;
    await this.save();
    throw error;
  }
};

// Static method to find due scans
scheduledScanSchema.statics.findDue = function() {
  return this.find({
    isActive: true,
    nextRun: { $lte: new Date() },
  });
};

module.exports = mongoose.model("ScheduledScan", scheduledScanSchema);
