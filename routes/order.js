const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const {
  createOrder,
  getOrderById,
  updateOrderToDelivered,
  getMyOrders,
  getOrders,
  updateOrderToPaid,
  updateOrderStatus,
} = require("../controllers/orderController");

// Apply auth middleware to all order routes
router.use(auth);

// User routes
router.get("/myorders", getMyOrders);
router.get("/:id", getOrderById);
router.post("/", createOrder);

// Admin routes
router.get("/", admin, getOrders);
router.put("/:id/pay", admin, updateOrderToPaid);
router.put("/:id/deliver", admin, updateOrderToDelivered);
router.put("/:id/status", admin, updateOrderStatus);

// Test endpoint to verify database connection and collection access
router.get("/test-db", auth, async (req, res) => {
  try {
    // Check MongoDB connection state
    const dbState = mongoose.connection.readyState;
    const dbName = mongoose.connection.name;
    const dbHost = mongoose.connection.host;
    const dbPort = mongoose.connection.port;

    // Get list of all collections
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const collectionNames = collections.map((c) => c.name);

    // Check if orders collection exists
    const ordersCollectionExists = collectionNames.includes("orders");

    // Get count of documents in orders collection
    let orderCount = 0;
    let sampleOrder = null;

    if (ordersCollectionExists) {
      orderCount = await mongoose.connection.db
        .collection("orders")
        .countDocuments();

      // Get a sample order if any exists
      if (orderCount > 0) {
        sampleOrder = await mongoose.connection.db
          .collection("orders")
          .findOne({});
      }
    }

    res.json({
      status: "success",
      db: {
        state: dbState === 1 ? "connected" : "disconnected",
        name: dbName,
        host: dbHost,
        port: dbPort,
        collections: collectionNames,
        ordersCollection: {
          exists: ordersCollectionExists,
          count: orderCount,
          sample: sampleOrder,
        },
      },
      message: "Database connection test successful",
    });
  } catch (error) {
    console.error("Database test error:", error);
    res.status(500).json({
      status: "error",
      message: "Database test failed",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

module.exports = router;
