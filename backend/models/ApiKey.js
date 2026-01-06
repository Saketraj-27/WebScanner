const mongoose = require("mongoose");
const crypto = require("crypto");

const apiKeySchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  permissions: [{
    type: String,
    enum: ['scan', 'read', 'write', 'admin'],
    default: ['scan', 'read'],
  }],
  rateLimit: {
    requests: {
      type: Number,
      default: 100, // requests per window
    },
    windowMs: {
      type: Number,
      default: 15 * 60 * 1000, // 15 minutes
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastUsed: {
    type: Date,
  },
  expiresAt: {
    type: Date,
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

// Generate API key before saving
apiKeySchema.pre('save', function(next) {
  if (this.isNew && !this.key) {
    this.key = 'sk_' + crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Method to check if key is expired
apiKeySchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

// Method to check permissions
apiKeySchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || this.permissions.includes('admin');
};

// Static method to find valid API key
apiKeySchema.statics.findValidKey = async function(key) {
  const apiKey = await this.findOne({
    key,
    isActive: true,
  }).populate('userId');

  if (!apiKey) return null;

  if (apiKey.isExpired()) {
    await apiKey.updateOne({ isActive: false });
    return null;
  }

  // Update last used
  await apiKey.updateOne({ lastUsed: new Date() });

  return apiKey;
};

module.exports = mongoose.model("ApiKey", apiKeySchema);
