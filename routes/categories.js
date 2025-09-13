const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH leaves AS (
        SELECT
          n1.id,
          n1.label,
          REGEXP_REPLACE(n1.slug, '^/', '') AS value,
          REGEXP_REPLACE(REGEXP_REPLACE(n1.slug, '^/', ''), '^.*/', '') AS leaf
        FROM "NavLinks" n1
        WHERE NOT EXISTS (SELECT 1 FROM "NavLinks" n2 WHERE n2.parent_id = n1.id)
          AND n1.published = true
      )
      SELECT
        l.label,
        l.value,
        COALESCE(
          (
            SELECT p.images->>0
            FROM "Products" p
            WHERE p.published = true
              AND lower(p.category_slug) = lower(l.leaf)
            ORDER BY p.created_at DESC
            LIMIT 1
          ),
          (
            SELECT p.images->>0
            FROM "Products" p
            WHERE p.published = true
              AND lower(p.category_slug) = lower(l.value)
            ORDER BY p.created_at DESC
            LIMIT 1
          )
        ) AS image
      FROM leaves l
      ORDER BY l.label;
    `);

    const options = [{ label: "All Categories", value: "all", image: null }, ...rows];

    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(options);
  } catch (err) {
    console.error("Fetch categories failed:", err);
    res.status(500).json({ error: "Unable to load categories" });
  }
});

module.exports = router;
