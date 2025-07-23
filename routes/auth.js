// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');

const router = express.Router();


/* for signup of users */
router.post('/signup', async (req, res) => {
  const { name, email, password, userType } = req.body;

  if (!name || !email || !password || !userType)
    return res.status(400).json({ error: 'All fields are required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO "Users" (name, email, password, user_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, email, hashedPassword, userType]
    );

    res.status(201).json({ message: 'User created', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});


/* for login users */
router.post('/login', async (req, res) => {
  const { email, password, userType } = req.body;

  if (!email || !password || !userType) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM "Users" WHERE email = $1 AND user_type = $2`,
      [email, userType]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ message: 'Login successful', userId: user.id, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
