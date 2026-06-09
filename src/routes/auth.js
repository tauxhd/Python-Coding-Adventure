const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../config/db');
const { requireGuest } = require('../middleware/auth');

router.get('/', (req, res) => res.redirect('/login'));

router.get('/login', requireGuest, (req, res) => {
  res.render('login', { error: req.query.error || null, success: req.query.success || null });
});

router.get('/register', requireGuest, (req, res) => {
  res.render('register', { error: req.query.error || null });
});

router.post('/register', requireGuest, async (req, res) => {
  const { username, email, password, confirm_password } = req.body;

  if (!username || !email || !password || !confirm_password)
    return res.redirect('/register?error=All fields are required.');

  if (username.length < 3 || username.length > 20)
    return res.redirect('/register?error=Username must be 3–20 characters.');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.redirect('/register?error=Invalid email address.');

  if (password.length < 6)
    return res.redirect('/register?error=Password must be at least 6 characters.');

  if (password !== confirm_password)
    return res.redirect('/register?error=Passwords do not match.');

  try {
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? OR username = ?', [email, username]
    );
    if (existing.length > 0)
      return res.redirect('/register?error=Username or email already taken.');

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hash]
    );

    res.redirect('/login?success=Account created! You can now log in.');
  } catch (err) {
    console.error(err);
    res.redirect('/register?error=Something went wrong. Please try again.');
  }
});

router.post('/login', requireGuest, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.redirect('/login?error=Please fill in all fields.');

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0)
      return res.redirect('/login?error=Invalid email or password.');

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.redirect('/login?error=Invalid email or password.');

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      rank_name: user.rank_name,
      xp: user.xp,
      elixir: user.elixir,
      damage_attr: user.damage_attr,
      defense_attr: user.defense_attr,
      agility_attr: user.agility_attr,
      is_admin: user.is_admin,
    };

    res.redirect(user.is_admin ? '/admin/cards' : '/profile');
  } catch (err) {
    console.error(err);
    res.redirect('/login?error=Something went wrong. Please try again.');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
