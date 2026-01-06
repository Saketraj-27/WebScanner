const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Team = require('../models/Team');
const User = require('../models/User');

describe('Team API', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Ensure we're connected to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/xss_guard_db');
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await Team.deleteMany({});
    await User.deleteMany({});

    // Register and login to get token for each test
    const userData = {
      name: 'Team Test User',
      email: 'team-test@example.com',
      password: 'password123'
    };

    await request(app)
      .post('/api/auth/register')
      .send(userData);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });

    authToken = loginResponse.body.token;
    userId = loginResponse.body.user._id;
  });

  describe('POST /api/teams', () => {
    let authToken;
    let userId;

    beforeEach(async () => {
      // Register and login to get token for each test
      const userData = {
        name: 'Team Test User',
        email: 'team-test@example.com',
        password: 'password123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      authToken = loginResponse.body.token;
      userId = loginResponse.body.user._id;
    });

    it('should create a new team successfully', async () => {
      const teamData = {
        name: 'Test Security Team',
        description: 'A team for testing security features'
      };

      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(teamData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('name', teamData.name);
      expect(response.body).toHaveProperty('description', teamData.description);
      expect(response.body).toHaveProperty('owner');
      expect(response.body).toHaveProperty('members');
      expect(response.body.members).toHaveLength(1); // Owner is added as member
    });

    it('should validate required fields', async () => {
      const invalidTeamData = {
        description: 'Missing name field'
      };

      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTeamData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/teams', () => {
    let authToken;

    beforeEach(async () => {
      // Register and login to get token for each test
      const userData = {
        name: 'Team Test User',
        email: 'team-test@example.com',
        password: 'password123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      authToken = loginResponse.body.token;

      // Create a team for the user
      const teamData = {
        name: 'Test Team',
        description: 'A test team'
      };

      await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(teamData);
    });

    it('should get user teams', async () => {
      const response = await request(app)
        .get('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);

      const team = response.body[0];
      expect(team).toHaveProperty('name');
      expect(team).toHaveProperty('owner');
      expect(team).toHaveProperty('members');
    });
  });

  describe('Team member management', () => {
    let teamId;
    let memberUserId;
    let memberAuthToken;
    let ownerAuthToken;

    beforeEach(async () => {
      // Register and login as team owner
      const ownerUserData = {
        name: 'Team Owner',
        email: 'owner@example.com',
        password: 'password123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(ownerUserData);

      const ownerLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: ownerUserData.email,
          password: ownerUserData.password
        });

      ownerAuthToken = ownerLoginResponse.body.token;

      // Create a team for member management tests
      const teamData = {
        name: 'Member Management Team',
        description: 'Team for member management testing'
      };

      const createResponse = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${ownerAuthToken}`)
        .send(teamData);

      teamId = createResponse.body._id;

      // Create another user to add as member
      const memberUserData = {
        name: 'Team Member',
        email: 'member@example.com',
        password: 'password123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(memberUserData);

      const memberLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: memberUserData.email,
          password: memberUserData.password
        });

      memberUserId = memberLoginResponse.body.user._id;
      memberAuthToken = memberLoginResponse.body.token;
    });

    it('should add member to team', async () => {
      const memberData = {
        email: 'member@example.com',
        role: 'member'
      };

      const response = await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${ownerAuthToken}`)
        .send(memberData)
        .expect(200);

      expect(response.body).toHaveProperty('members');
      expect(response.body.members.length).toBe(2); // Owner + new member
    });

    it('should get team members', async () => {
      // First add a member
      const memberData = {
        email: 'member@example.com',
        role: 'member'
      };

      await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${ownerAuthToken}`)
        .send(memberData);

      const response = await request(app)
        .get(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${ownerAuthToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    it('should update member role', async () => {
      // First add a member
      const memberData = {
        email: 'member@example.com',
        role: 'member'
      };

      await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${ownerAuthToken}`)
        .send(memberData);

      const roleData = {
        role: 'admin'
      };

      const response = await request(app)
        .put(`/api/teams/${teamId}/members/${memberUserId}/role`)
        .set('Authorization', `Bearer ${ownerAuthToken}`)
        .send(roleData)
        .expect(200);

      const updatedMember = response.body.members.find(m => m.user.toString() === memberUserId);
      expect(updatedMember.role).toBe('admin');
    });

    it('should remove member from team', async () => {
      // First add a member
      const memberData = {
        email: 'member@example.com',
        role: 'member'
      };

      await request(app)
        .post(`/api/teams/${teamId}/members`)
        .set('Authorization', `Bearer ${ownerAuthToken}`)
        .send(memberData);

      const response = await request(app)
        .delete(`/api/teams/${teamId}/members/${memberUserId}`)
        .set('Authorization', `Bearer ${ownerAuthToken}`)
        .expect(200);

      expect(response.body.members.length).toBe(1); // Only owner left
    });
  });

  describe('Team CRUD operations', () => {
    let teamId;

    beforeEach(async () => {
      // Create a team for testing
      const teamData = {
        name: 'CRUD Test Team',
        description: 'Team for CRUD testing'
      };

      const createResponse = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(teamData);

      teamId = createResponse.body._id;
    });

    it('should get specific team', async () => {
      const response = await request(app)
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('_id', teamId);
      expect(response.body).toHaveProperty('name', 'CRUD Test Team');
    });

    it('should update team', async () => {
      const updateData = {
        name: 'Updated Team Name',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
      expect(response.body.description).toBe(updateData.description);
    });

    it('should delete team', async () => {
      await request(app)
        .delete(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify team is deleted
      await request(app)
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
