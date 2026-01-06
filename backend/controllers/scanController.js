const ScanResult = require("../models/ScanResult");
const Baseline = require("../models/Baseline");
const { addScanJob, getJobStatus, getQueueStatus } = require("../queues/scanQueue");
const PDFDocument = require('pdfkit');

exports.scan = async (req, res) => {
  try {
    const { url, priority = 0, timeout = 30000 } = req.body; // Dynamic analysis always enabled
    const userId = req.user ? req.user.id : null; // For authenticated users

    // Validate URL
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: "Invalid URL provided" });
    }

    // Add audit logging
    if (req.user) {
      console.log(`User ${req.user.id} (${req.user.email}) initiated dynamic scan for URL: ${url}`);
    } else {
      console.log(`Anonymous user initiated dynamic scan for URL: ${url}`);
    }

    // Prepare audit log data
    const auditLog = {
      initiatedBy: userId,
      initiatedAt: new Date(),
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress,
    };

    // Add scan job to queue with dynamic analysis options
    console.log(`[SCAN CONTROLLER] Adding dynamic scan job to queue for URL: ${url}`);
    const job = await addScanJob(url, userId, { timeout, auditLog, priority });

    res.json({
      jobId: job.id,
      status: 'queued',
      message: 'Dynamic scan job queued successfully',
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

    // For authenticated users, show all scans (including anonymous ones)
    // For anonymous users, show all scans
    const filter = {};

    const scans = await ScanResult.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'username email');

    const total = await ScanResult.countDocuments(filter);

    console.log(`Fetching scan history for user ${req.user ? req.user.id : 'anonymous'}: found ${total} scans`);

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

exports.exportPDF = async (req, res) => {
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

    // Create PDF document
    const doc = new PDFDocument();
    const filename = `scan-report-${scan._id}.pdf`;

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add title
    doc.fontSize(20).text('XSS Guard - Scan Report', { align: 'center' });
    doc.moveDown();

    // Basic scan information
    doc.fontSize(14).text('Scan Details');
    doc.fontSize(12);
    doc.text(`URL: ${scan.url}`);
    doc.text(`Status: ${scan.corrupted ? '❌ Corrupted' : '✅ Safe'}`);
    doc.text(`Risk Score: ${scan.score}/100`);
    doc.text(`Severity: ${scan.severity.toUpperCase()}`);
    doc.text(`Scanned At: ${new Date(scan.createdAt).toLocaleString()}`);
    if (scan.userId) {
      doc.text(`User: ${scan.userId.username || scan.userId.email}`);
    }
    doc.moveDown();

    // Risk factors
    if (scan.reasons && scan.reasons.length > 0) {
      doc.fontSize(14).text('Risk Factors');
      doc.fontSize(12);
      scan.reasons.forEach(reason => {
        doc.text(`• ${reason}`);
      });
      doc.moveDown();
    }

    // Dynamic analysis threats
    if (scan.threats && scan.threats.dynamic) {
      doc.fontSize(14).text('Dynamic Analysis Threats');
      doc.fontSize(12);
      const threats = scan.threats.dynamic;
      doc.text(`Redirects: ${threats.redirects ? 'Yes' : 'No'}`);
      doc.text(`DOM Mutations: ${threats.domMutations || 0}`);
      doc.text(`Network Errors: ${threats.networkErrors || 0}`);
      doc.text(`Console Errors: ${threats.consoleErrors || 0}`);
      doc.text(`Dynamic Scripts: ${threats.dynamicScripts || 0}`);
      doc.text(`Dynamic Iframes: ${threats.dynamicIframes || 0}`);
      doc.text(`Total Requests: ${threats.totalRequests || 0}`);
      doc.moveDown();
    }

    // Dynamic analysis details
    if (scan.dynamicAnalysis) {
      doc.fontSize(14).text('Dynamic Analysis Details');
      doc.fontSize(12);
      doc.text(`Final URL: ${scan.dynamicAnalysis.finalURL || scan.url}`);
      doc.text(`Network Requests: ${scan.dynamicAnalysis.requests?.length || 0}`);
      doc.text(`Network Responses: ${scan.dynamicAnalysis.responses?.length || 0}`);

      if (scan.dynamicAnalysis.analysisFailed) {
        doc.text(`Analysis Failed: ${scan.dynamicAnalysis.browserErrors?.join(', ') || 'Unknown error'}`);
      }

      // Console messages
      if (scan.dynamicAnalysis.consoleMessages && scan.dynamicAnalysis.consoleMessages.length > 0) {
        doc.moveDown();
        doc.fontSize(14).text('Browser Console Messages');
        doc.fontSize(12);
        scan.dynamicAnalysis.consoleMessages.slice(0, 20).forEach(msg => {
          doc.text(`${msg.type}: ${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}`);
        });
        if (scan.dynamicAnalysis.consoleMessages.length > 20) {
          doc.text(`... and ${scan.dynamicAnalysis.consoleMessages.length - 20} more messages`);
        }
      }

      // Dynamic scripts
      if (scan.dynamicAnalysis.dynamicScripts && scan.dynamicAnalysis.dynamicScripts.length > 0) {
        doc.moveDown();
        doc.fontSize(14).text('Dynamic Scripts Loaded');
        doc.fontSize(12);
        scan.dynamicAnalysis.dynamicScripts.slice(0, 10).forEach(script => {
          doc.text(script.substring(0, 100) + (script.length > 100 ? '...' : ''));
        });
        if (scan.dynamicAnalysis.dynamicScripts.length > 10) {
          doc.text(`... and ${scan.dynamicAnalysis.dynamicScripts.length - 10} more scripts`);
        }
      }

      // Dynamic iframes
      if (scan.dynamicAnalysis.dynamicIframes && scan.dynamicAnalysis.dynamicIframes.length > 0) {
        doc.moveDown();
        doc.fontSize(14).text('Dynamic Iframes');
        doc.fontSize(12);
        scan.dynamicAnalysis.dynamicIframes.forEach(iframe => {
          doc.text(iframe);
        });
      }
    }

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
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

