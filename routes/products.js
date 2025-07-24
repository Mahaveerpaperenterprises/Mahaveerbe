const express = require('express');
const pool = require('../db');
const router = express.Router();

// POST /api/products - Add a new product
router.post('/', async (req, res) => {
  const p = req.body;

  // Validate required fields
  if (
    !p.name ||
    !p.brand ||
    !p.category_slug ||
    !p.description ||
    !Array.isArray(p.images) ||
    p.images.length === 0
  ) {
    return res.status(400).json({
      error: 'Missing required fields: name, brand, category_slug, description, or at least one image'
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
        p.brand,
        p.category_slug,
        p.price ? parseFloat(p.price) : null,
        p.discountedPrice ? parseFloat(p.discountedPrice) : null,
        p.description,
        JSON.stringify(p.images)
      ]
    );

    return res.status(201).json({
      message: 'Product saved',
      id: rows[0].id
    });
  } catch (e) {
    console.error('DB Insert Error:', e);
    return res.status(500).json({ error: 'Failed to save product to database' });
  }
});

// GET /api/products - Get products list with filters
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

    // Pagination parameters
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
      items: products.rows
    });
  } catch (err) {
    console.error('DB Fetch Error:', err);
    return res.status(500).json({ error: 'Failed to fetch products from database' });
  }
});

module.exports = router;
