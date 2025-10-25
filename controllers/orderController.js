const mongoose = require("mongoose");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Item = require("../models/Item");

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res) => {
  try {
    console.log("Received order request:", {
      body: req.body,
      user: req.user,
      headers: req.headers,
    });

    // Check if user is authenticated
    console.log("User from auth middleware:", req.user);

    if (!req.user || !req.user.id) {
      console.error("User not authenticated or missing user ID");
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Ensure user ID is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      console.error("Invalid user ID format:", req.user.id);
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const {
      orderItems,
      shippingAddress,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
    } = req.body;

    // Validate required fields
    if (
      !shippingAddress ||
      !shippingAddress.firstName ||
      !shippingAddress.lastName ||
      !shippingAddress.email
    ) {
      return res
        .status(400)
        .json({ message: "Shipping information is incomplete" });
    }
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      console.error("No order items or invalid order items array:", orderItems);
      return res
        .status(400)
        .json({ message: "No order items or invalid order items format" });
    }

    console.log("Processing order items:", orderItems);

    console.log("Processing order items:", JSON.stringify(orderItems, null, 2));

    // Verify items are in stock and get their current details
    const items = await Promise.all(
      orderItems.map(async (item) => {
        try {
          console.log("Processing order item:", JSON.stringify(item, null, 2));

          if (!item.item) {
            throw new Error("Item ID is missing in order item");
          }

          const dbItem = await Item.findById(item.item);
          if (!dbItem) {
            throw new Error(`Product ${item.item} not found`);
          }

          const quantity = Number(item.quantity) || 1;
          if (isNaN(quantity) || quantity < 1) {
            throw new Error(`Invalid quantity: ${item.quantity}`);
          }

          if (dbItem.quantity < quantity) {
            throw new Error(
              `Not enough stock for ${dbItem.name}. Only ${dbItem.quantity} available`
            );
          }

          const processedItem = {
            item: item.item, // Just the ID
            name: item.name || dbItem.name,
            quantity: quantity,
            price: Number(item.price) || Number(dbItem.price) || 0,
            imageUrl:
              item.imageUrl ||
              (Array.isArray(dbItem.imageUrl)
                ? dbItem.imageUrl[0]
                : dbItem.imageUrl) ||
              "",
          };

          console.log(
            "Processed order item:",
            JSON.stringify(processedItem, null, 2)
          );
          return processedItem;
        } catch (error) {
          console.error("Error processing order item:", error);
          throw new Error(`Error with item ${item.item}: ${error.message}`);
        }
      })
    );

    // Create order with all required fields
    const orderData = {
      user: req.user.id, // This is the authenticated user's ID
      orderItems: items,
      shippingAddress,
      itemsPrice: Number(itemsPrice) || 0,
      taxPrice: Number(taxPrice) || 0,
      shippingPrice: Number(shippingPrice) || 0,
      totalPrice: Number(totalPrice) || 0,
      isDelivered: false,
      email: shippingAddress?.email || req.body.email, // Ensure we have an email
    };

    console.log(
      "Creating order with data:",
      JSON.stringify(orderData, null, 2)
    );

    console.log(
      "Creating order with data:",
      JSON.stringify(orderData, null, 2)
    );

    const order = new Order(orderData);
    let createdOrder;

    try {
      // Save order (this will trigger pre-save to calculate totals)
      createdOrder = await order.save();
      console.log("Order created successfully:", createdOrder);
    } catch (saveError) {
      console.error("Error saving order:", {
        message: saveError.message,
        errors: saveError.errors,
        stack: saveError.stack,
      });
      throw saveError;
    }

    // Update inventory quantities
    await Promise.all(
      orderItems.map((item) =>
        Item.updateOne(
          { _id: item.item },
          { $inc: { quantity: -item.quantity } }
        )
      )
    );

    // Clear the user's cart
    await Cart.findOneAndUpdate(
      { user: req.user.id },
      { $set: { items: [], total: 0 } }
    );

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      message: error.message || "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "user",
      "name email"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if user is authorized to view this order
    if (
      order.user._id.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res
        .status(401)
        .json({ message: "Not authorized to view this order" });
    }

    res.json(order);
  } catch (error) {
    console.error("Error getting order:", error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private/Admin
exports.updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order is already paid
    if (order.isPaid) {
      return res.status(400).json({
        success: false,
        message: "Order is already paid",
      });
    }

    // Update order status
    order.isPaid = true;
    order.paidAt = Date.now();

    // Add payment result
    order.paymentResult = {
      id: req.body.id || "manual",
      status: "completed",
      update_time: new Date().toISOString(),
      email_address: req.body.email || req.user.email,
    };

    const updatedOrder = await order.save();

    res.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Error updating order to paid:", error);
    res.status(500).json({
      success: false,
      message: "Error updating order",
      error: error.message,
    });
  }
};

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
exports.updateOrderToDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.isDelivered = true;
    order.deliveredAt = Date.now();

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order to delivered:", error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, ...updateData } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Reset all status flags
    order.isPaid = false;
    order.isShipped = false;
    order.isDelivered = false;
    order.isCancelled = false;

    // Update status and corresponding fields based on the provided status
    switch (status) {
      case 'processing':
        order.status = 'processing';
        break;
      case 'paid':
        order.status = 'processing';
        order.isPaid = true;
        order.paidAt = updateData.paidAt || Date.now();
        if (updateData.paymentResult) {
          order.paymentResult = updateData.paymentResult;
        }
        if (updateData.paymentMethod) {
          order.paymentMethod = updateData.paymentMethod;
        }
        break;
      case 'shipped':
        order.status = 'shipped';
        order.isShipped = true;
        order.shippedAt = updateData.shippedAt || Date.now();
        break;
      case 'delivered':
        order.status = 'delivered';
        order.isDelivered = true;
        order.deliveredAt = updateData.deliveredAt || Date.now();
        break;
      case 'cancelled':
        order.status = 'cancelled';
        order.isCancelled = true;
        order.cancelledAt = updateData.cancelledAt || Date.now();
        order.cancellationReason = updateData.cancellationReason || '';
        break;
      case 'refunded':
        order.status = 'refunded';
        order.refundedAt = updateData.refundedAt || Date.now();
        order.refundReason = updateData.refundReason || '';
        break;
      default:
        return res.status(400).json({ message: 'Invalid status' });
    }

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(orders);
  } catch (error) {
    console.error("Error getting user orders:", error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate("user", "id name")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Error getting all orders:", error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
