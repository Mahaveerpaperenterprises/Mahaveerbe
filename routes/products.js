const express = require('express');
const pool    = require('../db');
const router = express.Router();

router.post('/', async (req, res) => {
  const p = req.body;

  // quick guard-rails
  if (!p?.name || !p?.category)
    return res.status(400).json({ error: 'name and category are required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO "Products"
         (name, model_name, brand, category_slug, price, images)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      [
        p.name,
        p.model_name ?? null,
        p.brand      ?? null,
        p.category,
        p.price      ?? null,
        JSON.stringify(p.images ?? [])
      ]
    );

    res.status(201).json({ message: 'Product saved', id: rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Insert failed' });
  }
});

router.get('/', async (req, res) => {
  const { category, page = 1, limit = 20, brand } = req.query;

  if (!category) {
    return res.status(400).json({ error: 'category query parameter is required' });
  }

  // ensure integers
  const pageNum  = Math.max(1, parseInt(page,  10) || 1);
  const perPage  = Math.max(1, parseInt(limit, 10) || 20);
  const offset   = (pageNum - 1) * perPage;

  try {
    /* ---------- build dynamic SQL parts ---------- */
    const params   = [category, perPage, offset];      // $1, $2, $3
    let   brandSql = '';

    if (brand) {
      params.unshift(brand);                           // becomes $1
      brandSql = ' AND brand = $1 ';
    }

    /* ---------- main query ---------- */
    const products = await pool.query(
      `SELECT id, name, model_name, brand, price, images
         FROM "Products"
        WHERE published
          ${brandSql}
          AND category_slug = $${brand ? 2 : 1}
        ORDER BY created_at DESC
        LIMIT  $${brand ? 3 : 2}
        OFFSET $${brand ? 4 : 3}`,
      params
    );

    /* ---------- total count for pagination ---------- */
    const countRes = await pool.query(
      `SELECT COUNT(*) AS total
         FROM "Products"
        WHERE published
          ${brandSql}
          AND category_slug = $${brand ? 2 : 1}`,
      brand ? [brand, category] : [category]
    );
    const total = parseInt(countRes.rows[0].total, 10);

    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min
    res.json({
      page   : pageNum,
      limit  : perPage,
      total,
      items  : products.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB query failed' });
  }
});

module.exports = router;