const db = require('../config/db');

async function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  const [rows] = await db.query('SELECT is_admin FROM users WHERE id = ?', [req.session.user.id]);
  if (!rows.length || !rows[0].is_admin) return res.status(403).render('403');
  next();
}

module.exports = requireAdmin;
