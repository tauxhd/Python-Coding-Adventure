const db = require('../config/db');

const BOARD = {
  3:  { type: 'blessing',  effect: 'gain_elixir', value: 10 },
  5:  { type: 'cursed',    effect: 'skip_turn',   value: 0  },
  7:  { type: 'shortcut',  effect: 'jump',        value: 12 },
  9:  { type: 'scan' },
  11: { type: 'blessing',  effect: 'gain_elixir', value: 10 },
  13: { type: 'cursed',    effect: 'skip_turn',   value: 0  },
  16: { type: 'scan' },
  20: { type: 'goal' },
};

async function getPlayerItems(gameId, userId) {
  const [rows] = await db.query(`
    SELECT ap.id, ap.item_id, ap.cooldown_remaining, ap.is_used, si.name, si.effect_type, si.cooldown_turns, si.description
    FROM active_powerups ap
    JOIN shop_items si ON ap.item_id = si.id
    WHERE ap.game_id = ? AND ap.user_id = ? AND ap.is_used = FALSE
    ORDER BY si.cooldown_turns ASC
  `, [gameId, userId]);
  return rows;
}

async function reduceCooldowns(gameId, userId) {
  await db.query(
    'UPDATE active_powerups SET cooldown_remaining = GREATEST(cooldown_remaining - 1, 0) WHERE game_id = ? AND user_id = ? AND cooldown_remaining > 0',
    [gameId, userId]
  );
}

// Tick poison/fog/frost at the start of the player's turn.
async function tickStatusEffects(gameId, userId, roomCode, io, username) {
  const [rows] = await db.query(
    'SELECT poison_turns, fog_turns, frost_turns FROM game_state WHERE game_id = ? AND user_id = ?',
    [gameId, userId]
  );
  if (!rows.length) return;
  const { poison_turns, fog_turns, frost_turns } = rows[0];

  if (poison_turns > 0) {
    const loss = 5;
    await db.query(
      'UPDATE game_state SET poison_turns = poison_turns - 1, elixir_this_game = GREATEST(elixir_this_game - ?, 0) WHERE game_id = ? AND user_id = ?',
      [loss, gameId, userId]
    );
    await db.query('UPDATE users SET elixir = GREATEST(elixir - ?, 0) WHERE id = ?', [loss, userId]);
    io.to(roomCode).emit('status-effect', {
      userId, type: 'poison',
      message: `${username} lost ${loss} elixir from poison!`
    });
  }
  if (fog_turns > 0) {
    await db.query(
      'UPDATE game_state SET fog_turns = fog_turns - 1 WHERE game_id = ? AND user_id = ?',
      [gameId, userId]
    );
  }
  if (frost_turns > 0) {
    await db.query(
      'UPDATE game_state SET frost_turns = frost_turns - 1 WHERE game_id = ? AND user_id = ?',
      [gameId, userId]
    );
  }
}

// Ends the current player's turn. Handles extra_turn_pending before switching.
async function endTurn(gameId, player1Id, player2Id, userId, io, roomCode) {
  const [stateRows] = await db.query(
    'SELECT extra_turn_pending FROM game_state WHERE game_id = ? AND user_id = ?',
    [gameId, userId]
  );
  const extraPending = stateRows[0]?.extra_turn_pending;

  if (extraPending) {
    await db.query(
      'UPDATE game_state SET extra_turn_pending = FALSE, item_used_this_turn = FALSE WHERE game_id = ? AND user_id = ?',
      [gameId, userId]
    );
    await db.query('UPDATE games SET current_turn_id = ? WHERE id = ?', [userId, gameId]);
    io.to(roomCode).emit('extra-turn-granted', { userId });
    return userId;
  }

  await reduceCooldowns(gameId, userId);
  const nextTurn = userId === player1Id ? player2Id : player1Id;
  await db.query('UPDATE games SET current_turn_id = ? WHERE id = ?', [nextTurn, gameId]);
  await db.query(
    'UPDATE game_state SET item_used_this_turn = FALSE WHERE game_id = ? AND user_id = ?',
    [gameId, nextTurn]
  );
  return nextTurn;
}

async function getGameState(roomCode) {
  const [games] = await db.query(`
    SELECT g.*,
      p1.username AS p1_username, p1.rank_name AS p1_rank, p1.agility_attr AS p1_agility,
      p2.username AS p2_username, p2.rank_name AS p2_rank, p2.agility_attr AS p2_agility
    FROM games g
    JOIN users p1 ON g.player1_id = p1.id
    JOIN users p2 ON g.player2_id = p2.id
    WHERE g.room_code = ?
  `, [roomCode]);
  if (!games.length) return null;
  const game = games[0];

  const [states] = await db.query('SELECT * FROM game_state WHERE game_id = ?', [game.id]);
  const p1State = states.find(s => s.user_id === game.player1_id);
  const p2State = states.find(s => s.user_id === game.player2_id);

  return { game, p1State, p2State };
}

async function getRandomCardOutcome(forcedDifficulty = null) {
  const roll = Math.random() * 100;
  let type = roll < 55 ? 'question' : roll < 85 ? 'trap' : 'windfall';

  if (type === 'question') {
    const difficulty = forcedDifficulty || (() => {
      const r = Math.random() * 100;
      return r < 55 ? 'common' : r < 85 ? 'rare' : 'legendary';
    })();
    const [rows] = await db.query(
      'SELECT * FROM questions WHERE difficulty = ? ORDER BY RAND() LIMIT 1', [difficulty]
    );
    return { type: 'question', difficulty, question: rows[0] };
  }

  if (type === 'trap') {
    const [rows] = await db.query(
      "SELECT * FROM card_outcomes WHERE type = 'trap' ORDER BY RAND() LIMIT 1"
    );
    return { type: 'trap', outcome: rows[0] };
  }

  const [rows] = await db.query(
    "SELECT * FROM card_outcomes WHERE type = 'windfall' ORDER BY RAND() LIMIT 1"
  );
  return { type: 'windfall', outcome: rows[0] };
}

function initGameSocket(io) {
  io.on('connection', (socket) => {

    socket.on('join-room', ({ roomCode }) => {
      socket.join(roomCode);
    });

    // ── ROLL DICE ──────────────────────────────────────────
    socket.on('roll-dice', async ({ roomCode }) => {
      try {
        const { game } = await getGameState(roomCode);
        if (!game || game.current_turn_id !== socket.request.session?.user?.id) return;

        const userId = socket.request.session.user.id;
        const username = socket.request.session.user.username;

        // Tick status effects (poison/fog/frost) at the start of this turn
        await tickStatusEffects(game.id, userId, roomCode, io, username);

        // Re-read state after ticks so skip/position/flags are current
        const [freshStates] = await db.query('SELECT * FROM game_state WHERE game_id = ?', [game.id]);
        const myState = freshStates.find(s => s.user_id === userId);

        // Check if player must skip
        if (myState.skip_next_turn) {
          await db.query(
            'UPDATE game_state SET skip_next_turn = FALSE WHERE game_id = ? AND user_id = ?',
            [game.id, userId]
          );
          const nextTurn = userId === game.player1_id ? game.player2_id : game.player1_id;
          await db.query('UPDATE games SET current_turn_id = ? WHERE id = ?', [nextTurn, game.id]);
          io.to(roomCode).emit('turn-skipped', { skippedUserId: userId, nextTurnId: nextTurn });
          return;
        }

        // Agility: roll twice and take the higher result if agility_attr > 0
        const myAgility = game.player1_id === userId ? game.p1_agility : game.p2_agility;
        let dice;
        if (myAgility > 0) {
          const roll1 = Math.floor(Math.random() * 6) + 1;
          const roll2 = Math.floor(Math.random() * 6) + 1;
          dice = Math.max(roll1, roll2);
        } else {
          dice = Math.floor(Math.random() * 6) + 1;
        }

        let newPos = Math.min(myState.position + dice, 20);
        const spaceInfo = BOARD[newPos] || { type: 'safe' };
        let spaceEffect = null;

        if (spaceInfo.type === 'blessing') {
          await db.query(
            'UPDATE game_state SET position = ?, elixir_this_game = elixir_this_game + ? WHERE game_id = ? AND user_id = ?',
            [newPos, spaceInfo.value, game.id, userId]
          );
          await db.query('UPDATE users SET elixir = elixir + ? WHERE id = ?', [spaceInfo.value, userId]);
          spaceEffect = { type: 'blessing', message: `+${spaceInfo.value} Elixir!`, value: spaceInfo.value };

        } else if (spaceInfo.type === 'cursed') {
          if (myState.ghost_step_pending) {
            // Ghost Step: cancel the curse and consume the flag
            await db.query(
              'UPDATE game_state SET position = ?, ghost_step_pending = FALSE WHERE game_id = ? AND user_id = ?',
              [newPos, game.id, userId]
            );
            spaceEffect = { type: 'ghost_step', message: 'Ghost Step triggered — cursed space ignored!' };
          } else {
            await db.query(
              'UPDATE game_state SET position = ?, skip_next_turn = TRUE WHERE game_id = ? AND user_id = ?',
              [newPos, game.id, userId]
            );
            spaceEffect = { type: 'cursed', message: 'Cursed! Skip next turn.' };
          }

        } else if (spaceInfo.type === 'shortcut') {
          newPos = spaceInfo.value;
          await db.query(
            'UPDATE game_state SET position = ? WHERE game_id = ? AND user_id = ?',
            [newPos, game.id, userId]
          );
          spaceEffect = { type: 'shortcut', message: `Shortcut! Jumped to space ${newPos}.`, landedOn: newPos };

        } else if (spaceInfo.type === 'goal') {
          await db.query(
            'UPDATE game_state SET position = 0 WHERE game_id = ? AND user_id = ?',
            [game.id, userId]
          );
          newPos = 0;

          const opponentId = userId === game.player1_id ? game.player2_id : game.player1_id;
          const [attacker] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
          let baseDamage = 1 + (attacker[0].damage_attr * 0.5);

          // Double damage: check flag and consume it
          if (myState.double_damage_pending) {
            baseDamage *= 2;
            await db.query(
              'UPDATE game_state SET double_damage_pending = FALSE WHERE game_id = ? AND user_id = ?',
              [game.id, userId]
            );
          }

          const [defender] = await db.query('SELECT * FROM users WHERE id = ?', [opponentId]);
          const damageReduction = defender[0].defense_attr * 0.5;
          const finalDamage = Math.max(0.5, baseDamage - damageReduction);

          await db.query(
            'UPDATE game_state SET hp = GREATEST(hp - ?, 0) WHERE game_id = ? AND user_id = ?',
            [finalDamage, game.id, opponentId]
          );

          const [opState] = await db.query(
            'SELECT hp FROM game_state WHERE game_id = ? AND user_id = ?', [game.id, opponentId]
          );

          spaceEffect = { type: 'goal', message: `LAP COMPLETE! Dealt ${finalDamage.toFixed(1)} damage!`, damage: finalDamage, opponentId };

          if (opState[0].hp <= 0) {
            await db.query('UPDATE games SET status = ?, winner_id = ? WHERE id = ?', ['finished', userId, game.id]);
            await db.query('UPDATE users SET xp = xp + 15 WHERE id = ?', [userId]);
            await db.query('UPDATE users SET xp = xp + 2 WHERE id = ?', [opponentId]);
            const { game: g2, p1State: p1, p2State: p2 } = await getGameState(roomCode);
            io.to(roomCode).emit('game-over', { winnerId: userId, state: { game: g2, p1State: p1, p2State: p2 } });
            return;
          }

        } else if (spaceInfo.type === 'scan') {
          await db.query(
            'UPDATE game_state SET position = ? WHERE game_id = ? AND user_id = ?',
            [newPos, game.id, userId]
          );
          const { game: g2, p1State: p1, p2State: p2 } = await getGameState(roomCode);
          io.to(roomCode).emit('game-state-update', { game: g2, p1State: p1, p2State: p2, dice, movedUserId: userId, newPos });
          io.to(roomCode).emit('prompt-scan', { userId });
          return;

        } else {
          await db.query(
            'UPDATE game_state SET position = ? WHERE game_id = ? AND user_id = ?',
            [newPos, game.id, userId]
          );
        }

        await endTurn(game.id, game.player1_id, game.player2_id, userId, io, roomCode);

        const { game: g2, p1State: p1, p2State: p2 } = await getGameState(roomCode);
        const myItemsUpdated = await getPlayerItems(game.id, userId);
        io.to(roomCode).emit('game-state-update', { game: g2, p1State: p1, p2State: p2, dice, movedUserId: userId, newPos, spaceEffect });
        socket.emit('items-update', { items: myItemsUpdated });

      } catch (err) { console.error('roll-dice error:', err); }
    });

    // ── SCAN CARD ──────────────────────────────────────────
    socket.on('scan-card', async ({ roomCode }) => {
      try {
        const { game } = await getGameState(roomCode);
        if (!game) return;
        const userId = socket.request.session?.user?.id;
        if (game.current_turn_id !== userId) return;

        // Time Warp: skip the card draw entirely and end turn
        const [twRows] = await db.query(
          'SELECT time_warp_pending FROM game_state WHERE game_id = ? AND user_id = ?',
          [game.id, userId]
        );
        if (twRows[0]?.time_warp_pending) {
          await db.query(
            'UPDATE game_state SET time_warp_pending = FALSE WHERE game_id = ? AND user_id = ?',
            [game.id, userId]
          );
          socket.emit('time-warp-used', { message: 'Time Warp activated — card skipped!' });
          await endTurn(game.id, game.player1_id, game.player2_id, userId, io, roomCode);
          const { game: g2, p1State: p1, p2State: p2 } = await getGameState(roomCode);
          setTimeout(() => io.to(roomCode).emit('game-state-update', { game: g2, p1State: p1, p2State: p2 }), 1500);
          return;
        }

        // Check if cursed scroll is active on this player (forced legendary)
        const [curseRows] = await db.query(`
          SELECT ap.* FROM active_powerups ap
          JOIN shop_items si ON ap.item_id = si.id
          WHERE ap.game_id = ? AND ap.user_id = ? AND si.effect_type = 'curse_scroll' AND ap.is_used = FALSE
        `, [game.id, userId]);

        const forceDifficulty = curseRows.length > 0 ? 'legendary' : null;
        if (forceDifficulty) {
          await db.query('UPDATE active_powerups SET is_used = TRUE WHERE id = ?', [curseRows[0].id]);
        }

        const cardResult = await getRandomCardOutcome(forceDifficulty);

        if (cardResult.type === 'question') {
          const q = cardResult.question;
          const [hintRows] = await db.query(`
            SELECT ap.* FROM active_powerups ap
            JOIN shop_items si ON ap.item_id = si.id
            WHERE ap.game_id = ? AND ap.user_id = ? AND si.effect_type = 'hint' AND ap.is_used = FALSE
          `, [game.id, userId]);

          let hiddenOptions = [];
          if (hintRows.length > 0) {
            await db.query('UPDATE active_powerups SET is_used = TRUE WHERE id = ?', [hintRows[0].id]);
            const wrongOpts = ['a','b','c','d'].filter(o => o !== q.correct_ans);
            hiddenOptions = wrongOpts.sort(() => 0.5 - Math.random()).slice(0, 2);
          }

          socket.emit('show-question', {
            questionId: q.id, difficulty: cardResult.difficulty,
            text: q.question_text,
            options: { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d },
            hiddenOptions,
          });
          socket.to(roomCode).emit('opponent-answering', { userId });

        } else {
          await applyOutcome(cardResult.outcome, game, userId, roomCode, io);
        }

      } catch (err) { console.error('scan-card error:', err); }
    });

    // ── SUBMIT ANSWER ──────────────────────────────────────
    socket.on('submit-answer', async ({ roomCode, questionId, answer, difficulty }) => {
      try {
        const { game } = await getGameState(roomCode);
        if (!game) return;
        const userId = socket.request.session?.user?.id;

        const [qRows] = await db.query('SELECT * FROM questions WHERE id = ?', [questionId]);
        if (!qRows.length) return;
        const q = qRows[0];
        const correct = answer === q.correct_ans;

        const elixirMap = { common: 5, rare: 15, legendary: 30 };
        let elixirEarned = 0;

        if (correct) {
          elixirEarned = elixirMap[difficulty] || 5;

          const [surgeRows] = await db.query(`
            SELECT ap.* FROM active_powerups ap
            JOIN shop_items si ON ap.item_id = si.id
            WHERE ap.game_id = ? AND ap.user_id = ? AND si.effect_type = 'elixir_surge' AND ap.is_used = FALSE
          `, [game.id, userId]);
          if (surgeRows.length > 0) {
            elixirEarned *= 2;
            await db.query('UPDATE active_powerups SET is_used = TRUE WHERE id = ?', [surgeRows[0].id]);
          }

          await db.query(
            'UPDATE game_state SET elixir_this_game = elixir_this_game + ? WHERE game_id = ? AND user_id = ?',
            [elixirEarned, game.id, userId]
          );
          await db.query('UPDATE users SET elixir = elixir + ?, xp = xp + 5 WHERE id = ?', [elixirEarned, userId]);
        } else {
          await db.query('UPDATE users SET xp = xp + 1 WHERE id = ?', [userId]);
        }

        await db.query(`
          INSERT INTO game_sessions (game_id, user_id, question_id, answer_given, is_correct, elixir_earned, outcome_type)
          VALUES (?, ?, ?, ?, ?, ?, 'question')
        `, [game.id, userId, questionId, answer, correct, elixirEarned]);

        socket.emit('answer-feedback', {
          correct, answer, correctAnswer: q.correct_ans,
          explanation: q.explanation, elixirEarned,
        });

        await endTurn(game.id, game.player1_id, game.player2_id, userId, io, roomCode);

        const myItemsAfter = await getPlayerItems(game.id, userId);
        socket.emit('items-update', { items: myItemsAfter });

        const { game: g2, p1State: p1, p2State: p2 } = await getGameState(roomCode);
        setTimeout(() => {
          io.to(roomCode).emit('game-state-update', { game: g2, p1State: p1, p2State: p2 });
        }, 3500);

      } catch (err) { console.error('submit-answer error:', err); }
    });

    // ── USE ITEM ───────────────────────────────────────────
    socket.on('use-item', async ({ roomCode, apId }) => {
      try {
        const userId = socket.request.session?.user?.id;
        const { game, p1State, p2State } = await getGameState(roomCode);
        if (!game || game.current_turn_id !== userId) return;

        const myState  = game.player1_id === userId ? p1State : p2State;
        const oppState = game.player1_id === userId ? p2State : p1State;

        // One item per turn
        if (myState.item_used_this_turn) {
          socket.emit('item-error', { message: 'You can only use one item per turn.' });
          return;
        }

        // Frost: block item use while frozen
        if (myState.frost_turns > 0) {
          socket.emit('item-error', { message: `Frozen! Cannot use items for ${myState.frost_turns} more turn(s).` });
          return;
        }

        const [apRows] = await db.query(`
          SELECT ap.*, si.name, si.effect_type, si.effect_value, si.cooldown_turns, si.description
          FROM active_powerups ap
          JOIN shop_items si ON ap.item_id = si.id
          WHERE ap.id = ? AND ap.user_id = ? AND ap.game_id = ?
        `, [apId, userId, game.id]);

        if (!apRows.length || apRows[0].is_used || apRows[0].cooldown_remaining > 0) return;

        const item = apRows[0];
        const opponentId = userId === game.player1_id ? game.player2_id : game.player1_id;
        let message = `${socket.request.session.user.username} used ${item.name}!`;

        // Mirror: if opponent has mirror_active, opponent-targeting effects hit the caster instead
        const mirrorActive = oppState?.mirror_active || false;

        switch (item.effect_type) {
          case 'immunity':
            await db.query('UPDATE game_state SET skip_next_turn = FALSE WHERE game_id = ? AND user_id = ?', [game.id, userId]);
            message = `🛡️ Immunity Cloak activated!`;
            break;

          case 'double_damage':
            await db.query(
              'UPDATE game_state SET double_damage_pending = TRUE WHERE game_id = ? AND user_id = ?',
              [game.id, userId]
            );
            message = `⚔️ Double Damage ready — next lap deals 2x!`;
            break;

          case 'extra_turn':
            await db.query(
              'UPDATE game_state SET extra_turn_pending = TRUE WHERE game_id = ? AND user_id = ?',
              [game.id, userId]
            );
            message = `⏳ ${socket.request.session.user.username} will take an extra turn after this one!`;
            break;

          case 'fog': {
            // Mirror: fog yourself instead of the opponent
            const fogTarget = mirrorActive ? userId : opponentId;
            await db.query('UPDATE game_state SET fog_turns = 2 WHERE game_id = ? AND user_id = ?', [game.id, fogTarget]);
            message = mirrorActive
              ? `🌫️ Mirror reflected! Fog of War hit you instead!`
              : `🌫️ Fog of War! Opponent's position hidden for 2 turns.`;
            if (mirrorActive) await db.query('UPDATE game_state SET mirror_active = FALSE WHERE game_id = ? AND user_id = ?', [game.id, opponentId]);
            break;
          }

          case 'steal_elixir': {
            // Mirror: lose elixir to the opponent instead of gaining it
            const loser  = mirrorActive ? userId    : opponentId;
            const gainer = mirrorActive ? opponentId : userId;
            await db.query('UPDATE users SET elixir = GREATEST(elixir - 15, 0) WHERE id = ?', [loser]);
            await db.query('UPDATE users SET elixir = elixir + 15 WHERE id = ?', [gainer]);
            message = mirrorActive
              ? `💜 Mirror reflected! You lost 15 Elixir to your opponent!`
              : `💜 Stole 15 Elixir from opponent!`;
            if (mirrorActive) await db.query('UPDATE game_state SET mirror_active = FALSE WHERE game_id = ? AND user_id = ?', [game.id, opponentId]);
            break;
          }

          case 'reroll': {
            await db.query(
              'UPDATE game_state SET item_used_this_turn = TRUE WHERE game_id = ? AND user_id = ?',
              [game.id, userId]
            );
            await db.query('UPDATE active_powerups SET is_used = TRUE WHERE id = ?', [apId]);
            const rerollItems = await getPlayerItems(game.id, userId);
            socket.emit('items-update', { items: rerollItems });
            io.to(roomCode).emit('prompt-reroll', { userId, username: socket.request.session.user.username });
            return; // Turn does NOT end — player must roll again
          }

          case 'curse_scroll': {
            // Mirror: curse yourself instead of the opponent
            const curseTarget = mirrorActive ? userId : opponentId;
            await db.query(
              "INSERT IGNORE INTO active_powerups (game_id, user_id, item_id) SELECT ?, ?, id FROM shop_items WHERE effect_type = 'curse_scroll' LIMIT 1",
              [game.id, curseTarget]
            );
            message = mirrorActive
              ? `📜 Mirror reflected! Your own next card is forced Legendary!`
              : `📜 Opponent's next card is forced Legendary!`;
            if (mirrorActive) await db.query('UPDATE game_state SET mirror_active = FALSE WHERE game_id = ? AND user_id = ?', [game.id, opponentId]);
            break;
          }

          case 'hint':
            socket.emit('grant-hint');
            message = `🔮 Hint Stone ready for next question!`;
            break;

          case 'time_warp':
            await db.query(
              'UPDATE game_state SET time_warp_pending = TRUE WHERE game_id = ? AND user_id = ?',
              [game.id, userId]
            );
            socket.emit('grant-time-warp');
            message = `🕰️ Time Warp active — your next scan card will be skipped!`;
            break;

          case 'elixir_surge':
            socket.emit('grant-elixir-surge');
            message = `⚡ Next correct answer gives double Elixir!`;
            break;

          case 'ghost_step':
            await db.query(
              'UPDATE game_state SET ghost_step_pending = TRUE WHERE game_id = ? AND user_id = ?',
              [game.id, userId]
            );
            message = `👻 Ghost Step active — next cursed space will be ignored!`;
            break;
        }

        await db.query(
          'UPDATE game_state SET item_used_this_turn = TRUE WHERE game_id = ? AND user_id = ?',
          [game.id, userId]
        );
        await db.query('UPDATE active_powerups SET is_used = TRUE WHERE id = ?', [apId]);

        const updatedItems = await getPlayerItems(game.id, userId);
        socket.emit('items-update', { items: updatedItems });

        const { game: g2, p1State: p1, p2State: p2 } = await getGameState(roomCode);
        io.to(roomCode).emit('item-used', { userId, itemName: item.name, message });
        io.to(roomCode).emit('game-state-update', { game: g2, p1State: p1, p2State: p2 });

      } catch (err) { console.error('use-item error:', err); }
    });

    socket.on('disconnect', () => {});
  });
}

async function applyOutcome(outcome, game, userId, roomCode, io) {
  const opponentId = userId === game.player1_id ? game.player2_id : game.player1_id;
  let message = outcome.description;

  try {
    switch (outcome.effect_type) {
      case 'lose_hp':
        await db.query('UPDATE game_state SET hp = GREATEST(hp - ?, 0) WHERE game_id = ? AND user_id = ?', [outcome.effect_value, game.id, userId]);
        break;
      case 'poison':
        await db.query('UPDATE game_state SET poison_turns = ? WHERE game_id = ? AND user_id = ?', [2, game.id, userId]);
        break;
      case 'skip_turn':
        await db.query('UPDATE game_state SET skip_next_turn = TRUE WHERE game_id = ? AND user_id = ?', [game.id, userId]);
        break;
      case 'move_back':
        await db.query('UPDATE game_state SET position = GREATEST(position - ?, 0) WHERE game_id = ? AND user_id = ?', [outcome.effect_value, game.id, userId]);
        break;
      case 'lose_elixir':
        await db.query('UPDATE game_state SET elixir_this_game = GREATEST(elixir_this_game - ?, 0) WHERE game_id = ? AND user_id = ?', [outcome.effect_value, game.id, userId]);
        await db.query('UPDATE users SET elixir = GREATEST(elixir - ?, 0) WHERE id = ?', [outcome.effect_value, userId]);
        break;
      case 'void':
        await db.query('UPDATE game_state SET position = 1 WHERE game_id = ? AND user_id = ?', [game.id, userId]);
        break;
      case 'soul_drain':
        await db.query('UPDATE users SET elixir = GREATEST(elixir - ?, 0) WHERE id = ?', [outcome.effect_value, userId]);
        await db.query('UPDATE users SET elixir = elixir + ? WHERE id = ?', [outcome.effect_value, opponentId]);
        break;
      case 'frost':
        await db.query('UPDATE game_state SET frost_turns = ? WHERE game_id = ? AND user_id = ?', [outcome.effect_value, game.id, userId]);
        break;
      case 'mirror':
        await db.query('UPDATE game_state SET mirror_active = TRUE WHERE game_id = ? AND user_id = ?', [game.id, userId]);
        break;
      case 'gain_elixir':
        await db.query('UPDATE users SET elixir = elixir + ? WHERE id = ?', [outcome.effect_value, userId]);
        await db.query('UPDATE game_state SET elixir_this_game = elixir_this_game + ? WHERE game_id = ? AND user_id = ?', [outcome.effect_value, game.id, userId]);
        break;
      case 'move_forward':
        await db.query('UPDATE game_state SET position = LEAST(position + ?, 19) WHERE game_id = ? AND user_id = ?', [outcome.effect_value, game.id, userId]);
        break;
      case 'extra_turn':
        // Turn does not switch — handled in nextTurn logic below
        break;
      case 'move_opponent_back':
        await db.query('UPDATE game_state SET position = GREATEST(position - ?, 0) WHERE game_id = ? AND user_id = ?', [outcome.effect_value, game.id, opponentId]);
        break;
      case 'gain_xp':
        await db.query('UPDATE users SET xp = xp + ? WHERE id = ?', [outcome.effect_value, userId]);
        break;
    }

    await db.query(`
      INSERT INTO game_sessions (game_id, user_id, outcome_type, outcome_name, elixir_earned)
      VALUES (?, ?, ?, ?, 0)
    `, [game.id, userId, outcome.type, outcome.name]);

    const nextTurn = outcome.effect_type === 'extra_turn' ? userId : (userId === game.player1_id ? game.player2_id : game.player1_id);
    await db.query('UPDATE games SET current_turn_id = ? WHERE id = ?', [nextTurn, game.id]);

    const { game: g2, p1State: p1, p2State: p2 } = await getGameState(game.room_code);
    io.to(game.room_code).emit('card-outcome', { userId, outcome: { ...outcome }, message });
    setTimeout(() => {
      io.to(game.room_code).emit('game-state-update', { game: g2, p1State: p1, p2State: p2 });
    }, 2500);

  } catch (err) { console.error('applyOutcome error:', err); }
}

module.exports = initGameSocket;
