const User = require("../models/User");
const ApiKey = require("../models/ApiKey");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "fallback-secret", {
    expiresIn: "7d",
  });
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Create user (password will be hashed by pre-save middleware)
    const user = new User({
      email,
      password,
      name,
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create API key
exports.createApiKey = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, permissions } = req.body;

    // Generate API key
    const apiKey = crypto.randomBytes(32).toString("hex");

    // Hash the API key for storage
    const hashedKey = await bcrypt.hash(apiKey, 10);

    const newApiKey = new ApiKey({
      userId,
      name: name || "Default API Key",
      key: hashedKey,
      permissions: permissions || ["read"],
    });

    await newApiKey.save();

    res.status(201).json({
      message: "API key created successfully",
      apiKey: {
        id: newApiKey._id,
        name: newApiKey.name,
        key: apiKey, // Return the plain key only once
        permissions: newApiKey.permissions,
        createdAt: newApiKey.createdAt,
      },
    });
  } catch (error) {
    console.error("Create API key error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// List API keys
exports.listApiKeys = async (req, res) => {
  try {
    const userId = req.user._id;

    const apiKeys = await ApiKey.find({ userId }).select("-key");

    res.json({ apiKeys });
  } catch (error) {
    console.error("List API keys error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete API key
exports.deleteApiKey = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const apiKey = await ApiKey.findOneAndDelete({
      _id: id,
      userId,
    });

    if (!apiKey) {
      return res.status(404).json({ error: "API key not found" });
    }

    res.json({ message: "API key deleted successfully" });
  } catch (error) {
    console.error("Delete API key error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
