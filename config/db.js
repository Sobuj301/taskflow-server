const { MongoClient } = require("mongodb");





const client = new MongoClient(uri);

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

async function disconnectFromMongoDB() {
  await client.close();
}

module.exports = {
  connectToMongoDB,
  disconnectFromMongoDB
};