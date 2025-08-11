const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

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

const setImageHeaders = (res, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
  else if (ext === '.png') res.setHeader('Content-Type', 'image/png');
  else if (ext === '.webp') res.setHeader('Content-Type', 'image/webp');
  else if (ext === '.avif') res.setHeader('Content-Type', 'image/avif');
  else if (ext === '.gif') res.setHeader('Content-Type', 'image/gif');

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
};

router.use('/uploads', express.static(uploadDir, {
  fallthrough: true,
  setHeaders: setImageHeaders,
}));

router.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  fs.access(filePath, fs.constants.R_OK, (err) => {
    if (err) return res.status(404).end('Not found');
    setImageHeaders(res, filePath);
    res.sendFile(filePath);
  });
});

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
  res.status(200).json({ url: fileUrl });
});

module.exports = router;
