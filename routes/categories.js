const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH leaves AS (
        SELECT n1.id
        FROM "NavLinks" n1
        WHERE NOT EXISTS (
          SELECT 1 FROM "NavLinks" n2 WHERE n2.parent_id = n1.id
        )
        AND n1.published = true
      )
      SELECT
        n.label AS label,
        REGEXP_REPLACE(n.slug, '^\/', '') AS value,
        pi.first_image AS img
      FROM "NavLinks" n
      LEFT JOIN LATERAL (
        SELECT p.images->>0 AS first_image
        FROM "Products" p
        WHERE p.published = true
          AND p.category_slug = REGEXP_REPLACE(n.slug, '^.*/', '')
        ORDER BY p.created_at DESC
        LIMIT 1
      ) pi ON true
      WHERE n.id IN (SELECT id FROM leaves)
      ORDER BY n.label;
    `);

    const options = [{ label: 'All Categories', value: 'all', img: null }, ...rows];

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load categories' });
  }
});

module.exports = router;
