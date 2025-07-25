const pool = require('../db');

const ensureLeadingSlash = (p) => (p.startsWith('/') ? p : '/' + p);

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(`
        SELECT id, parent_id, label, slug, display_order
        FROM   "NavLinks"
        WHERE  published
        ORDER  BY parent_id NULLS FIRST, display_order
      `);

      const map = new Map();
      rows.forEach(r => {
        const node = {
          title: r.label,
          path: r.parent_id ? r.slug.split('/').pop() : r.slug
        };
        map.set(r.id, node);
      });

      const menu = [];
      rows.forEach(r => {
        const node = map.get(r.id);
        if (r.parent_id) {
          const parent = map.get(r.parent_id);
          if (parent) {
            (parent.submenu ??= []).push(node);
          }
        } else {
          menu.push(node);
        }
      });

      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).json(menu);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'DB query failed' });
    }
  }

  else if (req.method === 'POST') {
    const root = req.body;

    if (!root?.title || !root?.path) {
      return res.status(400).json({ error: 'title and path are required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO "NavLinks" (label, slug, display_order)
         VALUES ($1, $2, $3) RETURNING id`,
        [
          root.title,
          ensureLeadingSlash(root.path),
          root.order ?? 1
        ]
      );
      const rootId = rows[0].id;

      const addKids = async (items, parentId) => {
        for (const it of items ?? []) {
          if (!it.title || !it.path) throw new Error('submenu items need title and path');

          const { rows: r2 } = await client.query(
            `INSERT INTO "NavLinks" (label, slug, display_order, parent_id)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [
              it.title,
              ensureLeadingSlash(it.path),
              it.order ?? 1,
              parentId
            ]
          );

          if (Array.isArray(it.submenu) && it.submenu.length) {
            await addKids(it.submenu, r2[0].id);
          }
        }
      };

      await addKids(root.submenu, rootId);
      await client.query('COMMIT');

      res.status(201).json({ message: 'Menu saved', id: rootId });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(err);
      res.status(500).json({ error: 'Insert failed' });
    } finally {
      client.release();
    }
  }

  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
