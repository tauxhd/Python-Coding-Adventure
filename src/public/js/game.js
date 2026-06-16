const socket = io();
socket.emit('join-room', { roomCode: ROOM_CODE });

let currentQuestionId = null;
let currentDifficulty = null;
let physicalDice = localStorage.getItem('paq_physical_dice') === 'true';
let isMyTurn = () => currentTurnId === CURRENT_USER_ID;

// ── Phase management ─────────────────────────────
function showPhase(id) {
  document.querySelectorAll('.action-phase').forEach(el => el.classList.add('hidden'));
  document.getElementById('phase-' + id).classList.remove('hidden');
}

function updateDicePhaseUI() {
  const digital = document.getElementById('digital-dice-controls');
  const physical = document.getElementById('physical-dice-controls');
  if (!digital || !physical) return;
  if (physicalDice) {
    digital.classList.add('hidden');
    physical.classList.remove('hidden');
  } else {
    digital.classList.remove('hidden');
    physical.classList.add('hidden');
  }
}

function updateTurnUI() {
  const ind = document.getElementById('turn-indicator');
  if (isMyTurn()) {
    ind.textContent = '⚔ Your Turn';
    ind.style.color = 'var(--gold)';
    showPhase('roll');
    document.getElementById('btn-roll').disabled = false;
    const confirmBtn = document.getElementById('btn-confirm-roll');
    if (confirmBtn) confirmBtn.disabled = false;
  } else {
    ind.textContent = "⏳ Opponent's Turn";
    ind.style.color = 'var(--text-muted)';
    showPhase('waiting');
  }
  updateDicePhaseUI();
  updateItemsTurnHint();
}

function setDicePreference(usePhysical) {
  physicalDice = usePhysical;
  localStorage.setItem('paq_physical_dice', usePhysical);
  document.getElementById('dice-pref-modal').classList.add('hidden');
  if (AUTO_SCAN && isMyTurn()) {
    updateDicePhaseUI();
    showPhase('scan');
    setTimeout(() => scanCard(), 800);
  } else {
    updateTurnUI();
  }
}

// ── Board token update ───────────────────────────
// oppPos of -1 means fogged (hidden by Fog of War)
function updateBoard(newMyPos, newOppPos) {
  document.querySelectorAll('.token').forEach(t => t.remove());

  myPos = newMyPos;
  oppPos = newOppPos;

  if (myPos > 0) {
    const mySpace = document.getElementById('space-' + myPos);
    if (mySpace) {
      const tokens = mySpace.querySelector('.space-tokens');
      const t = document.createElement('div');
      t.className = 'token token-me';
      t.title = MY_NAME;
      tokens.appendChild(t);
    }
  }
  if (oppPos > 0) {
    const oppSpace = document.getElementById('space-' + oppPos);
    if (oppSpace) {
      const tokens = oppSpace.querySelector('.space-tokens');
      const t = document.createElement('div');
      t.className = 'token token-opp';
      t.title = OPP_NAME;
      tokens.appendChild(t);
    }
  }
}

// ── HP update ────────────────────────────────────
function updateHP(p1State, p2State) {
  const meState  = IS_P1 ? p1State : p2State;
  const oppState = IS_P1 ? p2State : p1State;

  if (meState) {
    myHp = meState.hp;
    document.getElementById('hp-me').style.width = (myHp / 5 * 100) + '%';
    document.getElementById('hp-me-text').textContent = myHp + ' / 5 HP';
    document.getElementById('pos-me').textContent = meState.position;
  }
  if (oppState) {
    oppHp = oppState.hp;
    document.getElementById('hp-opp').style.width = (oppHp / 5 * 100) + '%';
    document.getElementById('hp-opp-text').textContent = oppHp + ' / 5 HP';
    // Fog of War: hide opponent position if their fog_turns > 0
    const oppFogged = oppState.fog_turns > 0;
    document.getElementById('pos-opp').textContent = oppFogged ? '?' : oppState.position;
  }

  if (meState && oppState) {
    const oppFogged = oppState.fog_turns > 0;
    updateBoard(meState.position, oppFogged ? -1 : oppState.position);
  }
}

// ── Event log ────────────────────────────────────
function addLog(msg, highlight = false) {
  const entries = document.getElementById('log-entries');
  const el = document.createElement('div');
  el.className = 'log-entry' + (highlight ? ' highlight' : '');
  el.textContent = msg;
  entries.prepend(el);
  if (entries.children.length > 20) entries.lastChild.remove();
}

// ── Dice roll ────────────────────────────────────
function rollDice() {
  document.getElementById('btn-roll').disabled = true;
  const diceEl = document.getElementById('dice-display');
  diceEl.classList.add('rolling');
  const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
  let i = 0;
  const spin = setInterval(() => {
    diceEl.textContent = faces[Math.floor(Math.random() * 6)];
    if (++i > 10) { clearInterval(spin); diceEl.classList.remove('rolling'); }
  }, 60);
  socket.emit('roll-dice', { roomCode: ROOM_CODE });
}

// ── Physical dice confirm ────────────────────────
function confirmPhysicalRoll() {
  const input = document.getElementById('physical-roll-input');
  const val = parseInt(input.value);
  if (!val || val < 1 || val > 6) {
    flashMessage('⚠️ Enter a number between 1 and 6');
    return;
  }
  document.getElementById('btn-confirm-roll').disabled = true;
  const faces = ['','⚀','⚁','⚂','⚃','⚄','⚅'];
  document.getElementById('dice-display').textContent = faces[val];
  socket.emit('roll-dice', { roomCode: ROOM_CODE, forcedRoll: val });
}

// ── Scan card ────────────────────────────────────
function scanCard() {
  socket.emit('scan-card', { roomCode: ROOM_CODE });
  showPhase('waiting');
  document.getElementById('waiting-text').textContent = 'Drawing from the card pile...';
}

// ── Submit answer ────────────────────────────────
function submitAnswer(answer) {
  // Disable all options
  document.querySelectorAll('.q-opt').forEach(b => b.disabled = true);
  socket.emit('submit-answer', {
    roomCode: ROOM_CODE,
    questionId: currentQuestionId,
    answer,
    difficulty: currentDifficulty,
  });
}

// ── Socket events ────────────────────────────────
socket.on('game-state-update', ({ game, p1State, p2State, dice, movedUserId, newPos, spaceEffect }) => {
  currentTurnId = game.current_turn_id;
  updateHP(p1State, p2State);

  if (dice && movedUserId) {
    const mover = movedUserId === CURRENT_USER_ID ? MY_NAME : OPP_NAME;
    const diceEl = document.getElementById('dice-display');
    const faces = ['','⚀','⚁','⚂','⚃','⚄','⚅'];
    diceEl.textContent = faces[dice] || '🎲';
    addLog(`${mover} rolled ${dice} → space ${newPos}`);
  }

  if (spaceEffect) {
    const mover = movedUserId === CURRENT_USER_ID ? MY_NAME : OPP_NAME;
    addLog(`${mover}: ${spaceEffect.message}`, true);
    if (spaceEffect.type === 'goal') {
      flashMessage(`💥 ${spaceEffect.message}`);
    }
  }

  updateTurnUI();
});

socket.on('turn-skipped', ({ skippedUserId, nextTurnId }) => {
  currentTurnId = nextTurnId;
  const skipped = skippedUserId === CURRENT_USER_ID ? 'You' : OPP_NAME;
  addLog(`${skipped} skipped their turn (cursed).`, true);
  updateTurnUI();
});

socket.on('prompt-scan', ({ userId }) => {
  if (userId === CURRENT_USER_ID) {
    showPhase('scan');
  } else {
    showPhase('waiting');
    document.getElementById('waiting-text').textContent = `${OPP_NAME} is drawing a card...`;
  }
});

socket.on('show-question', ({ questionId, difficulty, text, options, hiddenOptions }) => {
  currentQuestionId = questionId;
  currentDifficulty = difficulty;

  const diffEl = document.getElementById('q-difficulty');
  diffEl.textContent = difficulty.toUpperCase();
  diffEl.className = 'q-difficulty q-diff-' + difficulty;

  document.getElementById('q-text').textContent = text;

  const optsEl = document.getElementById('q-options');
  optsEl.innerHTML = '';
  ['a','b','c','d'].forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'q-opt' + (hiddenOptions.includes(key) ? ' hidden' : '');
    btn.textContent = key.toUpperCase() + '. ' + options[key];
    btn.onclick = () => submitAnswer(key);
    btn.dataset.key = key;
    optsEl.appendChild(btn);
  });

  showPhase('question');
});

socket.on('opponent-answering', ({ userId }) => {
  showPhase('waiting');
  document.getElementById('waiting-text').textContent = `${OPP_NAME} is answering a question...`;
});

socket.on('answer-feedback', ({ correct, answer, correctAnswer, explanation, elixirEarned }) => {
  // Highlight options
  document.querySelectorAll('.q-opt').forEach(btn => {
    if (btn.dataset.key === correctAnswer) btn.classList.add('correct');
    else if (btn.dataset.key === answer && !correct) btn.classList.add('wrong');
  });

  setTimeout(() => {
    document.getElementById('feedback-icon').textContent = correct ? '✅' : '❌';
    document.getElementById('feedback-msg').textContent = correct ? 'Correct!' : 'Wrong!';
    document.getElementById('feedback-msg').style.color = correct ? 'var(--green)' : 'var(--red)';
    document.getElementById('feedback-explanation').textContent = explanation;
    document.getElementById('feedback-reward').textContent = correct
      ? `+${elixirEarned} Elixir  +5 XP earned`
      : '+1 XP for trying';
    showPhase('feedback');
    addLog(correct ? `You answered correctly! +${elixirEarned} elixir` : 'Wrong answer.', correct);
  }, 800);
});

socket.on('card-outcome', ({ userId, outcome, message }) => {
  const isMe = userId === CURRENT_USER_ID;
  const actor = isMe ? 'You' : OPP_NAME;
  addLog(`${actor} got: ${outcome.name}`, true);

  if (isMe) {
    const icons = { trap: '☠️', windfall: '✨' };
    document.getElementById('outcome-icon').textContent = icons[outcome.type] || '🃏';
    document.getElementById('outcome-name').textContent = outcome.name;
    document.getElementById('outcome-desc').textContent = outcome.description;
    showPhase('outcome');
  }
});

socket.on('game-over', ({ winnerId, forfeited, forfeitedBy, state }) => {
  updateHP(state.p1State, state.p2State);
  const won = winnerId === CURRENT_USER_ID;
  const iForfeited = forfeitedBy === CURRENT_USER_ID;

  document.getElementById('gameover-title').textContent = won ? '🏆 Victory!' : '💀 Defeated';
  document.getElementById('gameover-title').style.color = won ? 'var(--gold)' : 'var(--red)';

  if (forfeited) {
    document.getElementById('gameover-sub').textContent = iForfeited
      ? 'You forfeited the match. +1 XP awarded.'
      : 'Your opponent forfeited — you win! +15 XP awarded.';
  } else {
    document.getElementById('gameover-sub').textContent = won
      ? 'You have conquered the arena! +15 XP awarded.'
      : 'Your opponent was stronger this time. +2 XP awarded.';
  }

  // Hide forfeit button so it can't be clicked on game-over screen
  const exitBtn = document.querySelector('.exit-game-btn');
  if (exitBtn) exitBtn.style.display = 'none';

  showPhase('gameover');
  addLog(won ? '🏆 YOU WIN!' : '💀 You were defeated.', true);
});

// ── Forfeit / exit ───────────────────────────────
function exitGame() {
  if (confirm('Forfeit this match? Your opponent will be declared the winner.')) {
    socket.emit('forfeit-game', { roomCode: ROOM_CODE });
  }
}

// ── Flash message overlay ────────────────────────
function flashMessage(msg) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    background:rgba(0,0,0,0.85); border:1px solid var(--gold); border-radius:12px;
    padding:1rem 2rem; font-family:'Cinzel',serif; color:var(--gold);
    font-size:1.2rem; z-index:999; text-align:center;
    animation: fade-in 0.3s ease;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ── Items ─────────────────────────────────────────
function renderItems(items) {
  const row = document.getElementById('items-row');
  if (!items.length) return;

  const emojis = {
    'immunity':'🛡️','double_damage':'⚔️','extra_turn':'⏳','fog':'🌫️',
    'steal_elixir':'💜','reroll':'🎲','curse_scroll':'📜','hint':'🔮',
    'time_warp':'🕰️','elixir_surge':'⚡','ghost_step':'👻'
  };

  row.innerHTML = items.map(item => {
    const onCooldown = item.cooldown_remaining > 0;
    const emoji = emojis[item.effect_type] || '✨';
    return `
      <div class="item-btn ${onCooldown ? 'on-cooldown' : 'ready'}"
           id="item-${item.id}"
           data-ap-id="${item.id}"
           data-name="${item.name}"
           data-desc="${item.description}">
        <span class="item-emoji">${emoji}</span>
        <span class="item-label">${item.name}</span>
        ${onCooldown
          ? `<span class="cooldown-badge">🕐 ${item.cooldown_remaining}</span>`
          : `<span class="ready-badge">Ready</span>`}
      </div>`;
  }).join('');

  bindItemClicks();
}

function bindItemClicks() {
  document.querySelectorAll('.item-btn.ready').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isMyTurn()) { flashMessage('⚠️ Not your turn!'); return; }
      if (btn.classList.contains('item-spent')) { flashMessage('⚠️ Already used an item this turn.'); return; }
      const apId = btn.dataset.apId;
      const name = btn.dataset.name;
      if (confirm(`Use ${name}?`)) {
        socket.emit('use-item', { roomCode: ROOM_CODE, apId: parseInt(apId) });
        // Locally lock all items until next turn — server will log the use
        document.querySelectorAll('.item-btn.ready').forEach(b => b.classList.add('item-spent', 'on-cooldown'));
        document.getElementById('items-turn-hint').textContent = 'Item used — roll to end your turn';
      }
    });

    // Tooltip on hover
    btn.addEventListener('mouseenter', (e) => {
      let tip = document.getElementById('item-tooltip');
      if (!tip) { tip = document.createElement('div'); tip.id = 'item-tooltip'; tip.className = 'item-tooltip'; document.body.appendChild(tip); }
      tip.textContent = btn.dataset.desc;
      tip.style.display = 'block';
    });
    btn.addEventListener('mousemove', (e) => {
      const tip = document.getElementById('item-tooltip');
      if (tip) { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - 30) + 'px'; }
    });
    btn.addEventListener('mouseleave', () => {
      const tip = document.getElementById('item-tooltip');
      if (tip) tip.style.display = 'none';
    });
  });
}

function updateItemsTurnHint() {
  const hint = document.getElementById('items-turn-hint');
  if (hint) hint.textContent = isMyTurn() ? 'Click an item to use it' : '';
}

socket.on('items-update', ({ items }) => {
  renderItems(items);
  updateItemsTurnHint();
});

socket.on('item-used', ({ userId, itemName, message }) => {
  const actor = userId === CURRENT_USER_ID ? MY_NAME : OPP_NAME;
  addLog(`${actor} used ${itemName}!`, true);
  if (userId === CURRENT_USER_ID) flashMessage(message);
});

socket.on('item-error', ({ message }) => {
  flashMessage('⚠️ ' + message);
});

socket.on('extra-turn-granted', ({ userId }) => {
  currentTurnId = userId;
  if (userId === CURRENT_USER_ID) {
    flashMessage('⏳ Extra turn! You go again!');
    addLog(`${MY_NAME} is taking an extra turn!`, true);
    showPhase('roll');
    document.getElementById('btn-roll').disabled = false;
    const confirmBtn = document.getElementById('btn-confirm-roll');
    if (confirmBtn) confirmBtn.disabled = false;
    updateDicePhaseUI();
    document.getElementById('roll-msg').textContent = '⏳ Extra turn — second roll!';
  } else {
    addLog(`${OPP_NAME} is taking their extra turn!`, true);
    showPhase('waiting');
    document.getElementById('waiting-text').textContent = `${OPP_NAME} is taking an extra turn...`;
  }
});

socket.on('prompt-reroll', ({ userId, username }) => {
  if (userId === CURRENT_USER_ID) {
    showPhase('roll');
    document.getElementById('btn-roll').disabled = false;
    const confirmBtn = document.getElementById('btn-confirm-roll');
    if (confirmBtn) confirmBtn.disabled = false;
    updateDicePhaseUI();
    document.getElementById('roll-msg').textContent = '🎲 Lucky Reroll — roll again!';
    addLog(`${MY_NAME} used Lucky Reroll — roll again!`, true);
  } else {
    showPhase('waiting');
    document.getElementById('waiting-text').textContent = `${username} used Lucky Reroll and is rolling again...`;
    addLog(`${username} used Lucky Reroll — their turn continues.`, true);
  }
});

// ── Status effects (poison log) ──────────────────
socket.on('status-effect', ({ userId, type, message }) => {
  const actor = userId === CURRENT_USER_ID ? 'You' : OPP_NAME;
  addLog(`☠️ ${actor}: ${message}`, true);
  if (userId === CURRENT_USER_ID) flashMessage(`☠️ ${message}`);
});

// ── Time Warp ─────────────────────────────────────
socket.on('grant-time-warp', () => {
  flashMessage('🕰️ Time Warp ready — next scan card will be skipped!');
  addLog(`${MY_NAME} activated Time Warp.`, true);
});

socket.on('time-warp-used', ({ message }) => {
  flashMessage('🕰️ ' + message);
  addLog(`${MY_NAME}: ${message}`, true);
  showPhase('waiting');
  document.getElementById('waiting-text').textContent = 'Time Warp used — ending turn...';
});

// ── QR camera scanner ────────────────────────────
let _qrStream = null;
let _qrFrame  = null;

function openQrScanner() {
  const modal = document.getElementById('qr-scanner-modal');
  modal.classList.remove('hidden');
  document.getElementById('qr-status').textContent = 'Point your camera at the QR code on the board';

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      _qrStream = stream;
      const video = document.getElementById('qr-video');
      video.srcObject = stream;
      video.play();
      video.addEventListener('loadedmetadata', _qrScanLoop, { once: true });
    })
    .catch(() => {
      document.getElementById('qr-status').textContent = 'Camera access denied — use Draw Card instead.';
    });
}

function _qrScanLoop() {
  const video  = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  const ctx    = canvas.getContext('2d');

  function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = typeof jsQR !== 'undefined' && jsQR(img.data, img.width, img.height);
      if (code && code.data.includes('/game/scan-qr')) {
        closeQrScanner();
        scanCard();
        return;
      }
    }
    _qrFrame = requestAnimationFrame(tick);
  }
  _qrFrame = requestAnimationFrame(tick);
}

function closeQrScanner() {
  if (_qrFrame)  { cancelAnimationFrame(_qrFrame); _qrFrame = null; }
  if (_qrStream) { _qrStream.getTracks().forEach(t => t.stop()); _qrStream = null; }
  document.getElementById('qr-scanner-modal').classList.add('hidden');
}

// ── Init ─────────────────────────────────────────
updateBoard(myPos, oppPos);
renderItems(MY_ITEMS);
addLog('Game started! ' + (IS_P1 ? MY_NAME : OPP_NAME) + ' goes first.');
// Show dice preference modal — turn UI initialises after the player makes their choice
document.getElementById('dice-pref-modal').classList.remove('hidden');
