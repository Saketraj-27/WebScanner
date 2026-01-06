const mongoose = require("mongoose");

module.exports = mongoose.model(
  "Baseline",
  new mongoose.Schema({
    url: String,
    contentHash: String,
    htmlContent: String, // Store full HTML for detailed diff
    scripts: [String],
    iframes: [String],
    inlineScripts: [String],
    metaTags: [mongoose.Schema.Types.Mixed],
    obfuscatedScripts: [String],
    suspiciousPatterns: {
      evalUsage: Boolean,
      documentWrite: Boolean,
      innerHTML: Boolean,
      hiddenIframes: Boolean,
      externalScripts: Number,
    },
    dynamicData: {
      requests: [{ url: String, method: String, resourceType: String }],
      responses: [{ url: String, status: Number, contentType: String }],
      finalURL: String,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  })
);
