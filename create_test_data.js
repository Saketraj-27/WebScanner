const mongoose = require('mongoose');
require('dotenv').config();

async function createTestData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/xss_guard_db');
    console.log('Connected to MongoDB');

    // Create a simple test collection and insert a document
    const TestSchema = new mongoose.Schema({
      name: String,
      description: String,
      createdAt: { type: Date, default: Date.now }
    });

    const Test = mongoose.model('Test', TestSchema);

    // Insert test data
    const testDoc = new Test({
      name: 'Test Document',
      description: 'This is a test document to make the scanner database visible in MongoDB Compass'
    });

    await testDoc.save();
    console.log('Test document inserted successfully');

    // List all collections in the database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in database:', collections.map(c => c.name));

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestData();
