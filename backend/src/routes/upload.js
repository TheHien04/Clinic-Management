/**
 * Upload Routes
 */

import express from 'express';
import { uploadSingle, uploadMultiple } from '../middleware/upload.js';
import { authMiddleware, authorize } from '../middleware/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// All upload routes require authentication
router.use(authMiddleware);
router.use(authorize('admin', 'manager', 'supervisor', 'doctor', 'nurse'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadRoot = path.resolve(__dirname, '../../uploads');

router.get('/files/:filename', (req, res, next) => {
  const filename = path.basename(String(req.params.filename || ''));
  if (!filename || filename !== req.params.filename) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(filename, { root: uploadRoot, dotfiles: 'deny' }, (error) => {
    if (error) next(error);
  });
});

/**
 * Upload single file
 * POST /api/upload/single
 */
router.post('/single', uploadSingle, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/api/upload/files/${encodeURIComponent(req.file.filename)}`
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
});

/**
 * Upload multiple files
 * POST /api/upload/multiple
 */
router.post('/multiple', uploadMultiple, (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const files = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      path: `/api/upload/files/${encodeURIComponent(file.filename)}`
    }));

    res.json({
      success: true,
      message: `${files.length} files uploaded successfully`,
      data: files
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'File upload failed'
    });
  }
});

export default router;
