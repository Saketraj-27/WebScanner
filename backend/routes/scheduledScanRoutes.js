const router = require("express").Router();
const {
  getScheduledScans,
  createScheduledScan,
  updateScheduledScan,
  deleteScheduledScan,
  getScheduledScan,
  triggerScheduledScan,
} = require("../controllers/scheduledScanController");
const { authenticate } = require("../middleware/auth");

// All scheduled scan routes require authentication
router.use(authenticate);

router.get("/", getScheduledScans);
router.post("/", createScheduledScan);
router.get("/:id", getScheduledScan);
router.put("/:id", updateScheduledScan);
router.delete("/:id", deleteScheduledScan);
router.post("/:id/trigger", triggerScheduledScan);

module.exports = router;
