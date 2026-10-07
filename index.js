const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;

// Firebase Admin
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

app.use(cors());
app.use(express.json());

// MongoDB (lazy connection)
const uri = `mongodb://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@ac-1p9lgli-shard-00-00.udy85xl.mongodb.net:27017,ac-1p9lgli-shard-00-01.udy85xl.mongodb.net:27017,ac-1p9lgli-shard-00-02.udy85xl.mongodb.net:27017/?ssl=true&replicaSet=atlas-ckgurq-shard-0&authSource=admin&appName=Cluster0`;

const client = new MongoClient(uri);
let collectionPromise;

function getTasksCollection() {
  if (!collectionPromise) {
    collectionPromise = client
      .connect()
      .then(() => client.db("taskDB").collection("tasks"))
      .catch((err) => {
        collectionPromise = undefined; // পরের request-এ আবার চেষ্টা করবে
        throw err;
      });
  }
  return collectionPromise;
}

// Firebase token verify
const verifyFirebaseToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized user" });
  }

  const token = authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized user" });
  }

  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.user = decodedUser;
    next();
  } catch (error) {
    console.log(error);
    res.status(401).send({ message: "unauthorized user" });
  }
};

// Routes
app.get("/", (req, res) => {
  res.send("task flow server");
});

app.post("/tasks", async (req, res) => {
  try {
    const tasksCollection = await getTasksCollection();
    const result = await tasksCollection.insertOne(req.body);
    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "server error" });
  }
});

app.get("/tasks", verifyFirebaseToken, async (req, res) => {
  try {
    const verifyId = req.user.uid;
    const queryId = req.query.userId;

    if (verifyId !== queryId) {
      return res.status(403).send({ message: "forbidden access" });
    }

    const tasksCollection = await getTasksCollection();
    const result = await tasksCollection.find({ userId: queryId }).toArray();
    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "server error" });
  }
});

app.delete("/tasks/:id", async (req, res) => {
  try {
    const tasksCollection = await getTasksCollection();
    const result = await tasksCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(400).send({ message: "invalid task id" });
  }
});

app.patch("/tasks/:id", async (req, res) => {
  try {
    const tasksCollection = await getTasksCollection();
    const filter = { _id: new ObjectId(req.params.id) };
    // frontend যদি { id: {...} } পাঠায় তাহলে সেটা, নইলে পুরো body
    const updateTask = req.body.id ?? req.body;

    const updateDocs = {
      $set: {
        title: updateTask.title,
        description: updateTask.description,
        priority: updateTask.priority,
        status: updateTask.status,
      },
    };

    const result = await tasksCollection.updateOne(filter, updateDocs);
    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(400).send({ message: "invalid task id" });
  }
});

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Task Flow Server is running on port ${port}`);
  });
}

module.exports = app;