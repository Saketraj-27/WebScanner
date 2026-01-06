const router = require("express").Router();
const {
  register,
  login,
  getProfile,
  updateProfile,
  createApiKey,
  listApiKeys,
  deleteApiKey,
} = require("../controllers/authController");
const { authenticate, authorize } = require("../middleware/auth");

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.use(authenticate); // All routes below require authentication

router.get("/profile", getProfile);
router.put("/profile", updateProfile);

// API key management
router.post("/api-keys", createApiKey);
router.get("/api-keys", listApiKeys);
router.delete("/api-keys/:id", deleteApiKey);

module.exports = router;
