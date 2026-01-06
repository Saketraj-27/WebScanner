const ScanResult = require("../models/ScanResult");
const Baseline = require("../models/Baseline");
const { addScanJob, getJobStatus, getQueueStatus } = require("../queues/scanQueue");

exports.scan = async (req, res) => {
  try {
    const { url, useBrowser = false, priority = 0 } = req.body; // Disable dynamic testing by default for faster scans
    const userId = req.user ? req.user.id : null; // For authenticated users

    // Validate URL
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: "Invalid URL provided" });
    }

    // Add audit logging
    if (req.user) {
      console.log(`User ${req.user.id} (${req.user.email}) initiated scan for URL: ${url}`);
    } else {
      console.log(`Anonymous user initiated scan for URL: ${url}`);
    }

    // Prepare audit log data
    const auditLog = {
      initiatedBy: userId,
      initiatedAt: new Date(),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress,
    };

    // Add scan job to queue
    console.log(`[SCAN CONTROLLER] Adding scan job to queue for URL: ${url}`);
    const job = await addScanJob(url, userId, { useBrowser, auditLog, priority });

    res.json({
      jobId: job.id,
      status: 'queued',
      message: 'Scan job queued successfully',
    });

  } catch (error) {
    console.error('Error queuing scan job:', error);
    res.status(500).json({ error: 'Failed to queue scan job' });
  }
};

exports.getScanStatus = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({ error: "Job ID is required" });
    }

    const jobStatus = await getJobStatus(jobId);

    if (!jobStatus) {
      return res.status(404).json({ error: "Job not found" });
    }

    // If job is completed, return the scan result
    if (jobStatus.state === 'completed') {
      const scanResult = await ScanResult.findById(jobStatus.returnvalue.scanId);
      if (scanResult) {
        return res.json({
          jobId,
          status: 'completed',
          result: scanResult,
          duration: jobStatus.returnvalue.duration,
        });
      }
    }

    res.json({
      jobId,
      status: jobStatus.state,
      progress: jobStatus.progress,
      data: jobStatus.data,
    });

  } catch (error) {
    console.error('Error getting scan status:', error);
    res.status(500).json({ error: 'Failed to get scan status' });
  }
};

exports.getQueueStatus = async (req, res) => {
  try {
    const status = await getQueueStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
};

exports.history = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Filter by user if authenticated
    const filter = req.user ? { userId: req.user.id } : {};

    const scans = await ScanResult.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'username email');

    const total = await ScanResult.countDocuments(filter);

    res.json({
      scans,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching scan history:', error);
    res.status(500).json({ error: 'Failed to fetch scan history' });
  }
};

exports.getScanDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const scan = await ScanResult.findById(id).populate('userId', 'username email');

    if (!scan) {
      return res.status(404).json({ error: "Scan result not found" });
    }

    // Check ownership if user is authenticated
    if (req.user && scan.userId && scan.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Access denied. You can only view your own scans." });
    }

    // Get baseline for comparison
    const baseline = await Baseline.findOne({ url: scan.url, isActive: true });

    res.json({
      scan,
      baseline,
    });
  } catch (error) {
    console.error('Error fetching scan details:', error);
    res.status(500).json({ error: 'Failed to fetch scan details' });
  }
};

// Helper function to validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

