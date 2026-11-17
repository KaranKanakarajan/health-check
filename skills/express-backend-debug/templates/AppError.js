// utils/AppError.js
class AppError extends Error {
  constructor(status, code, message, { hint, details } = {}) {
    super(message);
    Object.assign(this, { status, code, hint, details });
  }
}
module.exports = AppError;
