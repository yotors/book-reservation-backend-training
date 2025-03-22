const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

// Connect to the in-memory database before running any tests
beforeAll(async () => {
  jest.setTimeout(30000); // Increase timeout to 30 seconds
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}, 30000); // Also set timeout for beforeAll itself

// Clear all data between every test
afterEach(async () => {
  if (mongoose.connection.readyState === 1) { // Only run if connected
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      await collection.deleteMany();
    }
  }
});

// Remove and close the db and server
afterAll(async () => {
  if (mongoose.connection.readyState === 1) { // Only close if connected
    await mongoose.connection.close();
  }
  if (mongod) {
    await mongod.stop();
  }
}); 