const express = require("express");
const multer = require("multer");
const path = require("path");
const { db } = require("../config/db");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

// Ensure uploads folder exists
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/cl");
  },
  filename: (req, file, cb) => {
    cb(null, "clitem_" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files allowed"));
    }
    cb(null, true);
  }
});

// UPLOAD PDF FOR ONE COMPETENCY ITEM
router.post(
  "/:itemId/upload",
  requireAuth,
  upload.single("pdf"),
  async (req, res) => {
    try {
      const itemId = req.params.itemId;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const pdfPath = "uploads/cl/" + req.file.filename;

      await db.query(
        `UPDATE cl_items SET pdf_path = ?, updated_at = NOW() WHERE id = ?`,
        [pdfPath, itemId]
      );

      res.json({
        message: "PDF uploaded successfully",
        pdf_path: pdfPath
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
