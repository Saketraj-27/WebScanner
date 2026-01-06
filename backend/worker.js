require("dotenv").config();
const connectDB = require("./config/db");
const { scanQueue } = require("./queues/scanQueue");

// Connect to database
connectDB();

console.log("Scan worker started. Waiting for jobs...");

// Job processing is handled in scanQueue.js, worker just keeps the process alive
if (scanQueue.constructor.name === 'Queue') {
  console.log("Using Bull queue with Redis. Job processing is handled by scanQueue.js");
} else {
  console.log("Using in-memory SimpleQueue. Jobs will be processed automatically.");
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await scanQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await scanQueue.close();
  process.exit(0);
});
