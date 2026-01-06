const Team = require("../models/Team");
const User = require("../models/User");

exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.find({
      $or: [
        { owner: req.user.id },
        { "members.user": req.user.id }
      ]
    })
    .populate('owner', 'username email')
    .populate('members.user', 'username email');

    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};

exports.createTeam = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const team = await Team.create({
      name,
      description,
      owner: req.user.id,
      members: [{ user: req.user.id, role: 'owner' }]
    });

    await team.populate('owner', 'username email');
    await team.populate('members.user', 'username email');

    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

exports.getTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('owner', 'username email')
      .populate('members.user', 'username email');

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Check if user is owner or member
    const isOwner = team.owner._id.toString() === req.user.id;
    const isMember = team.members.some(m => m.user._id.toString() === req.user.id);

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const { name, description } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Only owner can update team
    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only team owner can update team" });
    }

    team.name = name || team.name;
    team.description = description || team.description;
    await team.save();

    await team.populate('owner', 'username email');
    await team.populate('members.user', 'username email');

    res.json(team);
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Only owner can delete team
    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only team owner can delete team" });
    }

    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: "Team deleted successfully" });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};

exports.addMember = async (req, res) => {
  try {
    const { email, role = 'member' } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Only owner can add members
    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only team owner can add members" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user is already a member
    const existingMember = team.members.find(m => m.user.toString() === user._id.toString());
    if (existingMember) {
      return res.status(400).json({ error: "User is already a member of this team" });
    }

    team.members.push({ user: user._id, role });
    await team.save();

    await team.populate('owner', 'username email');
    await team.populate('members.user', 'username email');

    res.json(team);
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Only owner can remove members
    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only team owner can remove members" });
    }

    // Cannot remove owner
    if (userId === team.owner.toString()) {
      return res.status(400).json({ error: "Cannot remove team owner" });
    }

    team.members = team.members.filter(m => m.user.toString() !== userId);
    await team.save();

    await team.populate('owner', 'username email');
    await team.populate('members.user', 'username email');

    res.json(team);
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

exports.updateMemberRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Only owner can update member roles
    if (team.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only team owner can update member roles" });
    }

    const member = team.members.find(m => m.user.toString() === userId);
    if (!member) {
      return res.status(404).json({ error: "Member not found in team" });
    }

    member.role = role;
    await team.save();

    await team.populate('owner', 'username email');
    await team.populate('members.user', 'username email');

    res.json(team);
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
};

exports.getTeamMembers = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('members.user', 'username email');

    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Check if user is owner or member
    const isOwner = team.owner.toString() === req.user.id;
    const isMember = team.members.some(m => m.user._id.toString() === req.user.id);

    if (!isOwner && !isMember) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(team.members);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
};
