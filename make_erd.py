import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# ─── CONFIG ───────────────────────────────────────────────────────────────────
TABLE_W   = 3.8
ROW_H     = 0.32
FONT_SZ   = 6.8
HDR_SZ    = 8.0
DPI       = 130

HDR_FILL  = '#cccccc'
PK_FILL   = '#f2f2f2'
WHITE     = '#ffffff'
BLACK     = '#000000'
GRAY_LINE = '#bbbbbb'
CONN_COL  = '#333333'

# ─── TABLE DEFINITIONS ────────────────────────────────────────────────────────
# Each table: x = left edge, top = top y.  Fields: (name, type, key)
TABLES_DEF = {
    'users': {
        'x': 4.8, 'top': 20.8,
        'fields': [
            ('id',            'INT',          'PK'),
            ('username',      'VARCHAR(50)',   None),
            ('email',         'VARCHAR(100)',  None),
            ('password_hash', 'VARCHAR(255)',  None),
            ('xp',            'INT',           None),
            ('elixir',        'INT',           None),
            ('rank_name',     'ENUM',          None),
            ('damage_attr',   'INT',           None),
            ('defense_attr',  'INT',           None),
            ('agility_attr',  'INT',           None),
            ('attr_points',   'INT',           None),
            ('is_admin',      'TINYINT(1)',    None),
            ('created_at',    'TIMESTAMP',     None),
        ],
    },
    'questions': {
        'x': 0.2, 'top': 20.8,
        'fields': [
            ('id',            'INT',          'PK'),
            ('difficulty',    'ENUM',         None),
            ('question_text', 'TEXT',         None),
            ('option_a',      'VARCHAR(255)', None),
            ('option_b',      'VARCHAR(255)', None),
            ('option_c',      'VARCHAR(255)', None),
            ('option_d',      'VARCHAR(255)', None),
            ('correct_ans',   'ENUM',         None),
            ('explanation',   'TEXT',         None),
        ],
    },
    'card_outcomes': {
        'x': 19.4, 'top': 14.5,
        'fields': [
            ('id',           'INT',          'PK'),
            ('type',         'ENUM',         None),
            ('name',         'VARCHAR(100)', None),
            ('description',  'TEXT',         None),
            ('effect_type',  'VARCHAR(50)',  None),
            ('effect_value', 'FLOAT',        None),
            ('weight',       'INT',          None),
        ],
    },
    'shop_items': {
        'x': 19.4, 'top': 20.8,
        'fields': [
            ('id',             'INT',          'PK'),
            ('name',           'VARCHAR(100)', None),
            ('description',    'TEXT',         None),
            ('effect_type',    'VARCHAR(50)',  None),
            ('effect_value',   'FLOAT',        None),
            ('cost',           'INT',          None),
            ('cooldown_turns', 'INT',          None),
            ('image_file',     'VARCHAR(100)', None),
        ],
    },
    'user_inventory': {
        'x': 4.8, 'top': 14.6,
        'fields': [
            ('id',       'INT', 'PK'),
            ('user_id',  'INT', 'FK'),
            ('item_id',  'INT', 'FK'),
            ('quantity', 'INT', None),
        ],
    },
    'equipped_cards': {
        'x': 4.8, 'top': 12.6,
        'fields': [
            ('id',             'INT', 'PK'),
            ('user_id',        'INT', 'FK'),
            ('slot_1_item_id', 'INT', 'FK'),
            ('slot_2_item_id', 'INT', 'FK'),
            ('slot_3_item_id', 'INT', 'FK'),
        ],
    },
    'games': {
        'x': 9.6, 'top': 20.8,
        'fields': [
            ('id',              'INT',         'PK'),
            ('room_code',       'VARCHAR(10)', None),
            ('player1_id',      'INT',         'FK'),
            ('player2_id',      'INT',         'FK'),
            ('current_turn_id', 'INT',         'FK'),
            ('status',          'ENUM',        None),
            ('winner_id',       'INT',         'FK'),
            ('created_at',      'TIMESTAMP',   None),
        ],
    },
    'game_state': {
        'x': 9.6, 'top': 17.0,
        'fields': [
            ('id',                    'INT',     'PK'),
            ('game_id',               'INT',     'FK'),
            ('user_id',               'INT',     'FK'),
            ('hp',                    'FLOAT',   None),
            ('position',              'INT',     None),
            ('skip_next_turn',        'BOOLEAN', None),
            ('fog_turns',             'INT',     None),
            ('frost_turns',           'INT',     None),
            ('poison_turns',          'INT',     None),
            ('elixir_this_game',      'INT',     None),
            ('extra_turn_pending',    'BOOLEAN', None),
            ('item_used_this_turn',   'BOOLEAN', None),
            ('double_damage_pending', 'BOOLEAN', None),
            ('ghost_step_pending',    'BOOLEAN', None),
            ('mirror_active',         'BOOLEAN', None),
            ('time_warp_pending',     'BOOLEAN', None),
        ],
    },
    'active_powerups': {
        'x': 14.8, 'top': 20.8,
        'fields': [
            ('id',                 'INT',     'PK'),
            ('game_id',            'INT',     'FK'),
            ('user_id',            'INT',     'FK'),
            ('item_id',            'INT',     'FK'),
            ('is_used',            'BOOLEAN', None),
            ('cooldown_remaining', 'INT',     None),
        ],
    },
    'game_sessions': {
        'x': 0.2, 'top': 15.5,
        'fields': [
            ('id',            'INT',          'PK'),
            ('game_id',       'INT',          'FK'),
            ('user_id',       'INT',          'FK'),
            ('question_id',   'INT',          'FK'),
            ('answer_given',  'ENUM',         None),
            ('is_correct',    'BOOLEAN',      None),
            ('elixir_earned', 'INT',          None),
            ('outcome_type',  'ENUM',         None),
            ('outcome_name',  'VARCHAR(100)', None),
            ('created_at',    'TIMESTAMP',    None),
        ],
    },
    'board_spaces': {
        'x': 14.8, 'top': 13.8,
        'fields': [
            ('space_number', 'INT',         'PK'),
            ('space_type',   'ENUM',        None),
            ('effect_type',  'VARCHAR(50)', None),
            ('effect_value', 'FLOAT',       None),
            ('jump_to',      'INT',         None),
        ],
    },
}

# ─── SETUP FIGURE ─────────────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(24, 14))
ax.set_xlim(0, 24)
ax.set_ylim(9.8, 21.4)
ax.set_aspect('auto')
ax.axis('off')
ax.set_facecolor('white')
fig.patch.set_facecolor('white')
plt.subplots_adjust(left=0, right=1, top=1, bottom=0)

# ─── DRAW TABLE ───────────────────────────────────────────────────────────────
def draw_table(name, defn):
    x, top = defn['x'], defn['top']
    fields = defn['fields']
    n_rows = len(fields) + 1          # header + fields
    total_h = n_rows * ROW_H

    # White background
    ax.add_patch(patches.Rectangle(
        (x, top - total_h), TABLE_W, total_h,
        lw=0, fc=WHITE, zorder=2
    ))

    # Header background
    ax.add_patch(patches.Rectangle(
        (x, top - ROW_H), TABLE_W, ROW_H,
        lw=0, fc=HDR_FILL, zorder=3
    ))

    # Header text
    ax.text(x + TABLE_W / 2, top - ROW_H / 2, name,
            ha='center', va='center',
            fontsize=HDR_SZ, fontweight='bold', color=BLACK,
            fontfamily='monospace', zorder=5)

    # Separator line under header
    ax.plot([x, x + TABLE_W], [top - ROW_H, top - ROW_H],
            color=BLACK, lw=1.0, zorder=4)

    field_cy = {}   # field_name -> center_y of that row

    for i, (fname, ftype, fkey) in enumerate(fields):
        fy_bot = top - (i + 2) * ROW_H
        fy_ctr = fy_bot + ROW_H / 2

        # PK row shading
        if fkey == 'PK':
            ax.add_patch(patches.Rectangle(
                (x, fy_bot), TABLE_W, ROW_H,
                lw=0, fc=PK_FILL, zorder=3
            ))

        # Row divider
        ax.plot([x, x + TABLE_W], [fy_bot + ROW_H, fy_bot + ROW_H],
                color=GRAY_LINE, lw=0.3, zorder=4)

        # Key label
        if fkey:
            ax.text(x + 0.10, fy_ctr, fkey,
                    ha='left', va='center',
                    fontsize=FONT_SZ - 1.5, fontweight='bold', color=BLACK,
                    fontfamily='monospace', zorder=5)

        # Field name
        ax.text(x + 0.58, fy_ctr, fname,
                ha='left', va='center',
                fontsize=FONT_SZ,
                fontweight='bold' if fkey == 'PK' else 'normal',
                color=BLACK, fontfamily='monospace', zorder=5)

        # Data type (right-aligned, italic, gray)
        ax.text(x + TABLE_W - 0.08, fy_ctr, ftype,
                ha='right', va='center',
                fontsize=FONT_SZ - 1.0,
                color='#555555', style='italic',
                fontfamily='monospace', zorder=5)

        field_cy[fname] = fy_ctr

    # Outer border (drawn on top so it's sharp)
    ax.add_patch(patches.Rectangle(
        (x, top - total_h), TABLE_W, total_h,
        lw=1.3, ec=BLACK, fc='none', zorder=6
    ))

    return {
        'x': x, 'top': top,
        'bottom': top - total_h,
        'left': x, 'right': x + TABLE_W,
        'cx': x + TABLE_W / 2,
        'cy': top - total_h / 2,
        'fields': field_cy,
    }


# ─── DRAW CONNECTION ──────────────────────────────────────────────────────────
def conn(g1, f1, g2, f2, lw=0.85, offset_x=0):
    """Orthogonal elbow connector from g1[f1] → g2[f2]."""
    y1 = g1['fields'].get(f1, g1['cy'])
    y2 = g2['fields'].get(f2, g2['cy'])

    # Decide which sides to connect
    if g2['left'] >= g1['right'] - 0.05:
        # g2 is to the right
        x1, x2 = g1['right'], g2['left']
    elif g2['right'] <= g1['left'] + 0.05:
        # g2 is to the left
        x1, x2 = g1['left'], g2['right']
    else:
        # Same column — route outside right edge
        far = max(g1['right'], g2['right']) + 0.5 + offset_x
        ax.plot([g1['right'], far, far, g2['right']],
                [y1, y1, y2, y2],
                color=CONN_COL, lw=lw, zorder=1,
                solid_capstyle='round', solid_joinstyle='round')
        # small circle at FK end
        ax.plot(g2['right'], y2, 'o', ms=3.5, color=WHITE, zorder=7)
        ax.plot(g2['right'], y2, 'o', ms=3.5, mec=BLACK, mfc='none', lw=0.8, zorder=8)
        return

    mid_x = (x1 + x2) / 2 + offset_x
    ax.plot([x1, mid_x, mid_x, x2],
            [y1, y1, y2, y2],
            color=CONN_COL, lw=lw, zorder=1,
            solid_capstyle='round', solid_joinstyle='round')

    # Small hollow circle at FK end (g2 side = x2)
    ax.plot(x2, y2, 'o', ms=3.5, color=WHITE, zorder=7)
    ax.plot(x2, y2, 'o', ms=3.5, mec=BLACK, mfc='none', lw=0.8, zorder=8)


# ─── RENDER ALL TABLES ────────────────────────────────────────────────────────
G = {}
for name, defn in TABLES_DEF.items():
    G[name] = draw_table(name, defn)


# ─── DRAW ALL RELATIONSHIPS ───────────────────────────────────────────────────
# users → games (4 FK cols)
conn(G['users'], 'id', G['games'], 'player1_id',      offset_x=-0.15)
conn(G['users'], 'id', G['games'], 'player2_id',      offset_x=0.0)
conn(G['users'], 'id', G['games'], 'current_turn_id', offset_x=0.15)
conn(G['users'], 'id', G['games'], 'winner_id',       offset_x=0.30)

# users → game_state
conn(G['users'], 'id', G['game_state'], 'user_id', offset_x=-0.15)

# games → game_state (same column, route right)
conn(G['games'], 'id', G['game_state'], 'game_id', offset_x=0.0)

# users → user_inventory (same column, route right)
conn(G['users'], 'id', G['user_inventory'], 'user_id', offset_x=0.0)

# users → equipped_cards (same column, route right)
conn(G['users'], 'id', G['equipped_cards'], 'user_id', offset_x=0.3)

# users → active_powerups
conn(G['users'], 'id', G['active_powerups'], 'user_id', offset_x=0.0)

# users → game_sessions (users right → game_sessions left)
conn(G['users'], 'id', G['game_sessions'], 'user_id', offset_x=0.0)

# games → active_powerups
conn(G['games'], 'id', G['active_powerups'], 'game_id', offset_x=-0.2)

# games → game_sessions (games left → game_sessions right, route left)
conn(G['games'], 'id', G['game_sessions'], 'game_id', offset_x=0.0)

# questions → game_sessions (same column, route right)
conn(G['questions'], 'id', G['game_sessions'], 'question_id', offset_x=0.0)

# shop_items → user_inventory
conn(G['shop_items'], 'id', G['user_inventory'], 'item_id', offset_x=0.0)

# shop_items → equipped_cards
conn(G['shop_items'], 'id', G['equipped_cards'], 'slot_1_item_id', offset_x=-0.25)
conn(G['shop_items'], 'id', G['equipped_cards'], 'slot_2_item_id', offset_x=0.0)
conn(G['shop_items'], 'id', G['equipped_cards'], 'slot_3_item_id', offset_x=0.25)

# shop_items → active_powerups
conn(G['shop_items'], 'id', G['active_powerups'], 'item_id', offset_x=0.0)

# ─── SAVE ─────────────────────────────────────────────────────────────────────
out = r'C:\Users\user\Desktop\Python Adventure Quest\erd.png'
fig.savefig(out, dpi=DPI, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.close(fig)
print(f'Saved: {out}')
