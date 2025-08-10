/*require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString : process.env.DATABASE_URL,
  ssl              : { rejectUnauthorized: false }
});

module.exports = pool;        // every file can now:  const pool = require('./db'); */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Use /tmp on Vercel (read/write), local "uploads" otherwise
const isVercel = !!process.env.VERCEL;
const uploadDir = isVercel
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '..', 'uploads');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.error('Failed to ensure upload dir:', uploadDir, e);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

  res.status(200).json({ url: fileUrl });
});

module.exports = router;
