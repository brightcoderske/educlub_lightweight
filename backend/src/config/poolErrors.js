function attachPoolErrorHandler(pool, logger = console) {
  pool.on("error", (error) => {
    logger.error("Unexpected idle database connection error", error);
  });
}

module.exports = { attachPoolErrorHandler };
