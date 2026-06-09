const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireLogin } = require('../middleware/auth');

router.get('/', requireLogin, async (req, res) => {
  try {
    const [players] = await db.query(`
      SELECT
        u.id, u.username, u.rank_name, u.xp, u.elixir,
        u.damage_attr, u.defense_attr, u.agility_attr,
        COUNT(DISTINCT g.id)                                          AS games_played,
        COUNT(DISTINCT CASE WHEN g.winner_id = u.id THEN g.id END)    AS wins,
        SUM(CASE WHEN gs.is_correct = TRUE THEN 1 ELSE 0 END)        AS correct_answers
      FROM users u
      LEFT JOIN games g ON g.player1_id = u.id OR g.player2_id = u.id
      LEFT JOIN game_sessions gs ON gs.user_id = u.id
      WHERE u.is_admin = 0
      GROUP BY u.id
      ORDER BY u.xp DESC, wins DESC
    `);

    res.render('leaderboard', { players, currentUserId: req.session.user.id });
  } catch (err) {
    console.error(err);
    res.redirect('/profile');
  }
});

module.exports = router;
