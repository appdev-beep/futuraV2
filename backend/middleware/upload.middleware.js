// middleware/upload.middleware.js
const multer = require('multer');
const path = require('path');

// store files in /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${base}_${timestamp}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are allowed'));
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter });

module.exports = { upload };
