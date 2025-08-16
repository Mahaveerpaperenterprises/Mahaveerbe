const express = require('express');
const db = require('../db');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { product_id, user_name, user_email, rating, title, body, images } = req.body;
    if (!product_id || !user_name || !rating || !body) return res.status(400).json({ error: 'Missing required fields' });
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: 'Invalid rating' });
    const q = `
      INSERT INTO "ProductReviews"(product_id, user_name, user_email, rating, title, body, images)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, product_id, user_name, user_email, rating, title, body, images, helpful, created_at, updated_at
    `;
    const vals = [product_id, user_name, user_email || null, r, title || null, body, images ? JSON.stringify(images) : null];
    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create review' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { productId, limit, offset } = req.query;
    if (!productId) return res.status(400).json({ error: 'productId is required' });
    const lim = Math.min(parseInt(limit || '20', 10), 100);
    const off = parseInt(offset || '0', 10);
    const q = `
      SELECT id, product_id, user_name, user_email, rating, title, body, images, helpful, created_at, updated_at
      FROM "ProductReviews"
      WHERE product_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const { rows } = await db.query(q, [productId, lim, off]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.patch('/:id/helpful', async (req, res) => {
  try {
    const { id } = req.params;
    const q = `
      UPDATE "ProductReviews"
      SET helpful = helpful + 1, updated_at = now()
      WHERE id = $1
      RETURNING id, helpful
    `;
    const { rows } = await db.query(q, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update helpful count' });
  }
});

module.exports = router;
