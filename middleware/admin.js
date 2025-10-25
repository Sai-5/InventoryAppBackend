const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

// Middleware to check if user is admin
const admin = (req, res, next) => {
  try {
    // Check if user is authenticated and has admin role
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (req.user.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = admin;
