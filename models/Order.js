const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  imageUrl: String
}, { _id: false });

const shippingAddressSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true, default: 'United States' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderItems: [orderItemSchema],
  shippingAddress: shippingAddressSchema,
  email: {
    type: String,
    required: true,
    match: [/\S+@\S+\.\S+/, 'Please enter a valid email address']
  },
  itemsPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  taxPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paidAt: {
    type: Date
  },
  isShipped: {
    type: Boolean,
    default: false
  },
  shippedAt: {
    type: Date
  },
  isDelivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: {
    type: Date
  },
  isCancelled: {
    type: Boolean,
    default: false
  },
  cancelledAt: {
    type: Date
  },
  paymentMethod: {
    type: String,
    default: 'Stripe' // or 'PayPal', 'Cash on Delivery', etc.
  },
  paymentResult: {
    id: String,
    status: String,
    update_time: String,
    email_address: String
  },
  cancellationReason: {
    type: String,
    default: ''
  },
  refundedAt: {
    type: Date
  },
  refundReason: {
    type: String,
    default: ''
  },
  trackingNumber: {
    type: String,
    default: ''
  },
  carrier: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Calculate total before saving
orderSchema.pre('save', function(next) {
  this.itemsPrice = this.orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  // Default shipping price, you can make this dynamic based on your needs
  this.shippingPrice = this.itemsPrice > 100 ? 0 : 10; // Free shipping over $100
  this.taxPrice = Number((this.itemsPrice * 0.15).toFixed(2)); // 15% tax
  this.totalPrice = Number((this.itemsPrice + this.shippingPrice + this.taxPrice).toFixed(2));
  next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
