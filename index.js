const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(cors());

// MongoDB URL
const uri = process.env.MONGODB_URI;

// MongoDB client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("Zap-Shift-DB");
    const parcelsCollection = db.collection("parcels");

    // Parcel API
    app.get("/parcels", async (req, res) => {
      try {
        const query = {};
        const { email } = req.query;

        if (email) {
          query.senderEmail = email;
        }

        const cursor = parcelsCollection.find(query);
        const result = await cursor.toArray();
        res.status(201).json({
          success: true,
          message: "Parcel Found successfully.",
          data: result,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({
          success: false,
          message: "Couldn't find any Parcel.",
        });
      }
    });

    app.post("/parcels", async (req, res) => {
      try {
        const parcel = req.body;

        const result = await parcelsCollection.insertOne(parcel);

        res.status(201).json({
          success: true,
          message: "Parcel created successfully.",
          data: result,
        });
      } catch (error) {
        console.error("Parcel creation error:", error);

        res.status(500).json({
          success: false,
          message: "Unable to create parcel at the moment.",
          error: "INTERNAL_SERVER_ERROR", // high-level and safe
        });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

app.get("/", (req, res) => {
  res.send("Zap is Shifting...");
});

app.listen(port, () => {
  console.log(`Example app is listening on port ${port}`);
  run().catch(console.dir);
});
