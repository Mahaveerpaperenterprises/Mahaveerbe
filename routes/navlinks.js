const express = require('express');
const pool    = require('../db');

const router = express.Router();

/* ----------  GET /api/navlinks  ---------- */
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, parent_id, label, slug, display_order
      FROM   "NavLinks"
      WHERE  published
      ORDER  BY parent_id NULLS FIRST, display_order
    `);

    // build unlimited-depth tree
    const map = new Map();
    const menu = [];

    rows.forEach(r => {
      const node = { title: r.label, path: r.slug };
      map.set(r.id, node);

      if (r.parent_id) {
        (map.get(r.parent_id).submenu ??= []).push(node);
      } else {
        menu.push(node);
      }
    });

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(menu);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB query failed' });
  }
});

/* ----------  POST /api/navlinks  ---------- */
router.post('/', async (req, res) => {
  const root = req.body;
  if (!root?.title || !root?.path || !root?.order)
    return res.status(400).json({ error: 'title, path, order are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO "NavLinks" (label, slug, display_order)
       VALUES ($1,$2,$3) RETURNING id`,
      [root.title, root.path, root.order]
    );
    const rootId = rows[0].id;

    const addKids = async (items, parentId) => {
      for (const it of items ?? []) {
        if (!it.title || !it.path || !it.order)
          throw new Error('submenu items need title, path, order');

        const { rows: r2 } = await client.query(
          `INSERT INTO "NavLinks" (label, slug, display_order, parent_id)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [it.title, it.path, it.order, parentId]
        );
        if (it.submenu?.length) await addKids(it.submenu, r2[0].id);
      }
    };
    await addKids(root.submenu, rootId);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Menu saved', id: rootId });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Insert failed' });
  } finally {
    client.release();
  }
});



module.exports = router;
