const router = require("express").Router();
const {
  getTeams,
  createTeam,
  getTeam,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
  updateMemberRole,
  getTeamMembers,
} = require("../controllers/teamController");
const { authenticate } = require("../middleware/auth");

// All team routes require authentication
router.use(authenticate);

router.get("/", getTeams);
router.post("/", createTeam);
router.get("/:id", getTeam);
router.put("/:id", updateTeam);
router.delete("/:id", deleteTeam);

// Member management routes
router.post("/:id/members", addMember);
router.get("/:id/members", getTeamMembers);
router.delete("/:id/members/:userId", removeMember);
router.put("/:id/members/:userId/role", updateMemberRole);

module.exports = router;
