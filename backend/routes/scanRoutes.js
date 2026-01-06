const router = require("express").Router();
const { scan, getScanStatus, getScanDetails, history, getQueueStatus } = require("../controllers/scanController");
const { authenticate, optionalAuth } = require("../middleware/auth");

// Temporarily remove authentication for testing queue status
const getQueueStatusNoAuth = getQueueStatus;
const { ssrfProtection } = require("../middleware/ssrfProtection");

// Temporary route for testing without auth (placed before auth middleware)
router.get("/queue/status/test", getQueueStatusNoAuth);

// Temporarily allow unauthenticated access to scan endpoint for testing
router.post("/", scan);

// Get queue status (public endpoint)
router.get("/queue/status", getQueueStatus);

// All other scan routes require authentication
router.use(authenticate);

// Get scan status by job ID
router.get("/status/:jobId", getScanStatus);

// Get scan result by ID
router.get("/:id", getScanDetails);

// Get scan history
router.get("/", history);

module.exports = router;
