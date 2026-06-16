const express = require('express');
const db = require('../config/db');
const { requireLogin } = require('../middleware/auth');
const QRCode = require('qrcode');

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Shared join logic used by both GET /join (QR scan) and POST /join (form)
async function performJoin(req, res, roomCode, io) {
  try {
    const [rows] = await db.query(`
      SELECT g.*, p1.username AS p1_username, p1.rank_name AS p1_rank
      FROM games g
      JOIN users p1 ON g.player1_id = p1.id
      WHERE g.room_code = ?
    `, [roomCode]);

    if (rows.length === 0)
      return res.redirect('/game/lobby?error=Room not found. Check the code and try again.');

    const game = rows[0];

    if (game.status !== 'waiting')
      return res.redirect('/game/lobby?error=That game has already started or finished.');

    if (game.player1_id === req.session.user.id)
      return res.redirect(`/game/room/${roomCode}`);

    await db.query(
      'UPDATE games SET player2_id = ?, status = ?, current_turn_id = ? WHERE room_code = ?',
      [req.session.user.id, 'active', game.player1_id, roomCode]
    );

    await db.query(
      'INSERT INTO game_state (game_id, user_id) VALUES (?, ?)',
      [game.id, req.session.user.id]
    );

    // Load equipped cards for both players into active_powerups
    const [gameRows] = await db.query('SELECT id FROM games WHERE room_code = ?', [roomCode]);
    const gameId = gameRows[0].id;
    for (const playerId of [game.player1_id, req.session.user.id]) {
      const [ec] = await db.query(
        'SELECT slot_1_item_id, slot_2_item_id, slot_3_item_id FROM equipped_cards WHERE user_id = ?',
        [playerId]
      );
      const slots = ec.length > 0
        ? [ec[0].slot_1_item_id, ec[0].slot_2_item_id, ec[0].slot_3_item_id].filter(Boolean)
        : [];
      for (const itemId of slots) {
        await db.query(
          'INSERT IGNORE INTO active_powerups (game_id, user_id, item_id, cooldown_remaining) VALUES (?, ?, ?, 0)',
          [gameId, playerId, itemId]
        );
      }
    }

    io.to(roomCode).emit('game-ready', {
      roomCode,
      p1: game.p1_username,
      p2: req.session.user.username,
    });

    res.redirect(`/game/room/${roomCode}`);
  } catch (err) {
    console.error(err);
    res.redirect('/game/lobby?error=Could not join game. Try again.');
  }
}

module.exports = function (io) {
  const router = express.Router();

  // Main lobby page
  router.get('/lobby', requireLogin, async (req, res) => {
    const [ec] = await db.query(
      'SELECT slot_1_item_id, slot_2_item_id, slot_3_item_id FROM equipped_cards WHERE user_id = ?',
      [req.session.user.id]
    );
    const equipped = ec.length > 0 ? [ec[0].slot_1_item_id, ec[0].slot_2_item_id, ec[0].slot_3_item_id].filter(Boolean) : [];
    res.render('lobby', { error: req.query.error || null, equippedCount: equipped.length });
  });

  // Create a new game room
  router.post('/create', requireLogin, async (req, res) => {
    try {
      let roomCode, exists;
      do {
        roomCode = generateRoomCode();
        const [rows] = await db.query('SELECT id FROM games WHERE room_code = ?', [roomCode]);
        exists = rows.length > 0;
      } while (exists);

      await db.query(
        'INSERT INTO games (room_code, player1_id, status) VALUES (?, ?, ?)',
        [roomCode, req.session.user.id, 'waiting']
      );

      await db.query(
        'INSERT INTO game_state (game_id, user_id) VALUES ((SELECT id FROM games WHERE room_code = ?), ?)',
        [roomCode, req.session.user.id]
      );

      res.redirect(`/game/room/${roomCode}`);
    } catch (err) {
      console.error(err);
      res.redirect('/game/lobby?error=Could not create game. Try again.');
    }
  });

  // Join via QR code (GET from scanned QR)
  router.get('/join', requireLogin, (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/game/lobby?error=No room code provided.');
    return performJoin(req, res, code.toUpperCase(), io);
  });

  // Join an existing game room (POST with form)
  router.post('/join', requireLogin, (req, res) => {
    const { room_code } = req.body;
    if (!room_code) return res.redirect('/game/lobby?error=Please enter a room code.');
    return performJoin(req, res, room_code.toUpperCase(), io);
  });

  // Waiting room / game room page
  router.get('/room/:roomCode', requireLogin, async (req, res) => {
    const { roomCode } = req.params;
    try {
      const [rows] = await db.query(`
        SELECT g.*,
          p1.username AS p1_username, p1.rank_name AS p1_rank,
          p2.username AS p2_username, p2.rank_name AS p2_rank
        FROM games g
        JOIN users p1 ON g.player1_id = p1.id
        LEFT JOIN users p2 ON g.player2_id = p2.id
        WHERE g.room_code = ?
      `, [roomCode]);

      if (rows.length === 0) return res.redirect('/game/lobby?error=Room not found.');

      const game = rows[0];
      const isPlayer = game.player1_id === req.session.user.id || game.player2_id === req.session.user.id;
      if (!isPlayer) return res.redirect('/game/lobby?error=You are not in this game.');

      // Generate QR code for joining (only if waiting for player 2)
      let qrCodeUrl = null;
      if (!game.player2_id) {
        const joinUrl = `${req.protocol}://${req.get('host')}/game/join?code=${roomCode}`;
        qrCodeUrl = await QRCode.toDataURL(joinUrl, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          width: 240,
          margin: 2,
          color: { dark: '#1a1a2e', light: '#f5f5f5' }
        });
      }

      res.render('room', { game, roomCode, qrCodeUrl });
    } catch (err) {
      console.error(err);
      res.redirect('/game/lobby?error=Something went wrong.');
    }
  });

  // Game play page
  router.get('/play/:roomCode', requireLogin, async (req, res) => {
    const { roomCode } = req.params;
    try {
      const [games] = await db.query(`
        SELECT g.*,
          p1.username AS p1_username, p1.rank_name AS p1_rank,
          p2.username AS p2_username, p2.rank_name AS p2_rank
        FROM games g
        JOIN users p1 ON g.player1_id = p1.id
        JOIN users p2 ON g.player2_id = p2.id
        WHERE g.room_code = ? AND g.status = 'active'
      `, [roomCode]);

      if (!games.length) return res.redirect('/game/lobby?error=Game not found.');
      const game = games[0];

      const isPlayer = game.player1_id === req.session.user.id || game.player2_id === req.session.user.id;
      if (!isPlayer) return res.redirect('/game/lobby?error=You are not in this game.');

      const [states] = await db.query(
        'SELECT * FROM game_state WHERE game_id = ?', [game.id]
      );

      const [boardSpaces] = await db.query('SELECT * FROM board_spaces ORDER BY space_number');

      const [myItems] = await db.query(`
        SELECT ap.id, ap.item_id, ap.cooldown_remaining, ap.is_used, si.name, si.description, si.effect_type, si.cooldown_turns
        FROM active_powerups ap
        JOIN shop_items si ON ap.item_id = si.id
        WHERE ap.game_id = ? AND ap.user_id = ? AND ap.is_used = FALSE
        ORDER BY si.cooldown_turns ASC
      `, [games[0].id, req.session.user.id]);

      const autoscan = req.query.autoscan === '1';
      res.render('game', { game, states, boardSpaces, myItems, roomCode, currentUserId: req.session.user.id, autoscan });
    } catch (err) {
      console.error(err);
      res.redirect('/game/lobby?error=Something went wrong.');
    }
  });

  // Physical board QR code redirect — scanned from the printed board QR
  router.get('/scan-qr', requireLogin, async (req, res) => {
    const userId = req.session.user.id;
    try {
      const [rows] = await db.query(`
        SELECT g.room_code, g.current_turn_id
        FROM games g
        JOIN game_state gs ON g.id = gs.game_id AND gs.user_id = ?
        WHERE g.status = 'active' AND (g.player1_id = ? OR g.player2_id = ?)
        LIMIT 1
      `, [userId, userId, userId]);

      if (!rows.length) {
        return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scan Card</title><style>body{font-family:sans-serif;text-align:center;padding:2rem;background:#0a0a1a;color:#fff}h2{color:#f0c040}p{color:#aaa}</style></head><body><h2>No Active Game</h2><p>Start a game first, then scan this code when you land on a card space.</p></body></html>`);
      }

      const { room_code, current_turn_id } = rows[0];

      if (current_turn_id !== userId) {
        return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scan Card</title><style>body{font-family:sans-serif;text-align:center;padding:2rem;background:#0a0a1a;color:#fff}h2{color:#f0c040}p{color:#aaa}</style></head><body><h2>Not Your Turn</h2><p>Wait for your turn, then scan the board QR code when you land on a card space.</p></body></html>`);
      }

      res.redirect(`/game/play/${room_code}?autoscan=1`);
    } catch (err) {
      console.error(err);
      res.redirect('/game/lobby');
    }
  });

  // Printable board QR code page
  router.get('/scan-qr-print', requireLogin, async (req, res) => {
    const scanUrl = `${req.protocol}://${req.get('host')}/game/scan-qr`;
    const qrDataUrl = await QRCode.toDataURL(scanUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.render('scan-qr-print', { qrDataUrl, scanUrl });
  });

  return router;
};
