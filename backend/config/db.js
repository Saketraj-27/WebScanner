const mongoose = require("mongoose");

module.exports = async () => {
  try {
    console.log("Attempting to connect to MongoDB...");
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/xss_guard_db";
    console.log(`Connecting to: ${mongoUri}`);

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    });

    console.log("MongoDB connected successfully to database: xss_guard_db");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
    throw error;
  }
};
