function handleRequestError(err, req, res, logger) {
  logger.error({ err, url: req?.url }, 'Unhandled request error');
  if (!res.headersSent) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
  } else {
    res.end();
  }
}

module.exports = { handleRequestError };
