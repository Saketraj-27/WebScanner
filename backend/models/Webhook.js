const mongoose = require("mongoose");

const webhookSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
    match: [/^https?:\/\/.*/, 'URL must start with http:// or https://'],
  },
  events: [{
    type: String,
    enum: ['scan.completed', 'scan.failed', 'threat.detected', 'baseline.changed'],
    required: true,
  }],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  secret: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  headers: {
    type: Map,
    of: String,
    default: {},
  },
  retryPolicy: {
    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
      max: 10,
    },
    backoffMs: {
      type: Number,
      default: 1000, // 1 second
      min: 100,
      max: 300000, // 5 minutes
    },
  },
  lastTriggered: {
    type: Date,
  },
  failureCount: {
    type: Number,
    default: 0,
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

// Generate secret before saving
webhookSchema.pre('save', function(next) {
  if (this.isNew && !this.secret) {
    this.secret = require('crypto').randomBytes(32).toString('hex');
  }
  next();
});

// Method to trigger webhook
webhookSchema.methods.trigger = async function(event, data) {
  if (!this.isActive) return;

  const axios = require('axios');
  const crypto = require('crypto');

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
    webhookId: this._id,
  };

  // Create signature
  const signature = crypto
    .createHmac('sha256', this.secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-ID': this._id.toString(),
    'User-Agent': 'XSS-Guard-Webhook/1.0',
    ...Object.fromEntries(this.headers),
  };

  let attempt = 0;
  const maxRetries = this.retryPolicy.maxRetries;

  while (attempt <= maxRetries) {
    try {
      await axios.post(this.url, payload, {
        headers,
        timeout: 10000, // 10 seconds
      });

      // Success
      await this.updateOne({
        lastTriggered: new Date(),
        failureCount: 0,
      });

      console.log(`Webhook ${this._id} triggered successfully for event ${event}`);
      return;

    } catch (error) {
      attempt++;
      console.error(`Webhook ${this._id} attempt ${attempt} failed:`, error.message);

      if (attempt <= maxRetries) {
        // Wait before retry
        await new Promise(resolve =>
          setTimeout(resolve, this.retryPolicy.backoffMs * attempt)
        );
      }
    }
  }

  // All retries failed
  await this.updateOne({
    $inc: { failureCount: 1 },
    lastTriggered: new Date(),
  });

  // Deactivate webhook if too many failures
  if (this.failureCount >= 5) {
    await this.updateOne({ isActive: false });
    console.error(`Webhook ${this._id} deactivated due to repeated failures`);
  }
};

module.exports = mongoose.model("Webhook", webhookSchema);
