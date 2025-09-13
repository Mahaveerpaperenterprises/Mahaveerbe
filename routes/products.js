const express = require('express');
const pool = require('../db');
const multer = require('multer');
const { uploadBufferToSpaces } = require('../lib/spaces');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

const clampPercent = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
  return x;
};

const toNumberOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

router.post('/', upload.array('images'), async (req, res) => {
  try {
    const body = req.body;
    const files = req.files || [];

    const fileUrls = [];
    for (const f of files) {
      const { buffer, mimetype, originalname } = f;
      const { url } = await uploadBufferToSpaces(buffer, mimetype, originalname);
      fileUrls.push(url);
    }

    let urlImages = [];
    if (Array.isArray(body.imageUrls)) {
      urlImages = body.imageUrls.filter(Boolean);
    } else if (typeof body.imageUrls === 'string') {
      urlImages = body.imageUrls.trim().startsWith('data:')
        ? [body.imageUrls.trim()]
        : body.imageUrls.split(',').map((s) => s.trim()).filter(Boolean);
    }

    const inlineImages = Array.isArray(body.images) ? body.images.filter(Boolean) : [];

    const allImages = [...urlImages, ...inlineImages, ...fileUrls];

    if (!body.name || !body.brand || !body.category_slug || !body.description || allImages.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: name, brand, category_slug, description, or at least one image',
      });
    }

    const price = toNumberOrNull(body.price);
    const discount_b2b = clampPercent(body.discount_b2b);
    const discount_b2c = clampPercent(body.discount_b2c);
    const published =
      typeof body.published === 'string' ? body.published === 'true' : Boolean(body.published ?? true);

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
  } catch (e) {
    console.error('Create product failed:', e);
    return res.status(500).json({ error: 'Failed to save product' });
  }
});

router.get('/', async (req, res) => {
  let { category = 'all', page = 1, limit = 20, brand } = req.query;

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

    const catRaw = String(category || '').trim().toLowerCase();
    const wantAll = catRaw === 'all';

    if (!wantAll) {
      const leaf = catRaw.split('/').filter(Boolean).pop();
      if (leaf) {
        params.push(leaf);
        where += ` AND category_slug = $${params.length}`;
      }
    }

    params.push(perPage, offset);

    const productsQuery = `
      SELECT id, name, model_name, brand, category_slug,
             price, discount_b2b, discount_b2c,
             description, images, published, created_at
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

    const items = (products.rows || []).map((r) => {
      const price = Number(r.price) || 0;
      const dB2B = clampPercent(r.discount_b2b);
      const dB2C = clampPercent(r.discount_b2c);
      const b2b_price = price ? Number((price * (1 - dB2B / 100)).toFixed(2)) : 0;
      const b2c_price = price ? Number((price * (1 - dB2C / 100)).toFixed(2)) : 0;
      return { ...r, b2b_price, b2c_price };
    });

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json({
      page: pageNum,
      limit: perPage,
      total,
      items,
    });
  } catch (e) {
    console.error('GET /api/products failed:', e);
    return res.status(500).json({ error: 'Failed to fetch products from database' });
  }
});

module.exports = router;
