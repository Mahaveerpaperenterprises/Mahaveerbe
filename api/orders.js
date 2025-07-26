const pool = require('../db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM orders ORDER BY id DESC');
      res.status(200).json({ orders: result.rows });
    } catch (err) {
      console.error('❌ Error fetching orders:', err);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }

  else if (req.method === 'POST') {
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
  }

  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
