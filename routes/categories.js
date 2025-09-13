const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH leaves AS (
        SELECT n1.id, n1.label, n1.slug
        FROM "NavLinks" n1
        WHERE NOT EXISTS (SELECT 1 FROM "NavLinks" n2 WHERE n2.parent_id = n1.id)
          AND n1.published = true
      )
      SELECT 
        l.label,
        REGEXP_REPLACE(l.slug, '^/', '') AS value,
        (
          SELECT p.images->>0
          FROM "Products" p
          WHERE p.published = true
            AND p.category_slug = REGEXP_REPLACE(l.slug, '^.*/', '')
          ORDER BY p.created_at DESC
          LIMIT 1
        ) AS img
      FROM leaves l
      ORDER BY l.label;
    `);

    const options = [{ label: 'All Categories', value: 'all', img: null }, ...rows];
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(options);
  } catch (err) {
    console.error('GET /api/categories failed:', err);
    res.status(500).json({ error: 'Unable to load categories' });
  }
});

module.exports = router;
