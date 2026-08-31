'use strict';
// dist/ is copied into api/dist/ by the build command (see vercel.json).
let cachedHandler = null;

module.exports = async (req, res) => {
  if (!cachedHandler) {
    const { createHandler } = require('./dist/serverless');
    cachedHandler = await createHandler();
  }
  cachedHandler(req, res);
};
