'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { mockUpload } = require('../controllers/upload.controller');
const env = require('../config/env');

const router = Router();

// Mock upload endpoint — only enabled in mock mode
if (env.R2_MOCK) {
  router.post('/mock', authenticate, ...mockUpload);
}

module.exports = router;
