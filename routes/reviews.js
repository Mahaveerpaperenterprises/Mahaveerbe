// routes/reviews.js
const express = require('express');
const db = require('../db');
const router = express.Router();

const uuidRE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.post('/', async (req, res) => {
  try {
    let { product_id, user_name, user_email, rating, title, body, images } = req.body || {};
    if (!product_id || typeof product_id !== 'string' || !uuidRE.test(product_id)) {
      return res.status(400).json({ error: 'Invalid product_id' });
    }
    const exists = await db.query(`SELECT 1 FROM "Products" WHERE id = $1 LIMIT 1`, [product_id]);
    if (!exists.rowCount) {
      return res.status(400).json({ error: 'Unknown product_id' });
    }

    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ error: 'Invalid rating' });
    }

    if (Array.isArray(images)) {
      images = images.filter(Boolean);
      if (!images.length) images = null;
    } else if (typeof images === 'string' && images.trim()) {
      images = [images.trim()];
    } else {
      images = null;
    }

    user_name = typeof user_name === 'string' && user_name.trim() ? user_name.trim() : null;
    user_email = typeof user_email === 'string' && user_email.trim() ? user_email.trim() : null;
    title = typeof title === 'string' && title.trim() ? title.trim() : null;
    body = typeof body === 'string' && body.trim() ? body.trim() : null;

    if (!user_name || !body) {
      return res.status(400).json({ error: 'user_name and body are required' });
    }

    const q = `
      INSERT INTO "ProductReviews"(product_id, user_name, user_email, rating, title, body, images)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, product_id, user_name, user_email, rating, title, body, images, helpful, created_at, updated_at
    `;
    const vals = [product_id, user_name, user_email, r, title, body, images ? JSON.stringify(images) : null];
    const { rows } = await db.query(q, vals);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create review' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { productId, limit, offset } = req.query;
    const lim = Math.min(parseInt(limit || '20', 10), 100);
    const off = parseInt(offset || '0', 10);
    const q = `
      SELECT id, product_id, user_name, user_email, rating, title, body, images, helpful, created_at, updated_at
      FROM "ProductReviews"
      ${productId ? 'WHERE product_id = $1' : ''}
      ORDER BY created_at DESC
      LIMIT $${productId ? 2 : 1} OFFSET $${productId ? 3 : 2}
    `;
    const params = productId ? [productId, lim, off] : [lim, off];
    const { rows } = await db.query(q, params);
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
