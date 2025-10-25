const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Item = require('../models/Item');

// @desc    Get cart
// @route   GET /api/cart
exports.getCart = async (req, res) => {
  try {
    // For simplicity, we'll use a single cart for all users
    // In a real app, you'd want to use session-based or user-specific carts
    let cart = await Cart.findOne({}).populate('items.item');
    
    if (!cart) {
      // Create a new cart with a default user ID
      cart = new Cart({ 
        user: new mongoose.Types.ObjectId('000000000000000000000000'), // Default user ID
        items: [], 
        total: 0 
      });
      await cart.save();
    }
    
    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error getting cart:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/items
exports.addToCart = async (req, res) => {
  const { itemId, quantity = 1 } = req.body;

  try {
    // Get the item to verify it exists and get its price
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check if item is in stock
    if (item.quantity < quantity) {
      return res.status(400).json({ 
        message: `Only ${item.quantity} items available in stock` 
      });
    }

    // Get the first cart (for demo purposes)
    let cart = await Cart.findOne({});

    // If cart doesn't exist, create a new one
    if (!cart) {
      cart = new Cart({
        items: [],
        total: 0
      });
    }

    // Check if item already exists in cart
    const itemIndex = cart.items.findIndex(item => 
      item.item.toString() === itemId
    );

    if (itemIndex > -1) {
      // Update quantity if item exists
      cart.items[itemIndex].quantity += Number(quantity);
    } else {
      // Add new item to cart
      cart.items.push({
        item: itemId,
        quantity: Number(quantity),
        price: item.price,
        name: item.name,
        imageUrl: Array.isArray(item.imageUrl) ? item.imageUrl[0] : item.imageUrl
      });
    }

    // Save the cart (this will trigger the pre-save hook to calculate total)
    await cart.save();
    
    // Populate the item details for the response
    await cart.populate('items.item');
    
    res.status(201).json(cart);
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:itemId
exports.updateCartItem = async (req, res) => {
  const { quantity } = req.body;
  const { itemId } = req.params;

  try {
    // Validate quantity
    if (!quantity || isNaN(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'Please provide a valid quantity' });
    }

    // Find the cart
    const cart = await Cart.findOne({});
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Find the item in the cart
    const itemIndex = cart.items.findIndex(item => 
      item.item.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    // Get the item to check stock
    const item = await Item.findById(itemId);
    if (item.quantity < quantity) {
      return res.status(400).json({ 
        message: `Only ${item.quantity} items available in stock` 
      });
    }

    // Update the quantity
    cart.items[itemIndex].quantity = Number(quantity);
    
    // If quantity is 0, remove the item from cart
    if (cart.items[itemIndex].quantity === 0) {
      cart.items.splice(itemIndex, 1);
    }

    await cart.save();
    await cart.populate('items.item');
    
    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:itemId
exports.removeFromCart = async (req, res) => {
  const { itemId } = req.params;

  try {
    // Find the cart
    const cart = await Cart.findOne({});
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Filter out the item to be removed
    cart.items = cart.items.filter(item => item.item.toString() !== itemId);
    
    await cart.save();
    await cart.populate('items.item');
    
    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({});
    
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Remove all items from cart
    cart.items = [];
    
    await cart.save();
    
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
