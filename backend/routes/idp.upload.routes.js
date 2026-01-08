const express = require('express');
const multer = require('multer');
const path = require('path');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

const fs = require('fs');

// Ensure uploads folder exists; store in uploads/idp (use absolute path relative to project)
const UPLOAD_BASE = path.join(__dirname, '..', 'uploads', 'idp');
try {
  fs.mkdirSync(UPLOAD_BASE, { recursive: true });
} catch (e) {
  // ignore - will surface during upload if truly problematic
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_BASE);
  },
  filename: (req, file, cb) => {
    cb(null, 'idpfile_' + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files allowed'));
    }
    cb(null, true);
  }
});

// POST /api/idp/upload - upload a PDF for an IDP activity (returns pdf_path)
router.post('/upload', requireAuth, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    // Return path relative to backend root consistent with existing references
    const pdfPath = path.join('uploads', 'idp', req.file.filename);
    res.json({ message: 'PDF uploaded successfully', pdf_path: pdfPath });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
