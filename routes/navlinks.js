const express = require('express');
const pool = require('../db');

const router = express.Router();

const ensureLeadingSlash = (p) => (p.startsWith('/') ? p : '/' + p);

router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, parent_id, label, slug, display_order
      FROM "NavLinks"
      WHERE published
      ORDER BY parent_id NULLS FIRST, display_order
    `);

    const toSlugKey = (s) => s.replace(/^\//, '').split('/').join('-');

    const map = new Map();
    rows.forEach((r) => {
      const node = {
        title: r.label,
        path: r.parent_id ? r.slug.split('/').pop() : r.slug,
        type: 'category',
        slugKey: toSlugKey(r.slug),
      };
      map.set(r.id, node);
    });

    const menu = [];
    rows.forEach((r) => {
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
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: 'DB query failed' });
  }
});

router.post('/', async (req, res) => {
  const root = req.body;
  if (!root?.title || !root?.path) return res.status(400).json({ error: 'title and path are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO "NavLinks" (label, slug, display_order, published)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [root.title, ensureLeadingSlash(root.path), root.order ?? 1, true]
    );
    const rootId = rows[0].id;

    const addKids = async (items, parentId, parentSlug) => {
      for (const it of items ?? []) {
        const leaf = ensureLeadingSlash(it.path).replace(/^\/+/, '');
        const fullSlug = ensureLeadingSlash(`${parentSlug}/${leaf}`.replace(/\/+/g, '/'));
        const { rows: r2 } = await client.query(
          `INSERT INTO "NavLinks" (label, slug, display_order, parent_id, published)
           VALUES ($1,$2,$3,$4,$5) RETURNING id, slug`,
          [it.title, fullSlug, it.order ?? 1, parentId, true]
        );
        if (Array.isArray(it.submenu) && it.submenu.length) {
          await addKids(it.submenu, r2[0].id, r2[0].slug);
        }
      }
    };
    await addKids(root.submenu, rootId, ensureLeadingSlash(root.path));

    await client.query('COMMIT');
    res.status(201).json({ message: 'Menu saved', id: rootId });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Insert failed' });
  } finally {
    client.release();
  }
});

router.post('/add-category-slug', async (req, res) => {
  const { category_slug, label, parent_slug } = req.body;
  if (!category_slug || !label) return res.status(400).json({ error: 'Category slug and label are required' });

  const client = await pool.connect();
  try {
    const normalizedLeaf = ensureLeadingSlash(String(category_slug).trim().toLowerCase()).replace(/^\/+/, '');
    const leafRegex = `(^|/)${normalizedLeaf}$`;

    const exists = await client.query(
      `SELECT id FROM "NavLinks" WHERE lower(slug) = $1 OR slug ~* $2 LIMIT 1`,
      ['/' + normalizedLeaf, leafRegex]
    );
    if (exists.rows.length > 0) {
      return res.status(200).json({ message: 'Category slug already exists' });
    }

    let parentId = null;
    let fullSlug = '/' + normalizedLeaf;

    if (parent_slug) {
      const parentByKey = await client.query(
        `SELECT id, slug
         FROM "NavLinks"
         WHERE regexp_replace(replace(lower(slug),'/','-'), '^-+', '') = lower($1)
         LIMIT 1`,
        [String(parent_slug).trim()]
      );
      if (parentByKey.rows.length) {
        parentId = parentByKey.rows[0].id;
        const parentFull = parentByKey.rows[0].slug;
        fullSlug = ensureLeadingSlash(`${parentFull}/${normalizedLeaf}`.replace(/\/+/g, '/'));
      }
    }

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO "NavLinks" (label, slug, display_order, parent_id, published)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [label, fullSlug, 1, parentId, true]
    );
    await client.query('COMMIT');

    res.status(201).json({ message: 'New category added successfully', id: rows[0].id });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error occurred while adding category slug' });
  } finally {
    client.release();
  }
});

module.exports = router;
