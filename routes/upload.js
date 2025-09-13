const express = require('express');
const multer = require('multer');
const { uploadBufferToSpaces } = require('../lib/spaces');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { buffer, mimetype, originalname } = req.file;
    const { url } = await uploadBufferToSpaces(buffer, mimetype, originalname);

    return res.status(200).json({ url });
  } catch (err) {
    console.error('Spaces upload failed:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
