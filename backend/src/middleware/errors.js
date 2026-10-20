function notFound(req, res) {
  res.status(404).json({ error: "Route not found." });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  console.error(error);
  if (error.code === "P2002") {
    return res.status(409).json({ error: "A record with that value already exists." });
  }
  if (error.code === "P2025") {
    return res.status(404).json({ error: "The requested record was not found." });
  }
  return res.status(500).json({ error: "An unexpected server error occurred." });
}

module.exports = { notFound, errorHandler };
