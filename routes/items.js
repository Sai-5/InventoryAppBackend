const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { handleFileUpload } = require('../utils/fileUpload');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Serve uploaded files statically
router.use('/uploads', express.static('uploads'));

// Public routes
router.get('/', itemController.getItems);
router.get('/:id', itemController.getItem);

// Protected routes (require authentication)
router.use(auth);

// Admin-only routes
router.post('/', admin, handleFileUpload, itemController.createItem);
router.put('/:id', admin, handleFileUpload, itemController.updateItem);
router.delete('/:id', admin, itemController.deleteItem);

module.exports = router;