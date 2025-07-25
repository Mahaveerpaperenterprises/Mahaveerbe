const express = require('express');
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.post('/', upload.array('images'), async (req, res) => {
  try {
    const body = req.body;
    const files = req.files || [];

    const urlImages = body.imageUrls
      ? body.imageUrls.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const fileUrls = files.map(
      (file) => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
    );

    const allImages = [...urlImages, ...fileUrls];

    if (
      !body.name ||
      !body.brand ||
      !body.category_slug ||
      !body.description ||
      allImages.length === 0
    ) {
      return res.status(400).json({
        error: 'Missing required fields: name, brand, category_slug, description, or at least one image',
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO "Products"
         (name, model_name, brand, category_slug, price, discountedPrice, description, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        body.name,
        body.model_name || null,
        body.brand,
        body.category_slug,
        body.price ? parseFloat(body.price) : null,
        body.discountedPrice ? parseFloat(body.discountedPrice) : null,
        body.description,
        JSON.stringify(allImages),
      ]
    );

    return res.status(201).json({ message: 'Product saved', id: rows[0].id });
  } catch (err) {
    console.error('Error inserting product:', err);
    return res.status(500).json({ error: 'Failed to save product' });
  }
});

router.get('/', async (req, res) => {
  let { category = 'all', page = 1, limit = 20, brand } = req.query;

  const wantAll = String(category).toLowerCase() === 'all';
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, parseInt(limit, 10) || 20);
  const offset = (pageNum - 1) * perPage;

  try {
    const params = [];
    let where = 'WHERE published = true';

    if (brand) {
      params.push(brand);
      where += ` AND brand = $${params.length}`;
    }

    if (!wantAll) {
      params.push(category);
      where += ` AND category_slug = $${params.length}`;
    }

    params.push(perPage, offset);

    const productsQuery = `
      SELECT id, name, model_name, brand, category_slug, price, discountedPrice, description, images
      FROM "Products"
      ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const products = await pool.query(productsQuery, params);

    const countParams = params.slice(0, params.length - 2);
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM "Products"
      ${where}
    `;

    const countResult = await pool.query(countQuery, countParams);
    const total = Number(countResult.rows[0].total);

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({
      page: pageNum,
      limit: perPage,
      total,
      items: products.rows,
    });
  } catch (err) {
    console.error('DB Fetch Error:', err);
    return res.status(500).json({ error: 'Failed to fetch products from database' });
  }
});

module.exports = router;
