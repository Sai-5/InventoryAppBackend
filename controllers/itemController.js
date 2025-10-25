const Item = require('../models/Item');



exports.createItem = async (req, res) => {
  try {
    console.log('=== CREATE ITEM REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request file:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      filename: req.file.filename
    } : 'No file uploaded');
    console.log('Authenticated user ID:', req.user?.id || 'No user authenticated');
    
    const { name, sku, quantity, price, category, description } = req.body;
    
    // Validate required fields
    const validationErrors = [];
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      validationErrors.push('Name is required and must be a non-empty string');
    }
    
    if (quantity === undefined || quantity === null || isNaN(quantity)) {
      validationErrors.push('Valid quantity is required');
    } else if (Number(quantity) < 0) {
      validationErrors.push('Quantity cannot be negative');
    }
    
    if (price === undefined || price === null || isNaN(price)) {
      validationErrors.push('Valid price is required');
    } else if (Number(price) < 0) {
      validationErrors.push('Price cannot be negative');
    }
    
    if (validationErrors.length > 0) {
      console.error('Validation errors:', validationErrors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    // Process the image URL
    let imageUrl = '';
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
    }
    
    // Create new item
    const newItem = new Item({
      name: name.trim(),
      sku: sku ? sku.trim() : '',
      quantity: Math.max(0, Math.floor(Number(quantity))),
      price: Math.max(0, parseFloat(Number(price).toFixed(2))),
      category: (category && typeof category === 'string') ? category.trim() : 'General',
      description: (description && typeof description === 'string') ? description.trim() : '',
      imageUrl: imageUrl,
      createdBy: req.user?.id || null
    });
    
    console.log('Creating new item with data:', JSON.stringify(newItem, null, 2));
    
    // Save item to database
    const item = await newItem.save();
    
    console.log('Item created successfully:', JSON.stringify(item, null, 2));
    
    // Return success response
    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: item
    });
    
  } catch (err) {
    console.error('Error in createItem:', {
      name: err.name,
      message: err.message,
      code: err.code,
      keyValue: err.keyValue,
      stack: err.stack
    });
    
    // Handle duplicate key error
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      const value = err.keyValue[field];
      return res.status(400).json({
        success: false,
        message: `An item with this ${field} (${value}) already exists`,
        error: 'DUPLICATE_KEY',
        field,
        value
      });
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
        error: 'VALIDATION_ERROR'
      });
    }
    
    // Handle other errors
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while creating the item',
      error: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? {
        message: err.message,
        stack: err.stack
      } : undefined
    });
  }
};


exports.getItems = async (req, res) => {
  try {
    // Get all items without any user filtering
    const items = await Item.find({}).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: items
    });
  } catch (err) {
    console.error('Error in getItems:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};


exports.getItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ 
        success: false, 
        message: 'Item not found' 
      });
    }
    
    res.json({
      success: true,
      data: item
    });
  } catch (err) {
    console.error('Error in getItem:', err);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ 
        success: false,
        message: 'Item not found' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


exports.updateItem = async (req, res) => {
  try {
    const { name, sku, quantity, price, category, description, imageUrl } = req.body;
    
    let item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    
    // No authentication required for updates in this version
    
    // Prepare update object
    const updateFields = {};
    if (name) updateFields.name = name.trim();
    if (sku !== undefined) updateFields.sku = sku;
    if (quantity !== undefined) updateFields.quantity = Number(quantity) || 0;
    if (price !== undefined) updateFields.price = Number(price) || 0;
    if (category !== undefined) updateFields.category = category;
    if (description !== undefined) updateFields.description = description;
    
    // Handle image update if a new image was uploaded
    if (req.file) {
      updateFields.imageUrl = `/uploads/${req.file.filename}`;
    } else if (imageUrl !== undefined) {
      updateFields.imageUrl = imageUrl;
    }
    
    console.log('Updating item with fields:', updateFields);
    
    // Update the item
    item = await Item.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );
    
    // Convert imageUrl to array if it's a string for consistency
    if (item.imageUrl && !Array.isArray(item.imageUrl)) {
      item.imageUrl = [item.imageUrl];
    }
    
    res.json({ 
      success: true, 
      data: item,
      message: 'Item updated successfully' 
    });
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during item update',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}


exports.deleteItem = async (req, res) => {
  try {
    console.log('Delete item request:', {
      params: req.params,
      user: req.user
    });

    const item = await Item.findById(req.params.id);
    
    if (!item) {
      console.log('Item not found with ID:', req.params.id);
      return res.status(404).json({ 
        success: false,
        message: 'Item not found' 
      });
    }

    // No authentication required for deletes in this version

    await item.deleteOne(); // Using deleteOne() instead of remove() as it's the newer syntax
    
    console.log('Item deleted successfully:', req.params.id);
    res.json({ 
      success: true,
      message: 'Item removed successfully' 
    });
    
  } catch (err) {
    console.error('Error in deleteItem:', {
      error: err.message,
      stack: err.stack,
      params: req.params,
      user: req.user
    });
    
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting item',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};