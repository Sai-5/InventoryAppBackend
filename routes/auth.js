const express = require('express');
const router = express.Router();
const { register, login, getMe, logout } = require('../controllers/authController');
const auth = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.use(auth);
router.get('/me', getMe);
router.post('/logout', logout);

module.exports = router;