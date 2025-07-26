const express = require('express');
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

module.exports = router;
