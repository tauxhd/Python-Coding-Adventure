USE python_adventure_quest;

ALTER TABLE users ADD COLUMN is_admin TINYINT(1) DEFAULT 0;

ALTER TABLE games ADD COLUMN current_turn_id INT;
ALTER TABLE games ADD CONSTRAINT fk_games_current_turn FOREIGN KEY (current_turn_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE shop_items ADD COLUMN cooldown_turns INT DEFAULT 0;

ALTER TABLE active_powerups ADD COLUMN cooldown_remaining INT DEFAULT 0;

ALTER TABLE game_state ADD COLUMN extra_turn_pending    BOOLEAN DEFAULT FALSE;
ALTER TABLE game_state ADD COLUMN item_used_this_turn   BOOLEAN DEFAULT FALSE;
ALTER TABLE game_state ADD COLUMN double_damage_pending BOOLEAN DEFAULT FALSE;
ALTER TABLE game_state ADD COLUMN ghost_step_pending    BOOLEAN DEFAULT FALSE;
ALTER TABLE game_state ADD COLUMN mirror_active         BOOLEAN DEFAULT FALSE;
ALTER TABLE game_state ADD COLUMN time_warp_pending     BOOLEAN DEFAULT FALSE;

ALTER TABLE board_spaces MODIFY COLUMN space_type ENUM('safe','cursed','blessing','shortcut','scan','goal') NOT NULL;
UPDATE board_spaces SET space_type = 'goal' WHERE space_number = 20;
