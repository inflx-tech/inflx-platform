'use strict';

/**
 * upload.controller.js
 * Mock upload endpoint for dev/test mode.
 * In production, mobile uploads directly to R2 via presigned URL.
 */

const multer       = require('multer');
const { success }  = require('../utils/response');
const AppError     = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const storageService = require('../services/storage.service');

// Multer: memory storage, 100MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

/**
 * POST /v1/uploads/mock
 * Accepts multipart form-data with fields: file, key
 * Saves file locally in mock mode.
 */
const mockUpload = [
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('VALIDATION_ERROR', 'No file uploaded', 422);
    }

    const key = req.body.key;
    if (!key) {
      throw new AppError('VALIDATION_ERROR', 'key field is required', 422);
    }

    await storageService.saveFile(key, req.file.buffer, req.file.mimetype);

    return success(res, { key, size: req.file.size, mimetype: req.file.mimetype });
  }),
];

module.exports = { mockUpload };
