const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireLogin } = require('../middleware/auth');

const RANKS = [
  { name: 'Code Initiate',  minXp: 0,   maxXp: 99,  attrPoints: 0 },
  { name: 'Spellbinder',    minXp: 100, maxXp: 299, attrPoints: 2 },
  { name: 'Arcane Scholar', minXp: 300, maxXp: 599, attrPoints: 2 },
  { name: 'Grand Archmage', minXp: 600, maxXp: null, attrPoints: 2 },
];

async function syncRank(userId) {
  const [rows] = await db.query('SELECT xp, rank_name, attr_points FROM users WHERE id = ?', [userId]);
  const user = rows[0];
  const newRank = [...RANKS].reverse().find(r => user.xp >= r.minXp);
  if (newRank && newRank.name !== user.rank_name) {
    // Count how many ranks were gained
    const oldRankIdx = RANKS.findIndex(r => r.name === user.rank_name);
    const newRankIdx = RANKS.findIndex(r => r.name === newRank.name);
    let pointsGained = 0;
    for (let i = oldRankIdx + 1; i <= newRankIdx; i++) {
      pointsGained += RANKS[i].attrPoints;
    }
    await db.query(
      'UPDATE users SET rank_name = ?, attr_points = attr_points + ? WHERE id = ?',
      [newRank.name, pointsGained, userId]
    );
    return { ranked_up: true, new_rank: newRank.name, points_gained: pointsGained };
  }
  return { ranked_up: false };
}

router.get('/', requireLogin, async (req, res) => {
  try {
    const rankUp = await syncRank(req.session.user.id);

    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    const user = rows[0];

    // Sync session
    req.session.user = { ...req.session.user, ...user };

    // Game stats
    const [statsRows] = await db.query(`
      SELECT
        COUNT(DISTINCT g.id) AS games_played,
        COUNT(DISTINCT CASE WHEN g.winner_id = ? THEN g.id END) AS wins,
        SUM(CASE WHEN gs.is_correct = TRUE THEN 1 ELSE 0 END) AS correct_answers,
        COUNT(CASE WHEN gs.outcome_type = 'question' THEN 1 END) AS questions_answered
      FROM games g
      LEFT JOIN game_sessions gs ON gs.game_id = g.id AND gs.user_id = ?
      WHERE g.player1_id = ? OR g.player2_id = ?
    `, [user.id, user.id, user.id, user.id]);
    const stats = statsRows[0];

    // XP progress for current rank
    const currentRank = RANKS.find(r => r.name === user.rank_name) || RANKS[0];
    const nextRank = RANKS[RANKS.indexOf(currentRank) + 1] || null;
    const xpIntoRank = user.xp - currentRank.minXp;
    const xpNeeded = nextRank ? nextRank.minXp - currentRank.minXp : null;
    const xpPercent = xpNeeded ? Math.min((xpIntoRank / xpNeeded) * 100, 100) : 100;

    res.render('profile', { user, stats, currentRank, nextRank, xpIntoRank, xpNeeded, xpPercent, rankUp });
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

// Spend attribute point
router.post('/attribute', requireLogin, async (req, res) => {
  const { stat } = req.body;
  const allowed = ['damage_attr', 'defense_attr', 'agility_attr'];
  if (!allowed.includes(stat)) return res.redirect('/profile');

  try {
    const [rows] = await db.query('SELECT attr_points FROM users WHERE id = ?', [req.session.user.id]);
    if (rows[0].attr_points < 1) return res.redirect('/profile');

    await db.query(
      `UPDATE users SET ${stat} = ${stat} + 1, attr_points = attr_points - 1 WHERE id = ?`,
      [req.session.user.id]
    );
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.redirect('/profile');
  }
});

module.exports = router;
