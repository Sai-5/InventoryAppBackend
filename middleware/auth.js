const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Authentication middleware to verify JWT token
 * Adds user info to req.user if token is valid
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header (support both x-auth-token and Authorization: Bearer)
    let token = req.header('x-auth-token');
    
    // If no x-auth-token, check Authorization header
    if (!token) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' from the beginning
      }
    }
    
    // Check if no token was found
    if (!token) {
      throw new UnauthorizedError('No authentication token, authorization denied');
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Debug logging
      console.log('Decoded token:', decoded);
      
      // Handle different token payload structures
      if (decoded.user && decoded.user.id) {
        // New format: { user: { id, role } }
        req.user = {
          id: decoded.user.id,
          role: decoded.user.role || 'user'
        };
      } else if (decoded.id) {
        // Legacy format: { id, role }
        req.user = {
          id: decoded.id,
          role: decoded.role || 'user'
        };
      } else {
        throw new Error('Invalid token payload');
      }
      
      console.log('Authenticated user:', req.user);
      next();
    } catch (err) {
      console.error('Token verification error:', err);
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token has expired');
      }
      throw new UnauthorizedError('Token is not valid');
    }
  } catch (err) {
    next(err);
  }
};

module.exports = auth;