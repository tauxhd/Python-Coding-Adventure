require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const adjectives = ['Dark','Swift','Iron','Shadow','Storm','Frost','Ember','Neon','Void','Arcane','Rune','Blood','Stone','Wild','Ghost','Sage','Grim','Star','Dusk','Dawn'];
const nouns = ['Mage','Wolf','Drake','Wyrm','Raven','Fang','Blade','Crypt','Witch','Monk','Viper','Shade','Hawk','Thorn','Gust','Flame','Golem','Rift','Seer','Warden'];

function getRankName(xp) {
  if (xp >= 600) return 'Grand Archmage';
  if (xp >= 300) return 'Arcane Scholar';
  if (xp >= 100) return 'Spellbinder';
  return 'Code Initiate';
}

async function seed() {
  const hash = await bcrypt.hash('password123', 10);
  let created = 0;

  for (let i = 0; i < 50; i++) {
    const adj  = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const username = `${adj}${noun}${Math.floor(Math.random() * 999)}`;
    const email    = `${username.toLowerCase()}@paq.test`;
    const xp       = Math.floor(Math.random() * 800);
    const elixir   = Math.floor(Math.random() * 500);
    const rank     = getRankName(xp);

    // Random attribute points (up to 6 total spent)
    const totalSpent = Math.floor(Math.random() * 7);
    const dmg  = Math.floor(Math.random() * (totalSpent + 1));
    const def  = Math.floor(Math.random() * (totalSpent - dmg + 1));
    const agi  = totalSpent - dmg - def;

    try {
      await db.query(
        `INSERT INTO users (username, email, password_hash, xp, elixir, rank_name, damage_attr, defense_attr, agility_attr)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, email, hash, xp, elixir, rank, dmg, def, agi]
      );
      created++;
    } catch (e) {
      // skip duplicates silently
    }
  }

  console.log(`Created ${created} players.`);
  process.exit(0);
}

seed();
