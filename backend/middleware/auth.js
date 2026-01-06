const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiKey = require("../models/ApiKey");

// JWT Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback-secret");
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid or inactive user" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
};

// API Key Authentication middleware
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return res.status(401).json({ error: "API key required" });
    }

    const keyDoc = await ApiKey.findValidKey(apiKey);

    if (!keyDoc) {
      return res.status(401).json({ error: "Invalid or expired API key" });
    }

    req.apiKey = keyDoc;
    req.user = keyDoc.userId;
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// Combined authentication (JWT or API Key)
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateToken(req, res, next);
  } else if (apiKey) {
    return authenticateApiKey(req, res, next);
  } else {
    return res.status(401).json({ error: "Authentication required (Bearer token or API key)" });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
};

// Permission-based authorization for API keys
const authorizeApiKey = (...permissions) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: "API key authentication required" });
    }

    const hasPermission = permissions.some(permission =>
      req.apiKey.hasPermission(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({ error: "Insufficient API key permissions" });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no auth provided)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      await authenticateToken(req, res, () => {});
    } else if (apiKey) {
      await authenticateApiKey(req, res, () => {});
    }
  } catch (error) {
    // Ignore auth errors for optional auth
  }

  next();
};

module.exports = {
  authenticateToken,
  authenticateApiKey,
  authenticate,
  authorize,
  authorizeApiKey,
  optionalAuth,
};
