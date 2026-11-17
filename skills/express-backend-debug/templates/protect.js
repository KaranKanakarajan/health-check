// middleware/auth.js - router.get('/me', protect, handler)
// Errors go through errorHandler, so 401s use the same JSON shape as every other error.
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

module.exports.protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
    if (!token || token === 'undefined' || token === 'null')
      return next(new AppError(401, 'NO_TOKEN', 'You are not logged in', { hint: 'Send "Authorization: Bearer <token>" or the token cookie' }));

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // throws -> errorHandler maps TokenExpired/JsonWebTokenError
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new AppError(401, 'USER_GONE', 'This account no longer exists', { hint: 'Log in again' }));

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
