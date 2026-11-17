// middleware/errors.js - use: app.use(requestId) first; app.use(notFound); app.use(errorHandler) last
const { randomUUID } = require('crypto');
const AppError = require('../utils/AppError');

// Put FIRST in app.js (before cors) - tags each request so log lines and responses match.
exports.requestId = (req, res, next) => {
  // Accept a client id only if it is short and safe (stops log injection).
  const incoming = req.get('X-Request-Id');
  req.id = /^[\w-]{1,64}$/.test(incoming || '') ? incoming : randomUUID();
  res.set('X-Request-Id', req.id);
  next();
};

// Turn library errors into clear AppErrors.
function normalize(err) {
  if (err instanceof AppError) return err;
  if (err.type === 'entity.parse.failed')
    return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON', { hint: 'Check quotes and commas, and send Content-Type: application/json' });
  if (err.type === 'entity.too.large')
    return new AppError(413, 'BODY_TOO_LARGE', 'Request body is too big', { hint: 'Raise express.json({ limit }) or send less data' });
  if (err.name === 'ValidationError')
    return new AppError(400, 'VALIDATION_FAILED', 'Some fields are missing or wrong', { details: Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message])) });
  if (err.name === 'CastError')
    return new AppError(400, 'INVALID_ID', `"${err.value}" is not a valid ${err.path}`, { hint: 'Ids are 24-character Mongo ObjectIds' });
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return new AppError(409, 'ALREADY_EXISTS', `${field} already exists`, { details: err.keyValue });
  }
  if (err.code === 'P2002') return new AppError(409, 'ALREADY_EXISTS', `${err.meta?.target} already exists`);
  if (err.code === 'P2025') return new AppError(404, 'NOT_FOUND', 'Record not found');
  if (err.name === 'TokenExpiredError')
    return new AppError(401, 'TOKEN_EXPIRED', 'Your login has expired', { hint: 'Log in again to get a new token' });
  if (err.name === 'JsonWebTokenError')
    return new AppError(401, 'TOKEN_INVALID', `Token rejected: ${err.message}`, { hint: 'Send "Authorization: Bearer <token>" and make sure JWT_SECRET is the same one used to sign' });
  if (err.code === 'LIMIT_FILE_SIZE') return new AppError(413, 'FILE_TOO_LARGE', 'Uploaded file is too big');
  return new AppError(500, 'INTERNAL_ERROR', 'Something broke on the server', { hint: 'Find the requestId in the server log for the stack trace' });
}

exports.notFound = (req, res, next) =>
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`, { hint: 'Check the method, the /api prefix, and that the router is mounted in app.js' }));

exports.errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const e = normalize(err);
  // Details + stack only when NODE_ENV is exactly 'development'. Unset = safe (hidden).
  const dev = process.env.NODE_ENV === 'development';
  // One log line per error, tagged with the requestId the client also sees.
  console.error(`[${req.id}] ${req.method} ${req.originalUrl} -> ${e.status} ${e.code}: ${err.message}`);
  if (e.status >= 500) console.error(err.stack);
  res.status(e.status).json({
    success: false,
    message: e.message, // kept at top level so old frontends reading data.message still work
    error: {
      code: e.code,
      // 500s stay generic in production so internals never leak; dev sees the real message + stack.
      message: e.status >= 500 && dev ? err.message : e.message,
      details: e.details,
      hint: e.hint,
      method: req.method,
      path: req.originalUrl,
      requestId: req.id,
      ...(dev && e.status >= 500 && { stack: err.stack.split('\n').slice(0, 6) }),
    },
  });
};
