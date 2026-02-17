const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
    logger.error(`${err.name}: ${err.message} \nStack: ${err.stack}`);

    const status = err.status || 500;
    res.status(status).json({
        success: false,
        message: err.message || "Internal Server Error",
        error: process.env.NODE_ENV === "development" ? err : {}
    });
};

module.exports = errorHandler;
