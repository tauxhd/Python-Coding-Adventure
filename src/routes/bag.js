const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireLogin } = require('../middleware/auth');

router.get('/', requireLogin, async (req, res) => {
  try {
    const [inventory] = await db.query(`
      SELECT ui.item_id, ui.quantity, si.name, si.description,
             si.effect_type, si.effect_value, si.cooldown_turns, si.image_file
      FROM user_inventory ui
      JOIN shop_items si ON ui.item_id = si.id
      WHERE ui.user_id = ?
      ORDER BY si.name ASC
    `, [req.session.user.id]);

    const [equippedRows] = await db.query(
      'SELECT slot_1_item_id, slot_2_item_id, slot_3_item_id FROM equipped_cards WHERE user_id = ?',
      [req.session.user.id]
    );

    let equipped = { slot1: null, slot2: null, slot3: null };
    if (equippedRows.length > 0) {
      equipped.slot1 = equippedRows[0].slot_1_item_id;
      equipped.slot2 = equippedRows[0].slot_2_item_id;
      equipped.slot3 = equippedRows[0].slot_3_item_id;
    }

    // Count how many times each item is equipped across slots
    const equippedCounts = {};
    [equipped.slot1, equipped.slot2, equipped.slot3].filter(Boolean).forEach(id => {
      equippedCounts[id] = (equippedCounts[id] || 0) + 1;
    });

    // Add availableQty = quantity - how many are already in slots
    const itemsWithAvailable = inventory.map(item => ({
      ...item,
      equippedCount: equippedCounts[item.item_id] || 0,
      availableQty: item.quantity - (equippedCounts[item.item_id] || 0)
    }));

    res.render('bag', { items: itemsWithAvailable, equipped });
  } catch (err) {
    console.error(err);
    res.redirect('/profile?error=Failed to load bag.');
  }
});

// Equip cards to slots — diff old vs new and adjust inventory
router.post('/equip', requireLogin, async (req, res) => {
  let { slot1, slot2, slot3 } = req.body;
  slot1 = slot1 ? parseInt(slot1) : null;
  slot2 = slot2 ? parseInt(slot2) : null;
  slot3 = slot3 ? parseInt(slot3) : null;

  try {
    // Get old equipped state
    const [existing] = await db.query(
      'SELECT slot_1_item_id, slot_2_item_id, slot_3_item_id FROM equipped_cards WHERE user_id = ?',
      [req.session.user.id]
    );

    const oldSlots = existing.length > 0
      ? [existing[0].slot_1_item_id, existing[0].slot_2_item_id, existing[0].slot_3_item_id]
      : [null, null, null];
    const newSlots = [slot1, slot2, slot3];

    // Count old and new per item
    const oldCounts = {};
    const newCounts = {};
    oldSlots.filter(Boolean).forEach(id => { oldCounts[id] = (oldCounts[id] || 0) + 1; });
    newSlots.filter(Boolean).forEach(id => { newCounts[id] = (newCounts[id] || 0) + 1; });

    // All item IDs involved
    const allIds = new Set([...Object.keys(oldCounts), ...Object.keys(newCounts)].map(Number));

    for (const itemId of allIds) {
      const oldN = oldCounts[itemId] || 0;
      const newN = newCounts[itemId] || 0;
      const diff = newN - oldN; // positive = equipping more, negative = unequipping

      if (diff === 0) continue;

      if (diff > 0) {
        // Check inventory has enough
        const [invRows] = await db.query(
          'SELECT quantity FROM user_inventory WHERE user_id = ? AND item_id = ?',
          [req.session.user.id, itemId]
        );
        const available = invRows.length > 0 ? invRows[0].quantity : 0;
        if (available - oldN < diff) {
          return res.json({ success: false, error: `Not enough of that item in your inventory.` });
        }
        // Deduct from inventory
        await db.query(
          'UPDATE user_inventory SET quantity = quantity - ? WHERE user_id = ? AND item_id = ?',
          [diff, req.session.user.id, itemId]
        );
      } else {
        // Return to inventory
        await db.query(
          'UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND item_id = ?',
          [Math.abs(diff), req.session.user.id, itemId]
        );
      }
    }

    // Save new equipped state
    if (existing.length > 0) {
      await db.query(
        'UPDATE equipped_cards SET slot_1_item_id = ?, slot_2_item_id = ?, slot_3_item_id = ? WHERE user_id = ?',
        [slot1, slot2, slot3, req.session.user.id]
      );
    } else {
      await db.query(
        'INSERT INTO equipped_cards (user_id, slot_1_item_id, slot_2_item_id, slot_3_item_id) VALUES (?, ?, ?, ?)',
        [req.session.user.id, slot1, slot2, slot3]
      );
    }

    res.json({ success: true, message: 'Cards equipped successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to equip cards' });
  }
});

module.exports = router;
