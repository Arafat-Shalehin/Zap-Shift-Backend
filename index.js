const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

        console.log("Query Email:", email);
        console.log("Query Object Before:", query);

        if (email) {
          query.senderEmail = email;
        }

        console.log("Final Query:", query);

        const options = { sort: { createdAt: -1 } };

        const result = await parcelsCollection.find(query, options).toArray();

        console.log("DB Result:", result);

        if (result.length > 0) {
          return res.status(200).json({
            success: true,
            message: "Parcel Found successfully.",
            data: result,
          });
        }

        return res.status(404).json({
          success: false,
          message: "Parcel Not Found.",
        });
      } catch (error) {
        console.log(error);
        return res.status(500).json({
          success: false,
          message: "INTERNAL_SERVER_ERROR",
        });
      }
    });

    app.post("/parcels", async (req, res) => {
      try {
        const parcel = req.body;

        parcel.createdAt = new Date();

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

    app.delete("/parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await parcelsCollection.deleteOne(query);
        res.status(201).json({
          message: "Product has been deleted successfully.",
          success: true,
          data: result,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({
          message: "Couldn't delete the parcel. INTERNAL_SERVER_ERROR",
          success: false,
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
