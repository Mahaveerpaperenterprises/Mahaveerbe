const express = require('express');
const pool    = require('../db');

const router = express.Router();

/* -----------------------------------------------------------
   GET /api/categories
   Returns something like:
   [
     { "label": "All Categories", "value": "all" },
     { "label": "Notebooks & Diaries", "value": "notebooks-diaries" },
     { "label": "Pens & Pencils",      "value": "pens-pencils"      },
     { "label": "Art Supplies",        "value": "art-supplies"      }
     …
   ]
   -----------------------------------------------------------*/
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      /*  pull every leaf menu item (no children) that is published  */
      WITH leaves AS (
        SELECT n1.id
        FROM   "NavLinks" n1
        WHERE  NOT EXISTS (
                 SELECT 1 FROM "NavLinks" n2
                 WHERE  n2.parent_id = n1.id
               )
          AND  n1.published
      )
      SELECT label AS label,
             REGEXP_REPLACE(slug, '^\/', '') AS value   -- "/stationery/notebooks" ➜ "stationery/notebooks"
      FROM   "NavLinks"
      WHERE  id IN (SELECT id FROM leaves)
      ORDER  BY label;
    `);

    /* prepend the universal option */
    const options = [
      { label: 'All Categories', value: 'all' },
      ...rows
    ];

    res.setHeader('Cache-Control', 'public, max-age=3600'); // cache 1 h
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load categories' });
  }
});

module.exports = router;
