const Webhook = require("../models/Webhook");

// Get all webhooks for a user
exports.getWebhooks = async (req, res) => {
  try {
    const webhooks = await Webhook.find({
      userId: req.user._id,
      isActive: true,
    }).select('-secret');

    res.json(webhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
};

// Create a new webhook
exports.createWebhook = async (req, res) => {
  try {
    const { name, url, events, headers } = req.body;

    if (!name || !url || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Name, URL, and events are required' });
    }

    // Validate events
    const validEvents = ['scan.completed', 'scan.failed', 'threat.detected', 'baseline.changed'];
    const invalidEvents = events.filter(event => !validEvents.includes(event));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        error: `Invalid events: ${invalidEvents.join(', ')}`
      });
    }

    const webhook = await Webhook.create({
      name,
      url,
      events,
      userId: req.user._id,
      headers: headers || {},
    });

    // Return webhook without secret
    const webhookResponse = webhook.toObject();
    delete webhookResponse.secret;

    res.status(201).json(webhookResponse);
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
};

// Update a webhook
exports.updateWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, events, headers, isActive } = req.body;

    const webhook = await Webhook.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Update fields
    if (name) webhook.name = name;
    if (url) webhook.url = url;
    if (events && Array.isArray(events)) webhook.events = events;
    if (headers) webhook.headers = headers;
    if (typeof isActive === 'boolean') webhook.isActive = isActive;

    webhook.updatedAt = new Date();
    await webhook.save();

    // Return webhook without secret
    const webhookResponse = webhook.toObject();
    delete webhookResponse.secret;

    res.json(webhookResponse);
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
};

// Delete a webhook
exports.deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;

    const webhook = await Webhook.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
};

// Test a webhook
exports.testWebhook = async (req, res) => {
  try {
    const { id } = req.params;

    const webhook = await Webhook.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Trigger test event
    await webhook.trigger('test', {
      message: 'This is a test webhook from XSS Guard',
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Test webhook sent successfully' });
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
};
