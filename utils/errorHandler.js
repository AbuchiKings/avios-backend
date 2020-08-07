function errorHandler(status, message) {
  const err = new Error();
  err.statusCode = status;
  err.status = 'error';
  err.message = message;
  throw err;
}

module.exports = errorHandler;
