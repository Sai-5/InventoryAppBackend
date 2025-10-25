const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter with better error handling
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  
  console.log('Received file upload:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size
  });
  
  if (allowedTypes[file.mimetype]) {
    console.log('File type accepted:', file.mimetype);
    cb(null, true);
  } else {
    const error = new Error(`Invalid file type: ${file.mimetype}. Only ${Object.keys(allowedTypes).map(t => t.split('/')[1]).join(', ')} files are allowed.`);
    error.status = 400;
    console.error('File upload rejected:', error.message);
    cb(error, false);
  }
};

// Initialize upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Middleware to handle single file upload
const uploadFile = upload.single('image');

// Middleware to handle file upload and add file path to request
const handleFileUpload = (req, res, next) => {
  console.log('Starting file upload...');
  
  uploadFile(req, res, async (err) => {
    try {
      if (err) {
        console.error('File upload error:', {
          name: err.name,
          message: err.message,
          code: err.code,
          stack: err.stack
        });
        
        let status = 500;
        let message = 'Error processing file upload';
        
        if (err instanceof multer.MulterError) {
          // A Multer error occurred when uploading
          status = 400;
          message = `File upload error: ${err.message}`;
          
          if (err.code === 'LIMIT_FILE_SIZE') {
            message = 'File size too large. Maximum size is 5MB.';
          } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            message = 'Unexpected file field. Please check the field name.';
          }
        } else if (err.status === 400) {
          // Our custom validation error
          status = 400;
          message = err.message;
        }
        
        return res.status(status).json({ 
          success: false, 
          message,
          error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      // Log successful file upload
      if (req.file) {
        console.log('File uploaded successfully:', {
          originalname: req.file.originalname,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype,
          path: req.file.path
        });
        
        // Create a URL for the uploaded file
        const fileUrl = `/uploads/${req.file.filename}`;
        req.body.imageUrl = fileUrl;
        console.log('File URL set to:', fileUrl);
      } else {
        console.log('No file was uploaded');
      }
      
      next();
    } catch (error) {
      console.error('Error in handleFileUpload:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error during file upload',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
};

module.exports = {
  upload,
  handleFileUpload
};
