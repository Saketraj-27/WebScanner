const router = require("express").Router();
const {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
} = require("../controllers/webhookController");
const { authenticate } = require("../middleware/auth");

// All webhook routes require authentication
router.use(authenticate);

router.get("/", getWebhooks);
router.post("/", createWebhook);
router.put("/:id", updateWebhook);
router.delete("/:id", deleteWebhook);
router.post("/:id/test", testWebhook);

module.exports = router;
