const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireLogin } = require('../middleware/auth');

// Shop page
router.get('/', requireLogin, async (req, res) => {
  try {
    const [items] = await db.query('SELECT * FROM shop_items ORDER BY cost ASC');

    const [inventory] = await db.query(
      'SELECT item_id, quantity FROM user_inventory WHERE user_id = ?',
      [req.session.user.id]
    );
    const inventoryMap = {};
    inventory.forEach(i => { inventoryMap[i.item_id] = i.quantity; });

    const [userRows] = await db.query('SELECT elixir FROM users WHERE id = ?', [req.session.user.id]);
    const elixir = userRows[0].elixir;

    // Sync session elixir
    req.session.user.elixir = elixir;

    res.render('shop', { items, inventoryMap, elixir, success: req.query.success || null, error: req.query.error || null });
  } catch (err) {
    console.error(err);
    res.redirect('/profile');
  }
});

// Buy item
router.post('/buy/:itemId', requireLogin, async (req, res) => {
  const itemId = parseInt(req.params.itemId);
  try {
    const [items] = await db.query('SELECT * FROM shop_items WHERE id = ?', [itemId]);
    if (!items.length) return res.redirect('/shop?error=Item not found.');

    const item = items[0];
    const [userRows] = await db.query('SELECT elixir FROM users WHERE id = ?', [req.session.user.id]);
    const elixir = userRows[0].elixir;

    if (elixir < item.cost)
      return res.redirect('/shop?error=Not enough Elixir to buy ' + item.name + '.');

    // Deduct elixir
    await db.query('UPDATE users SET elixir = elixir - ? WHERE id = ?', [item.cost, req.session.user.id]);

    // Add to inventory
    const [existing] = await db.query(
      'SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?',
      [req.session.user.id, itemId]
    );
    if (existing.length > 0) {
      await db.query(
        'UPDATE user_inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?',
        [req.session.user.id, itemId]
      );
    } else {
      await db.query(
        'INSERT INTO user_inventory (user_id, item_id, quantity) VALUES (?, ?, 1)',
        [req.session.user.id, itemId]
      );
    }

    req.session.user.elixir = elixir - item.cost;
    res.redirect('/shop?success=Purchased ' + item.name + '!');
  } catch (err) {
    console.error(err);
    res.redirect('/shop?error=Purchase failed. Try again.');
  }
});

// Get elixir purchase modal with random question
router.get('/buy-elixir/:amount', requireLogin, async (req, res) => {
  const amount = parseInt(req.params.amount);
  if (![10, 50, 100].includes(amount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    // Get random question
    const [questions] = await db.query('SELECT * FROM questions ORDER BY RAND() LIMIT 1');
    if (!questions.length) {
      return res.status(500).json({ error: 'No questions available' });
    }

    const question = questions[0];
    res.json({
      amount,
      question: {
        id: question.id,
        text: question.question_text,
        options: {
          a: question.option_a,
          b: question.option_b,
          c: question.option_c,
          d: question.option_d
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load question' });
  }
});

// Process elixir purchase answer
router.post('/buy-elixir', requireLogin, async (req, res) => {
  const { amount, questionId, answer } = req.body;

  if (![10, 50, 100].includes(amount)) {
    return res.status(400).json({ success: false, error: 'Invalid amount' });
  }

  try {
    // Get the question to verify answer
    const [questions] = await db.query('SELECT * FROM questions WHERE id = ?', [questionId]);
    if (!questions.length) {
      return res.status(400).json({ success: false, error: 'Question not found' });
    }

    const question = questions[0];
    const isCorrect = question.correct_ans === answer;

    if (!isCorrect) {
      return res.json({ success: false, error: 'Incorrect answer. Try again!', explanation: question.explanation });
    }

    // Correct answer - award elixir
    await db.query('UPDATE users SET elixir = elixir + ? WHERE id = ?', [amount, req.session.user.id]);
    req.session.user.elixir += amount;

    res.json({
      success: true,
      message: `Correct! You earned ${amount} Elixir!`,
      newElixir: req.session.user.elixir
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to process answer' });
  }
});

module.exports = router;
