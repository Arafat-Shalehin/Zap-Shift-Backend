const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_LINK);
const port = process.env.PORT || 3000;
const crypto = require("crypto");

function generateTrackingId() {
  const prefix = "PRCL";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${date}-${random}`;
}

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
    const paymentCollection = db.collection("payments");

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

    app.get("parcels/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await parcelsCollection.findOne(query);
        res.status(201).json({
          message: "Parcel Found Succesfully",
          success: true,
          data: result,
        });
      } catch (error) {
        console.log(error);
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

    // Payment related API(Did not check by running it)
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              product_data: {
                name: paymentInfo.parcelName,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.senderEmail,
        mode: "payment",
        metadata: {
          parcelId: paymentInfo.parcelId,
          parcelName: paymentInfo.parcelName,
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      res.send({ url: session.url });
    });

    // Another way to do the above(did not run this too)
    app.post("/payment-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              product_data: {
                name: paymentInfo.parcelName,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          parcelId: paymentInfo.parcelId,
        },
        customer_email: paymentInfo.senderEmail,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });
      res.send({ url: session.url });
    });

    // Did not check by running it
    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      console.log(sessionId);

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      const transactionId = session.payment_intent;
      const query = { transactionId: transactionId };

      const paymentExist = await paymentCollection.findOne(query);

      if (paymentExist) {
        return res.send({
          message: "Already paid",
          transactionId,
          trackingId: paymentExist.trackingId,
        });
      }

      const trackingId = generateTrackingId();
      if (session.payment_status === "paid") {
        const id = session.metadata.parcelId;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            paymentStatus: "Paid",
            trackingId: trackingId,
          },
        };
        const result = await parcelsCollection.updateOne(query, update);

        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          parcelId: session.metadata.parcelId,
          parcelName: session.metadata.parcelName,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
          trackingId: trackingId,
        };

        if (session.payment_status === "paid") {
          const resultPayment = await paymentCollection.insertOne(payment);
          res.send({
            success: true,
            modifyParcel: result,
            paymentInfo: resultPayment,
            trackingId: trackingId,
            transactionId: session.payment_intent,
          });
        }
      }
      res.send({ success: false });
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
