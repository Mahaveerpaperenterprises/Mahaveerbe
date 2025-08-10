/*const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY id DESC');
    res.json({ orders: result.rows });
  } catch (err) {
    console.error('❌ Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.post('/', async (req, res) => {
  const { order_id, date, items, payment_mode } = req.body;

  if (!order_id || !date || !items || !payment_mode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO orders (order_id, date, items, payment_mode) VALUES ($1, $2, $3, $4) RETURNING *',
      [order_id, date, items, payment_mode]
    );
    res.status(201).json({ message: 'Order added', order: result.rows[0] });
  } catch (err) {
    console.error('❌ Error saving order:', err);
    res.status(500).json({ error: 'Failed to save order' });
  }
});

module.exports = router; */



const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.id,
        o.created_at,
        o.email,
        o.total_amount,
        o.currency,
        o.payment_status,
        o.order_status,
        o.fulfill_status,
        json_agg(
          json_build_object(
            'product_name', oi.product_name,
            'image_url', oi.image_url,
            'quantity', oi.quantity,
            'unit_price_minor', oi.unit_price_minor
          )
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);

    res.json({ orders: result.rows });
  } catch (err) {
    console.error('❌ Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.post('/', async (req, res) => {
  const { order_id, date, items, payment_mode } = req.body;

  if (!order_id || !date || !items || !payment_mode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO orders (order_id, date, items, payment_mode) VALUES ($1, $2, $3, $4) RETURNING *',
      [order_id, date, items, payment_mode]
    );
    res.status(201).json({ message: 'Order added', order: result.rows[0] });
  } catch (err) {
    console.error('❌ Error saving order:', err);
    res.status(500).json({ error: 'Failed to save order' });
  }
});

module.exports = router;

