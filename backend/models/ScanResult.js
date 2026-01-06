const mongoose = require("mongoose");

module.exports = mongoose.model(
  "ScanResult",
  new mongoose.Schema({
    url: String,
    contentHash: String,
    corrupted: Boolean,
    score: Number,
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
    reasons: [String],
    threats: {
      static: {
        obfuscatedScripts: { type: Number, default: 0 },
        suspiciousPatterns: [String]
      },
      dynamic: {
        redirects: Boolean,
        domMutations: { type: Number, default: 0 },
        networkErrors: { type: Number, default: 0 }
      }
    },
    staticAnalysis: {
      scripts: [String],
      iframes: [String],
      obfuscatedScripts: [String]
    },
    dynamicAnalysis: {
      requests: [{ url: String, method: String, resourceType: String }],
      responses: [{ url: String, status: Number, contentType: String }],
      consoleMessages: [{ type: String, text: String }],
      networkErrors: [{ url: String, error: String }],
      redirects: Boolean,
      domMutations: { type: Number, default: 0 },
      finalURL: String
    },
    scanDuration: Number, // in milliseconds
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // for authenticated scans
    // Audit logging fields
    auditLog: {
      initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      initiatedAt: { type: Date, default: Date.now },
      userAgent: String,
      ipAddress: String,
      completedAt: Date,
      errorDetails: String,
    },
    createdAt: { type: Date, default: Date.now },
  })
);
