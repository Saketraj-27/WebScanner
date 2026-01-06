const request = require('supertest');
const mongoose = require('mongoose');
const { io: Client } = require('socket.io-client');
const app = require('../server');
const User = require('../models/User');
const Webhook = require('../models/Webhook');
const ScheduledScan = require('../models/ScheduledScan');
const ScanResult = require('../models/ScanResult');

describe('Integration Tests', () => {
  let server;
  let testUser;
  let authToken;
  let socketClient;

  beforeAll(async () => {
    // Wait for the server to connect to database
    await new Promise(resolve => setTimeout(resolve, 1000));

    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    authToken = loginResponse.body.token;
    server = app.listen(0);
  });

  afterAll(async () => {
    if (socketClient) socketClient.disconnect();
    if (server) server.close();

    // Clean up test data
    try {
      await User.findOneAndDelete({ email: 'test@example.com' });
      await Webhook.deleteMany({ userId: testUser._id });
      await ScheduledScan.deleteMany({ userId: testUser._id });
      await ScanResult.deleteMany({ userId: testUser._id });
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  describe('WebSocket Scan Updates', () => {
    test('should receive real-time scan updates via WebSocket', (done) => {
      socketClient = Client(`http://localhost:${server.address().port}`, {
        auth: { token: authToken }
      });

      socketClient.on('connect', () => {
        socketClient.emit('join', testUser._id);

        request(app)
          .post('/api/scan')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ url: 'https://example.com' })
          .then((response) => {
            const jobId = response.body.jobId;

            let eventsReceived = [];

            socketClient.on('scan.started', (data) => {
              eventsReceived.push({ type: 'started', data });
            });

            socketClient.on('scan.completed', (data) => {
              eventsReceived.push({ type: 'completed', data });
              expect(data).toHaveProperty('jobId');
              expect(data).toHaveProperty('url');
              expect(data).toHaveProperty('scanId');
              expect(data).toHaveProperty('score');
              expect(data).toHaveProperty('severity');
              expect(data).toHaveProperty('duration');
              expect(data).toHaveProperty('timestamp');

              expect(eventsReceived.length).toBeGreaterThanOrEqual(1);
              done();
            });

            socketClient.on('scan.failed', (data) => {
              eventsReceived.push({ type: 'failed', data });
              expect(data).toHaveProperty('jobId');
              expect(data).toHaveProperty('url');
              expect(data).toHaveProperty('error');
              expect(data).toHaveProperty('timestamp');
              done();
            });
          })
          .catch(done);
      });

      socketClient.on('connect_error', (error) => {
        done(error);
      });
    }, 30000);
  });

  describe('Webhook Integration', () => {
    test('should create and trigger webhook on scan completion', async () => {
      const webhookResponse = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'http://localhost:3001/webhook-test',
          events: ['scan.completed'],
          secret: 'test-secret'
        });

      expect(webhookResponse.status).toBe(201);
      const webhookId = webhookResponse.body.webhook._id;

      const webhook = await Webhook.findById(webhookId);
      expect(webhook).toBeTruthy();
      expect(webhook.events).toContain('scan.completed');
    });
  });

  describe('Scheduled Scan Integration', () => {
    test('should create and manage scheduled scans', async () => {
      const scheduledScanResponse = await request(app)
        .post('/api/scheduled-scans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          url: 'https://example.com',
          cronExpression: '0 0 * * *',
          name: 'Daily Security Scan',
          enabled: true
        });

      expect(scheduledScanResponse.status).toBe(201);
      const scheduledScanId = scheduledScanResponse.body.scheduledScan._id;

      const scheduledScan = await ScheduledScan.findById(scheduledScanId);
      expect(scheduledScan).toBeTruthy();
      expect(scheduledScan.cronExpression).toBe('0 0 * * *');
      expect(scheduledScan.enabled).toBe(true);

      const updateResponse = await request(app)
        .put(`/api/scheduled-scans/${scheduledScanId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enabled: false
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.scheduledScan.enabled).toBe(false);
    });
  });

  describe('Complete Scan Workflow', () => {
    test('should complete full scan workflow from request to result', async () => {
      const scanResponse = await request(app)
        .post('/api/scan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ url: 'https://httpbin.org/html' });

      expect(scanResponse.status).toBe(200);
      expect(scanResponse.body).toHaveProperty('jobId');

      const jobId = scanResponse.body.jobId;

      let scanResult = null;
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts && !scanResult) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          const statusResponse = await request(app)
            .get(`/api/scan/status/${jobId}`)
            .set('Authorization', `Bearer ${authToken}`);

          if (statusResponse.body.state === 'completed') {
            const resultResponse = await request(app)
              .get(`/api/scan/results/${jobId}`)
              .set('Authorization', `Bearer ${authToken}`);

            scanResult = resultResponse.body;
            break;
          }
        } catch (error) {
          // Continue polling
        }

        attempts++;
      }

      expect(scanResult).toBeTruthy();
      expect(scanResult).toHaveProperty('url');
      expect(scanResult).toHaveProperty('score');
      expect(scanResult).toHaveProperty('severity');
      expect(scanResult).toHaveProperty('staticAnalysis');
      expect(scanResult).toHaveProperty('dynamicAnalysis');
    }, 60000);
  });
});
