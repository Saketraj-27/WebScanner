const ScheduledScan = require("../models/ScheduledScan");
const cron = require("node-cron");

// Get all scheduled scans for a user
exports.getScheduledScans = async (req, res) => {
  try {
    const scans = await ScheduledScan.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    res.json(scans);
  } catch (error) {
    console.error('Error fetching scheduled scans:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled scans' });
  }
};

// Create a new scheduled scan
exports.createScheduledScan = async (req, res) => {
  try {
    const {
      name,
      description,
      url,
      schedule,
      options = {},
      notifications = {}
    } = req.body;

    if (!name || !url || !schedule || !schedule.frequency || !schedule.cronExpression) {
      return res.status(400).json({
        error: 'Name, URL, and schedule (frequency, cronExpression) are required'
      });
    }

    // Validate URL
    if (!isValidUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL provided' });
    }

    const scheduledScan = await ScheduledScan.create({
      name,
      description,
      url,
      schedule,
      options,
      notifications,
      userId: req.user._id,
    });

    res.status(201).json(scheduledScan);
  } catch (error) {
    console.error('Error creating scheduled scan:', error);
    res.status(500).json({ error: 'Failed to create scheduled scan' });
  }
};

// Update a scheduled scan
exports.updateScheduledScan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const scan = await ScheduledScan.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!scan) {
      return res.status(404).json({ error: 'Scheduled scan not found' });
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (key !== 'userId' && key !== '_id') {
        scan[key] = updates[key];
      }
    });

    scan.updatedAt = new Date();
    await scan.save();

    res.json(scan);
  } catch (error) {
    console.error('Error updating scheduled scan:', error);
    res.status(500).json({ error: 'Failed to update scheduled scan' });
  }
};

// Delete a scheduled scan
exports.deleteScheduledScan = async (req, res) => {
  try {
    const { id } = req.params;

    const scan = await ScheduledScan.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!scan) {
      return res.status(404).json({ error: 'Scheduled scan not found' });
    }

    res.json({ message: 'Scheduled scan deleted successfully' });
  } catch (error) {
    console.error('Error deleting scheduled scan:', error);
    res.status(500).json({ error: 'Failed to delete scheduled scan' });
  }
};

// Get a specific scheduled scan
exports.getScheduledScan = async (req, res) => {
  try {
    const { id } = req.params;

    const scan = await ScheduledScan.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!scan) {
      return res.status(404).json({ error: 'Scheduled scan not found' });
    }

    res.json(scan);
  } catch (error) {
    console.error('Error fetching scheduled scan:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled scan' });
  }
};

// Manually trigger a scheduled scan
exports.triggerScheduledScan = async (req, res) => {
  try {
    const { id } = req.params;

    const scan = await ScheduledScan.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!scan) {
      return res.status(404).json({ error: 'Scheduled scan not found' });
    }

    const result = await scan.execute();

    res.json({
      message: 'Scheduled scan triggered successfully',
      jobId: result.jobId,
    });
  } catch (error) {
    console.error('Error triggering scheduled scan:', error);
    res.status(500).json({ error: 'Failed to trigger scheduled scan' });
  }
};

// Initialize scheduled scans (called on server startup)
let cronJobs = new Map();

exports.initializeScheduledScans = async () => {
  try {
    // Clear existing cron jobs
    cronJobs.forEach(job => job.destroy());
    cronJobs.clear();

    // Get all active scheduled scans
    const scans = await ScheduledScan.find({ isActive: true });

    for (const scan of scans) {
      try {
        // For simplicity, we'll use a basic interval approach
        // In production, you'd use a proper cron parser
        const interval = getIntervalFromFrequency(scan.schedule.frequency);

        if (interval) {
          const job = cron.schedule(`*/${interval} * * * *`, async () => {
            try {
              await scan.execute();
              console.log(`Executed scheduled scan: ${scan.name}`);
            } catch (error) {
              console.error(`Failed to execute scheduled scan ${scan.name}:`, error);
            }
          });

          cronJobs.set(scan._id.toString(), job);
        }
      } catch (error) {
        console.error(`Failed to schedule scan ${scan.name}:`, error);
      }
    }

    console.log(`Initialized ${cronJobs.size} scheduled scans`);
  } catch (error) {
    console.error('Error initializing scheduled scans:', error);
  }
};

// Helper function to get interval in minutes from frequency
function getIntervalFromFrequency(frequency) {
  switch (frequency) {
    case 'hourly': return 60;
    case 'daily': return 1440; // 24 * 60
    case 'weekly': return 10080; // 7 * 24 * 60
    case 'monthly': return 43200; // 30 * 24 * 60 (approximate)
    default: return null;
  }
}

// Helper function to validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}
