const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH leaves AS (
        SELECT n1.id, n1.label, REGEXP_REPLACE(n1.slug, '^/', '') AS value
        FROM "NavLinks" n1
        WHERE NOT EXISTS (
                SELECT 1 FROM "NavLinks" n2
                WHERE n2.parent_id = n1.id
              )
          AND n1.published
      )
      SELECT l.label,
             l.value,
             (
               SELECT p.images->>0   -- first image in array
               FROM "Products" p
               WHERE p.category_slug = l.value
               AND p.published = true
               ORDER BY p.created_at DESC
               LIMIT 1
             ) AS image
      FROM leaves l
      ORDER BY l.label;
    `);

    const options = [
      { label: "All Categories", value: "all", image: null },
      ...rows,
    ];

    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(options);
  } catch (err) {
    console.error("Fetch categories failed:", err);
    res.status(500).json({ error: "Unable to load categories" });
  }
});

module.exports = router;
