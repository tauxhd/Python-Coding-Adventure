CREATE DATABASE IF NOT EXISTS python_adventure_quest;
USE python_adventure_quest;

-- -------------------------------------------------------
-- USERS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  email         VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  xp            INT DEFAULT 0,
  elixir        INT DEFAULT 0,
  rank_name     ENUM('Code Initiate','Spellbinder','Arcane Scholar','Grand Archmage') DEFAULT 'Code Initiate',
  damage_attr   INT DEFAULT 0,
  defense_attr  INT DEFAULT 0,
  agility_attr  INT DEFAULT 0,
  attr_points   INT DEFAULT 0,
  is_admin      TINYINT(1) DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------
-- QUESTIONS (Control Flow)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  difficulty    ENUM('common','rare','legendary') NOT NULL,
  question_text TEXT NOT NULL,
  option_a      VARCHAR(255) NOT NULL,
  option_b      VARCHAR(255) NOT NULL,
  option_c      VARCHAR(255) NOT NULL,
  option_d      VARCHAR(255) NOT NULL,
  correct_ans   ENUM('a','b','c','d') NOT NULL,
  explanation   TEXT NOT NULL
);

-- -------------------------------------------------------
-- CARD OUTCOMES (what a QR scan can give you)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_outcomes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  type          ENUM('question','trap','windfall') NOT NULL,
  name          VARCHAR(100) NOT NULL,
  description   TEXT NOT NULL,
  effect_type   VARCHAR(50),
  effect_value  FLOAT DEFAULT 0,
  weight        INT DEFAULT 10
);

-- -------------------------------------------------------
-- SHOP ITEMS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_items (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  description    TEXT NOT NULL,
  effect_type    VARCHAR(50) NOT NULL,
  effect_value   FLOAT DEFAULT 0,
  cost           INT NOT NULL,
  cooldown_turns INT DEFAULT 0,
  image_file     VARCHAR(100)
);

-- -------------------------------------------------------
-- USER INVENTORY (items bought, carried between games)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_inventory (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  item_id       INT NOT NULL,
  quantity      INT DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES shop_items(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- EQUIPPED CARDS (3 cards selected for battle)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipped_cards (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL UNIQUE,
  slot_1_item_id INT,
  slot_2_item_id INT,
  slot_3_item_id INT,
  FOREIGN KEY (user_id)        REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_1_item_id) REFERENCES shop_items(id) ON DELETE SET NULL,
  FOREIGN KEY (slot_2_item_id) REFERENCES shop_items(id) ON DELETE SET NULL,
  FOREIGN KEY (slot_3_item_id) REFERENCES shop_items(id) ON DELETE SET NULL
);

-- -------------------------------------------------------
-- GAMES
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  room_code       VARCHAR(10) UNIQUE NOT NULL,
  player1_id      INT NOT NULL,
  player2_id      INT,
  current_turn_id INT,
  status          ENUM('waiting','active','finished') DEFAULT 'waiting',
  winner_id       INT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player1_id)      REFERENCES users(id),
  FOREIGN KEY (player2_id)      REFERENCES users(id),
  FOREIGN KEY (current_turn_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (winner_id)       REFERENCES users(id)
);

-- -------------------------------------------------------
-- GAME STATE (per player per game)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_state (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  game_id               INT NOT NULL,
  user_id               INT NOT NULL,
  hp                    FLOAT DEFAULT 5,
  position              INT DEFAULT 0,
  skip_next_turn        BOOLEAN DEFAULT FALSE,
  fog_turns             INT DEFAULT 0,
  frost_turns           INT DEFAULT 0,
  poison_turns          INT DEFAULT 0,
  elixir_this_game      INT DEFAULT 0,
  extra_turn_pending    BOOLEAN DEFAULT FALSE,
  item_used_this_turn   BOOLEAN DEFAULT FALSE,
  double_damage_pending BOOLEAN DEFAULT FALSE,
  ghost_step_pending    BOOLEAN DEFAULT FALSE,
  mirror_active         BOOLEAN DEFAULT FALSE,
  time_warp_pending     BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- -------------------------------------------------------
-- ACTIVE POWER-UPS (items loaded for current game)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS active_powerups (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  game_id            INT NOT NULL,
  user_id            INT NOT NULL,
  item_id            INT NOT NULL,
  is_used            BOOLEAN DEFAULT FALSE,
  cooldown_remaining INT DEFAULT 0,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES shop_items(id)
);

-- -------------------------------------------------------
-- GAME SESSIONS (log of every scan/answer)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_sessions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  game_id         INT NOT NULL,
  user_id         INT NOT NULL,
  question_id     INT,
  answer_given    ENUM('a','b','c','d'),
  is_correct      BOOLEAN,
  elixir_earned   INT DEFAULT 0,
  outcome_type    ENUM('question','trap','windfall'),
  outcome_name    VARCHAR(100),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id)     REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)     REFERENCES users(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- -------------------------------------------------------
-- BOARD SPACES CONFIG
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS board_spaces (
  space_number  INT PRIMARY KEY,
  space_type    ENUM('safe','cursed','blessing','shortcut','scan','goal') NOT NULL,
  effect_type   VARCHAR(50),
  effect_value  FLOAT DEFAULT 0,
  jump_to       INT DEFAULT NULL
);

-- -------------------------------------------------------
-- SEED: Board Spaces
-- -------------------------------------------------------
INSERT INTO board_spaces (space_number, space_type, effect_type, effect_value, jump_to) VALUES
(1,  'safe',     NULL,           0,    NULL),
(2,  'safe',     NULL,           0,    NULL),
(3,  'blessing', 'gain_elixir',  10,   NULL),
(4,  'safe',     NULL,           0,    NULL),
(5,  'cursed',   'skip_turn',    0,    NULL),
(6,  'safe',     NULL,           0,    NULL),
(7,  'shortcut', 'jump',         0,    12),
(8,  'safe',     NULL,           0,    NULL),
(9,  'scan',     NULL,           0,    NULL),
(10, 'safe',     NULL,           0,    NULL),
(11, 'blessing', 'gain_elixir',  10,   NULL),
(12, 'safe',     NULL,           0,    NULL),
(13, 'cursed',   'skip_turn',    0,    NULL),
(14, 'safe',     NULL,           0,    NULL),
(15, 'safe',     NULL,           0,    NULL),
(16, 'scan',     NULL,           0,    NULL),
(17, 'safe',     NULL,           0,    NULL),
(18, 'safe',     NULL,           0,    NULL),
(19, 'safe',     NULL,           0,    NULL),
(20, 'goal',     NULL,           0,    NULL);

-- -------------------------------------------------------
-- SEED: Questions (Control Flow)
-- -------------------------------------------------------
INSERT INTO questions (difficulty, question_text, option_a, option_b, option_c, option_d, correct_ans, explanation) VALUES
-- COMMON (if/elif/else)
('common', 'What is the output of: x = 5\nif x > 3:\n    print("big")', 'nothing', 'big', 'error', '5', 'b', 'x is 5, which is greater than 3, so the condition is True and "big" is printed.'),
('common', 'Which keyword is used to check an additional condition after if?', 'else', 'then', 'elif', 'when', 'c', 'elif (short for else if) is used to check another condition if the previous if was False.'),
('common', 'What does the else block do?', 'Runs when the if condition is True', 'Runs when all conditions are False', 'Ends the program', 'Skips the if block', 'b', 'The else block executes when none of the preceding if/elif conditions were True.'),
('common', 'What is the output of: x = 10\nif x == 5:\n    print("five")\nelse:\n    print("not five")', 'five', 'error', 'nothing', 'not five', 'd', 'x is 10, not 5, so the if condition is False and the else block runs.'),
('common', 'Which of the following is valid Python syntax?', 'if x > 0 then:', 'if (x > 0)', 'if x > 0:', 'if x > 0;', 'c', 'Python if statements end with a colon. No parentheses or semicolons required.'),
('common', 'What is the output of: age = 18\nif age >= 18:\n    print("adult")', 'nothing', 'error', 'adult', '18', 'c', 'age is 18, and 18 >= 18 is True, so "adult" is printed.'),
('common', 'How many elif blocks can an if statement have?', 'Only 1', 'Only 2', 'As many as needed', 'None', 'c', 'Python allows any number of elif blocks after an if statement.'),
('common', 'What is the output of: x = 7\nif x > 10:\n    print("A")\nelif x > 5:\n    print("B")\nelse:\n    print("C")', 'A', 'B', 'C', 'error', 'b', 'x=7 is not >10, but it is >5, so the elif runs and prints "B".'),

-- RARE (for/while loops)
('rare', 'How many times does this loop run:\nfor i in range(5):\n    print(i)', '4', '5', '6', 'infinite', 'b', 'range(5) generates 0,1,2,3,4 — five values, so the loop runs 5 times.'),
('rare', 'What is the output of: for i in range(3):\n    print(i)', '1 2 3', '0 1 2', '0 1 2 3', 'error', 'b', 'range(3) starts at 0 by default and produces 0, 1, 2.'),
('rare', 'What will cause an infinite while loop?', 'while True:', 'while x < 10:', 'while False:', 'while x == x - 1:', 'a', 'while True: never has a False condition, so it loops forever unless broken out of.'),
('rare', 'What is the output of: x = 0\nwhile x < 3:\n    x += 1\nprint(x)', '0', '2', '3', '4', 'c', 'The loop increments x until it reaches 3, at which point the condition x < 3 becomes False. Final value is 3.'),
('rare', 'What does range(2, 8, 2) produce?', '[2, 4, 6, 8]', '[2, 4, 6]', '[2, 3, 4, 5, 6, 7]', '[0, 2, 4, 6]', 'b', 'range(start, stop, step) — starts at 2, stops before 8, steps by 2: gives 2, 4, 6.'),
('rare', 'Which loop is better when you know how many times to iterate?', 'while loop', 'for loop', 'do-while loop', 'if loop', 'b', 'A for loop is ideal when the number of iterations is known, e.g. iterating over a list or range.'),
('rare', 'What is the output of: total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)', '3', '6', '10', '0', 'b', 'range(1,4) gives 1,2,3. total = 0+1+2+3 = 6.'),

-- LEGENDARY (nested loops, break, continue)
('legendary', 'What does the break statement do inside a loop?', 'Skips to the next iteration', 'Exits the loop immediately', 'Restarts the loop', 'Ends the program', 'b', 'break immediately terminates the loop it is in, regardless of the condition.'),
('legendary', 'What does continue do?', 'Exits the loop', 'Ends the program', 'Skips the rest of the current iteration and moves to the next', 'Pauses execution', 'c', 'continue skips the remaining code in the current loop iteration and jumps back to the condition check.'),
('legendary', 'What is the output of: for i in range(5):\n    if i == 3:\n        break\n    print(i)', '0 1 2 3', '0 1 2', '1 2 3', '0 1 2 3 4', 'b', 'The loop prints i until i equals 3, at which point break exits the loop. So 0, 1, 2 are printed.'),
('legendary', 'How many total times does print run:\nfor i in range(3):\n    for j in range(3):\n        print(i, j)', '3', '6', '9', '12', 'c', 'Outer loop runs 3 times, inner loop runs 3 times for each outer iteration: 3 × 3 = 9.'),
('legendary', 'What is the output of: for i in range(5):\n    if i == 2:\n        continue\n    print(i)', '0 1 2 3 4', '0 1 3 4', '1 2 3 4', '0 1', 'b', 'continue skips the print when i==2, so 2 is never printed. Output: 0 1 3 4.'),
('legendary', 'What does a nested loop mean?', 'A loop with a condition', 'A loop inside another loop', 'A loop that breaks early', 'A loop using range()', 'b', 'A nested loop is a loop placed inside the body of another loop.'),
('legendary', 'What is the output of: i = 0\nwhile True:\n    if i >= 3:\n        break\n    i += 1\nprint(i)', '0', '2', '3', 'infinite', 'c', 'The while loop increments i until i >= 3, then break exits. Final value of i is 3.');

-- -------------------------------------------------------
-- SEED: Card Outcomes (Traps & Windfalls)
-- -------------------------------------------------------
INSERT INTO card_outcomes (type, name, description, effect_type, effect_value, weight) VALUES
-- Traps
('trap', 'Lava Pit',     'Scorching lava erupts beneath you!',                        'lose_hp',      0.5,  12),
('trap', 'Poison Fog',   'Toxic mist drains your elixir for 2 turns.',                'poison',       5,    10),
('trap', 'Petrify Curse','You are turned to stone. Lose your next turn.',             'skip_turn',    0,    10),
('trap', 'Chain Snare',  'Heavy chains pull you back 3 spaces.',                      'move_back',    3,    10),
('trap', 'Elixir Leak',  'Your vial cracks. Lose 20 elixir instantly.',               'lose_elixir',  20,   10),
('trap', 'Mirror Hex',   'Your next power-up is reflected back at you.',              'mirror',       0,    8),
('trap', 'Cursed Frost', 'Ice binds you. Cannot use items for 2 turns.',              'frost',        2,    8),
('trap', 'Void Pull',    'A black void drags you back to space 1.',                   'void',         0,    5),
('trap', 'Soul Drain',   'A ghost steals 10 elixir and gives it to your opponent.',   'soul_drain',   10,   7),
-- Windfalls
('windfall', 'Elixir Rush',   'A hidden cache of elixir! Gain 25 elixir.',            'gain_elixir',        25,  10),
('windfall', 'Blessed Step',  'The gods smile. Move forward 2 spaces.',               'move_forward',       2,   10),
('windfall', 'Time Gift',     'Time bends in your favour. Take an extra turn.',       'extra_turn',         0,   8),
('windfall', 'Rival Stumble', 'Your opponent trips. Move them back 2 spaces.',        'move_opponent_back', 2,   8),
('windfall', 'XP Surge',      'Ancient knowledge fills your mind. Gain 10 XP.',       'gain_xp',            10,  7);

-- -------------------------------------------------------
-- SEED: Shop Items
-- -------------------------------------------------------
INSERT INTO shop_items (name, description, effect_type, effect_value, cost, cooldown_turns, image_file) VALUES
('Immunity Cloak',  'Block the next skip-turn curse placed on you.',                  'immunity',       0,   20,  0, 'immunity_cloak.png'),
('Double Damage',   'Your next lap finish deals 2x damage.',                          'double_damage',  0,   25,  0, 'double_damage.png'),
('Play Twice',      'Take an extra turn immediately after this one.',                 'extra_turn',     0,   30,  0, 'play_twice.png'),
('Fog of War',      'Hide your board position from opponent for 2 turns.',            'fog',            2,   20,  0, 'fog_of_war.png'),
('Elixir Drain',    'Steal 15 elixir from your opponent.',                            'steal_elixir',   15,  25,  0, 'elixir_drain.png'),
('Lucky Reroll',    'Reroll the dice once on your turn.',                             'reroll',         0,   10,  0, 'lucky_reroll.png'),
('Curse Scroll',    'Force your opponent''s next card to be Legendary difficulty.',   'curse_scroll',   0,   35,  0, 'curse_scroll.png'),
('Hint Stone',      'Removes 2 wrong options on your next question.',                 'hint',           0,   15,  0, 'hint_stone.png'),
('Time Warp',       'Skip your next scan card without any penalty.',                  'time_warp',      0,   40,  0, 'time_warp.png'),
('Elixir Surge',    'Double the elixir earned from your next correct answer.',        'elixir_surge',   0,   30,  0, 'elixir_surge.png'),
('Ghost Step',      'Pass through the next cursed space without triggering it.',      'ghost_step',     0,   20,  0, 'ghost_step.png');
