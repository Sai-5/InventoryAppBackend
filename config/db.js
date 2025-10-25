const mongoose = require('mongoose');
const connectDB = async (mongoUri) => {
try {
const uri = mongoUri || process.env.MONGO_URI;
if (!uri || typeof uri !== 'string' || !uri.trim()) {
console.error('MONGO_URI is not set. Please define MONGO_URI in your environment or .env file.');
process.exit(1);
}
await mongoose.connect(uri, {
useNewUrlParser: true,
useUnifiedTopology: true
});
console.log('MongoDB connected');
} catch (err) {
console.error(err.message);
process.exit(1);
}
};


module.exports = connectDB;