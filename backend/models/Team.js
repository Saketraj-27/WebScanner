const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  settings: {
    allowMemberInvites: {
      type: Boolean,
      default: true,
    },
    requireApproval: {
      type: Boolean,
      default: false,
    },
    defaultRole: {
      type: String,
      enum: ['member', 'viewer'],
      default: 'member',
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for efficient querying
teamSchema.index({ owner: 1 });
teamSchema.index({ 'members.user': 1 });
teamSchema.index({ name: 1 });

// Virtual for member count
teamSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Method to add member
teamSchema.methods.addMember = function(userId, role = 'member') {
  if (this.members.some(m => m.user.toString() === userId.toString())) {
    throw new Error('User is already a member of this team');
  }

  this.members.push({
    user: userId,
    role: role,
    joinedAt: new Date(),
  });

  return this.save();
};

// Method to remove member
teamSchema.methods.removeMember = function(userId) {
  const memberIndex = this.members.findIndex(m => m.user.toString() === userId.toString());

  if (memberIndex === -1) {
    throw new Error('User is not a member of this team');
  }

  // Prevent removing owner
  if (this.owner.toString() === userId.toString()) {
    throw new Error('Cannot remove team owner');
  }

  this.members.splice(memberIndex, 1);
  return this.save();
};

// Method to update member role
teamSchema.methods.updateMemberRole = function(userId, newRole) {
  const member = this.members.find(m => m.user.toString() === userId.toString());

  if (!member) {
    throw new Error('User is not a member of this team');
  }

  // Only owner can change roles
  if (this.owner.toString() !== userId.toString()) {
    member.role = newRole;
  }

  return this.save();
};

// Method to check if user is member
teamSchema.methods.isMember = function(userId) {
  return this.members.some(m => m.user.toString() === userId.toString()) ||
         this.owner.toString() === userId.toString();
};

// Method to check user role
teamSchema.methods.getUserRole = function(userId) {
  if (this.owner.toString() === userId.toString()) {
    return 'owner';
  }

  const member = this.members.find(m => m.user.toString() === userId.toString());
  return member ? member.role : null;
};

// Method to check if user can perform action
teamSchema.methods.canUserPerform = function(userId, action) {
  const role = this.getUserRole(userId);

  if (!role) return false;

  const permissions = {
    owner: ['read', 'write', 'delete', 'manage_members', 'manage_settings'],
    admin: ['read', 'write', 'manage_members'],
    member: ['read', 'write'],
    viewer: ['read'],
  };

  return permissions[role]?.includes(action) || false;
};

// Static method to find teams for user
teamSchema.statics.findForUser = function(userId) {
  return this.find({
    $or: [
      { owner: userId },
      { 'members.user': userId },
    ],
    isActive: true,
  }).populate('owner', 'name email')
    .populate('members.user', 'name email');
};

module.exports = mongoose.model("Team", teamSchema);
