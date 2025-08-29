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
      `INSERT INTO "NavLinks" (label, slug, display_order)
       VALUES ($1,$2,$3) RETURNING id`,
      [root.title, ensureLeadingSlash(root.path), root.order ?? 1]
    );
    const rootId = rows[0].id;

    const addKids = async (items, parentId) => {
      for (const it of items ?? []) {
        if (!it.title || !it.path) throw new Error('submenu items need title and path');
        const { rows: r2 } = await client.query(
          `INSERT INTO "NavLinks" (label, slug, display_order, parent_id)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [it.title, ensureLeadingSlash(it.path), it.order ?? 1, parentId]
        );
        if (Array.isArray(it.submenu) && it.submenu.length) {
          await addKids(it.submenu, r2[0].id);
        }
      }
    };
    await addKids(root.submenu, rootId);

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
  const { category_slug, label } = req.body;
  if (!category_slug || !label) return res.status(400).json({ error: 'Category slug and label are required' });

  const client = await pool.connect();
  try {
    const existingCategory = await client.query(
      `SELECT id FROM "NavLinks" WHERE slug = $1 LIMIT 1`,
      [category_slug]
    );
    if (existingCategory.rows.length > 0) {
      return res.status(200).json({ message: 'Category slug already exists' });
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO "NavLinks" (label, slug, display_order)
       VALUES ($1,$2,$3) RETURNING id`,
      [label, ensureLeadingSlash(category_slug), 1]
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

router.post('/add-product', async (req, res) => {
  const { category_slug } = req.body;

  const existingCategory = await pool.query(
    `SELECT id FROM "NavLinks" WHERE slug = $1 LIMIT 1`,
    [category_slug]
  );

  if (existingCategory.rows.length === 0) {
    await pool.query(
      `INSERT INTO "NavLinks" (label, slug, display_order)
       VALUES ($1, $2, 1)`,
      ['New Category Label', category_slug]
    );
  }

  const body = req.body;
  const files = req.files || [];

  const fileUrls = files.map(
    (f) => `${req.protocol}://${req.get('host')}/uploads/${f.filename}`
  );

  let urlImages = [];
  if (Array.isArray(body.imageUrls)) {
    urlImages = body.imageUrls.filter(Boolean);
  } else if (typeof body.imageUrls === 'string') {
    urlImages = body.imageUrls.trim().startsWith('data:')
      ? [body.imageUrls.trim()]
      : body.imageUrls.split(',').map((s) => s.trim()).filter(Boolean);
  }

  const inlineImages = Array.isArray(body.images)
    ? body.images.filter(Boolean)
    : [];

  const allImages = [...urlImages, ...inlineImages, ...fileUrls];

  if (
    !body.name ||
    !body.brand ||
    !body.category_slug ||
    !body.description ||
    allImages.length === 0
  ) {
    return res.status(400).json({
      error:
        'Missing required fields: name, brand, category_slug, description, or at least one image',
    });
  }

  const price = toNumberOrNull(body.price);
  const discount_b2b = clampPercent(body.discount_b2b);
  const discount_b2c = clampPercent(body.discount_b2c);
  const published =
    typeof body.published === 'string'
      ? body.published === 'true'
      : Boolean(body.published ?? true);

  const { rows } = await pool.query(
    `INSERT INTO "Products"
       (name, model_name, brand, category_slug, price,
        discount_b2b, discount_b2c,
        description, images, published)
     VALUES ($1, $2, $3, $4, $5,
             $6, $7,
             $8, $9::jsonb, $10)
     RETURNING id`,
    [
      body.name,
      body.model_name || null,
      body.brand,
      body.category_slug,
      price,
      discount_b2b,
      discount_b2c,
      body.description,
      JSON.stringify(allImages),
      published,
    ]
  );

  return res.status(201).json({ message: 'Product saved', id: rows[0].id });
});

module.exports = router;
