// src/utils/logger.js

function logInfo(message, meta) {
  if (meta) {
    console.log(`[INFO] ${message}`, meta);
  } else {
    console.log(`[INFO] ${message}`);
  }
}

function logError(message, meta) {
  if (meta) {
    console.error(`[ERROR] ${message}`, meta);
  } else {
    console.error(`[ERROR] ${message}`);
  }
}

module.exports = {
  logInfo,
  logError
};
