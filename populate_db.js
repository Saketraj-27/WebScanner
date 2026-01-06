const { MongoClient } = require('mongodb');

async function populateDatabase() {
  const uri = 'mongodb://localhost:27017/xss_guard_db';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const database = client.db('xss_guard_db');
    const collection = database.collection('test');

    // Insert a test document
    const result = await collection.insertOne({
      name: 'Test Document',
      description: 'This document makes the scanner database visible in MongoDB Compass',
      createdAt: new Date()
    });

    console.log('Document inserted with ID:', result.insertedId);

    // List all collections
    const collections = await database.listCollections().toArray();
    console.log('Collections in scanner database:', collections.map(c => c.name));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

populateDatabase();
