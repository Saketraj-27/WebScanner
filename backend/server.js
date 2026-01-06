require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const { fork } = require("child_process");
const connectDB = require("./config/db");
const { initializeScheduledScans } = require("./controllers/scheduledScanController");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    methods: ["GET", "POST"],
  },
});

// Connect to database
(async () => {
  try {
    await connectDB();

    // Fork worker process to handle queue jobs
    const worker = fork('./worker.js');
    console.log('Worker process forked');

    worker.on('message', (message) => {
      console.log('Message from worker:', message);
    });

    worker.on('error', (error) => {
      console.error('Worker error:', error);
    });

    worker.on('exit', (code, signal) => {
      console.log(`Worker exited with code ${code} and signal ${signal}`);
    });

  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }
})();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// API key rate limiting (stricter)
const apiKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // higher limit for API keys
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/scan", require("./routes/scanRoutes"));
app.use("/api/webhooks", require("./routes/webhookRoutes"));
app.use("/api/scheduled-scans", require("./routes/scheduledScanRoutes"));
app.use("/api/teams", require("./routes/teamRoutes"));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Socket.IO for real-time updates
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join user room for personalized updates
  socket.on("join", (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined room`);
    } else {
      // Join public room for unauthenticated users
      socket.join('public');
      console.log(`Anonymous user joined public room`);
    }
  });

  // Handle scan status updates
  socket.on("subscribe-scan", (jobId) => {
    socket.join(`scan_${jobId}`);
    console.log(`Client subscribed to scan ${jobId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Make io available globally for controllers
global.io = io;

// Initialize scheduled scans
initializeScheduledScans();

// Export app for testing
module.exports = app;

// Only start server if this file is run directly, not when required by tests
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}
