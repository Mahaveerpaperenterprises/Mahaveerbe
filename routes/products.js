const express = require('express');
const pool = require('../db');
const router = express.Router();

router.post('/', async (req, res) => {
  const p = req.body;

  if (
    !p.name ||
    !p.category_slug ||
    !p.brand ||
    !p.description ||
    !Array.isArray(p.images) ||
    p.images.length === 0
  ) {
    return res.status(400).json({
      error: 'Missing required fields: name, brand, category_slug, description, or image'
    });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO "Products"
         (name, model_name, brand, category_slug, price, discountedPrice, description, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        p.name,
        p.model_name || null,
        p.brand || null,
        p.category_slug || null,
        p.price || null,
        p.discountedPrice || null,
        p.description || null,
        JSON.stringify(p.images || [])
      ]
    );

    res.status(201).json({ message: 'Product saved', id: rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Insert failed' });
  }
});

router.get('/', async (req, res) => {
  let { category = 'all', page = 1, limit = 20, brand } = req.query;

  const wantAll = String(category).toLowerCase() === 'all';
  if (!wantAll && !category) {
    return res.status(400).json({ error: 'category query parameter is required' });
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, parseInt(limit, 10) || 20);
  const offset = (pageNum - 1) * perPage;

  try {
    const params = [];
    let where = 'WHERE published';

    if (brand) {
      params.push(brand);
      where += ` AND brand = $${params.length}`;
    }

    if (!wantAll) {
      params.push(category);
      where += ` AND category_slug = $${params.length}`;
    }

    params.push(perPage, offset);
    const products = await pool.query(
      `SELECT id, name, model_name, brand, price, images
         FROM "Products"
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1}
         OFFSET $${params.length}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*) AS total FROM "Products" ${where}`,
      countParams
    );

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      page: pageNum,
      limit: perPage,
      total: Number(total),
      items: products.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB query failed' });
  }
});

module.exports = router;
