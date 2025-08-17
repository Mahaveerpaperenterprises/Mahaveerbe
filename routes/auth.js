const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('../db');

const router = express.Router();

const LOWER = (s) => (s || '').trim().toLowerCase();
const OTP_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const SHOW_404_WHEN_NOT_FOUND = true;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true') === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

async function sendOtpEmail({ to, otp }) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Your password reset code',
    text: `Your OTP is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    html: `<div style="font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial"><p>Use this code to reset your password:</p><p style="font-size:22px;font-weight:700;letter-spacing:2px">${otp}</p><p>This code expires in ${OTP_TTL_MINUTES} minutes.</p></div>`,
  });
}

router.post('/signup', async (req, res) => {
  const { name, email, password, userType } = req.body;
  if (!name || !email || !password || !userType) return res.status(400).json({ error: 'All fields are required' });
  const emailLc = LOWER(email);
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO "Users" (name, email, password, user_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, emailLc, hashedPassword, userType]
    );
    return res.status(201).json({ message: 'User created', id: result.rows[0].id });
  } catch (err) {
    if (String(err.code) === '23505') return res.status(409).json({ error: 'Email already registered' });
    return res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  const { b2cEmail, b2cPassword, userType } = req.body;
  if (!b2cEmail || !b2cPassword || !userType) return res.status(400).json({ error: 'All fields are required' });
  const emailLc = LOWER(b2cEmail);
  try {
    const result = await pool.query(
      `SELECT * FROM "Users" WHERE LOWER(email) = $1 AND user_type = $2`,
      [emailLc, userType]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(b2cPassword, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    return res.json({ message: 'Login successful', userId: user.id, name: user.name });
  } catch {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/forgot/request', async (req, res) => {
  const { email } = req.body || {};
  const emailLc = LOWER(email);
  if (!emailLc) return res.status(400).json({ error: 'Email is required' });
  try {
    const q = await pool.query(`SELECT id FROM "Users" WHERE LOWER(email) = $1`, [emailLc]);
    const user = q.rows[0];
    if (!user) {
      if (SHOW_404_WHEN_NOT_FOUND) return res.status(404).json({ error: 'Email not found' });
      return res.json({ ok: true });
    }
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await pool.query(
      `UPDATE "Users"
       SET reset_otp_hash = $2,
           reset_expires_at = $3,
           reset_attempts = 0,
           reset_in_progress = TRUE
       WHERE id = $1`,
      [user.id, otpHash, expiresAt]
    );
    await sendOtpEmail({ to: emailLc, otp });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Could not start reset' });
  }
});

router.post('/forgot/verify', async (req, res) => {
  const { email, otp } = req.body || {};
  const emailLc = LOWER(email);
  if (!emailLc || !otp) return res.status(400).json({ error: 'email and otp are required' });
  try {
    const q = await pool.query(
      `SELECT id, reset_otp_hash, reset_expires_at, reset_attempts, reset_in_progress
       FROM "Users" WHERE LOWER(email) = $1`,
      [emailLc]
    );
    const row = q.rows[0];
    if (!row) return res.status(400).json({ error: 'Invalid request' });
    if (!row.reset_in_progress) return res.status(400).json({ error: 'No reset in progress' });
    if (row.reset_attempts >= MAX_VERIFY_ATTEMPTS) return res.status(429).json({ error: 'Too many attempts' });
    if (!row.reset_expires_at || new Date(row.reset_expires_at) < new Date()) return res.status(400).json({ error: 'OTP expired' });
    const ok = await bcrypt.compare(otp, row.reset_otp_hash || '');
    await pool.query(`UPDATE "Users" SET reset_attempts = reset_attempts + 1 WHERE id = $1`, [row.id]);
    if (!ok) return res.status(400).json({ error: 'Invalid OTP' });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/forgot/reset', async (req, res) => {
  const { email, otp, newPassword } = req.body || {};
  const emailLc = LOWER(email);
  if (!emailLc || !otp || !newPassword) return res.status(400).json({ error: 'email, otp and newPassword are required' });
  if (newPassword.length < 6) return res.status(422).json({ error: 'Password must be at least 6 characters' });
  try {
    const q = await pool.query(
      `SELECT id, reset_otp_hash, reset_expires_at, reset_attempts, reset_in_progress
       FROM "Users" WHERE LOWER(email) = $1`,
      [emailLc]
    );
    const row = q.rows[0];
    if (!row) return res.status(400).json({ error: 'Invalid request' });
    if (!row.reset_in_progress) return res.status(400).json({ error: 'No reset in progress' });
    if (row.reset_attempts >= MAX_VERIFY_ATTEMPTS) return res.status(429).json({ error: 'Too many attempts' });
    if (!row.reset_expires_at || new Date(row.reset_expires_at) < new Date()) return res.status(400).json({ error: 'OTP expired' });
    const ok = await bcrypt.compare(otp, row.reset_otp_hash || '');
    if (!ok) {
      await pool.query(`UPDATE "Users" SET reset_attempts = reset_attempts + 1 WHERE id = $1`, [row.id]);
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE "Users"
       SET password = $2,
           reset_otp_hash = NULL,
           reset_expires_at = NULL,
           reset_attempts = 0,
           reset_in_progress = FALSE
       WHERE id = $1`,
      [row.id, hashed]
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Reset failed' });
  }
});

router.get('/email/test', async (req, res) => {
  try {
    const to = req.query.to || process.env.SMTP_USER;
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Test Email',
      text: 'If you see this, your SMTP setup works.',
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

module.exports = router;
