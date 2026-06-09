const express = require('express');
const router = express.Router();
const db = require('../config/db');
const requireAdmin = require('../middleware/admin');

// ── REDIRECT ROOT → CARDS ─────────────────────────────
router.get('/', requireAdmin, (req, res) => res.redirect('/admin/cards'));

// ── CARDS (Questions + Outcomes) ──────────────────────
router.get('/cards', requireAdmin, async (req, res) => {
  const [questions] = await db.query('SELECT * FROM questions ORDER BY difficulty, id');
  const [outcomes]  = await db.query("SELECT * FROM card_outcomes ORDER BY type, name");
  res.render('admin/cards', {
    questions, outcomes, tab: 'cards',
    error: req.query.error || null, success: req.query.success || null
  });
});

// Questions CRUD
router.post('/questions/add', requireAdmin, async (req, res) => {
  const { difficulty, question_text, option_a, option_b, option_c, option_d, correct_ans, explanation } = req.body;
  if (!difficulty || !question_text || !option_a || !option_b || !option_c || !option_d || !correct_ans || !explanation)
    return res.redirect('/admin/cards?error=All fields are required.');
  try {
    await db.query(
      'INSERT INTO questions (difficulty,question_text,option_a,option_b,option_c,option_d,correct_ans,explanation) VALUES (?,?,?,?,?,?,?,?)',
      [difficulty, question_text, option_a, option_b, option_c, option_d, correct_ans, explanation]
    );
    res.redirect('/admin/cards?success=Question added.');
  } catch (err) { res.redirect('/admin/cards?error=Failed to add question.'); }
});

router.post('/questions/edit/:id', requireAdmin, async (req, res) => {
  const { difficulty, question_text, option_a, option_b, option_c, option_d, correct_ans, explanation } = req.body;
  await db.query(
    'UPDATE questions SET difficulty=?,question_text=?,option_a=?,option_b=?,option_c=?,option_d=?,correct_ans=?,explanation=? WHERE id=?',
    [difficulty, question_text, option_a, option_b, option_c, option_d, correct_ans, explanation, req.params.id]
  );
  res.redirect('/admin/cards?success=Question updated.');
});

router.post('/questions/delete/:id', requireAdmin, async (req, res) => {
  await db.query('DELETE FROM questions WHERE id=?', [req.params.id]);
  res.redirect('/admin/cards?success=Question deleted.');
});

// Card Outcomes CRUD
router.post('/outcomes/add', requireAdmin, async (req, res) => {
  const { type, name, description, effect_type, effect_value, weight } = req.body;
  if (!type || !name || !description || !effect_type)
    return res.redirect('/admin/cards?error=All outcome fields are required.');
  try {
    await db.query(
      'INSERT INTO card_outcomes (type,name,description,effect_type,effect_value,weight) VALUES (?,?,?,?,?,?)',
      [type, name, description, effect_type, parseFloat(effect_value)||0, parseInt(weight)||10]
    );
    res.redirect('/admin/cards?success=Card outcome added.');
  } catch (err) { res.redirect('/admin/cards?error=Failed to add outcome.'); }
});

router.post('/outcomes/edit/:id', requireAdmin, async (req, res) => {
  const { type, name, description, effect_type, effect_value, weight } = req.body;
  await db.query(
    'UPDATE card_outcomes SET type=?,name=?,description=?,effect_type=?,effect_value=?,weight=? WHERE id=?',
    [type, name, description, effect_type, parseFloat(effect_value)||0, parseInt(weight)||10, req.params.id]
  );
  res.redirect('/admin/cards?success=Outcome updated.');
});

router.post('/outcomes/delete/:id', requireAdmin, async (req, res) => {
  await db.query('DELETE FROM card_outcomes WHERE id=?', [req.params.id]);
  res.redirect('/admin/cards?success=Outcome deleted.');
});

// ── PLAYERS (XP + Elixir only) ─────────────────────────
router.get('/players', requireAdmin, async (req, res) => {
  const [players] = await db.query('SELECT id,username,rank_name,xp,elixir FROM users WHERE is_admin = 0 ORDER BY xp DESC');
  res.render('admin/players', { players, tab: 'players', success: req.query.success || null });
});

router.post('/players/give/:id', requireAdmin, async (req, res) => {
  const { type, amount } = req.body;
  const val = parseInt(amount);
  if (!['xp','elixir'].includes(type) || isNaN(val) || val < 0)
    return res.redirect('/admin/players');
  await db.query(`UPDATE users SET ${type} = ${type} + ? WHERE id=?`, [val, req.params.id]);
  res.redirect('/admin/players?success=Given ' + val + ' ' + type + '.');
});

router.post('/players/set/:id', requireAdmin, async (req, res) => {
  const { type, amount } = req.body;
  const val = parseInt(amount);
  if (!['xp','elixir'].includes(type) || isNaN(val) || val < 0)
    return res.redirect('/admin/players');
  await db.query(`UPDATE users SET ${type} = ? WHERE id=?`, [val, req.params.id]);
  res.redirect('/admin/players?success=Set ' + type + ' to ' + val + '.');
});

module.exports = router;
