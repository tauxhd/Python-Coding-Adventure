const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, VerticalAlign, LevelFormat,
  UnderlineType, TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');

// ── helpers ──────────────────────────────────────────────────────────────────
const TNR = 'Times New Roman';
const LINE15 = { line: 360, lineRule: 'auto' }; // 1.5 spacing = 360 twips

function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { ...LINE15, before: 0, after: 160 },
    children: [new TextRun({ text, font: TNR, size: 24, ...opts })],
  });
}

function bodyRuns(runs, extra = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { ...LINE15, before: 0, after: 160 },
    children: runs,
    ...extra,
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { ...LINE15, before: 400, after: 200 },
    children: [new TextRun({ text, font: TNR, size: 32, bold: true })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { ...LINE15, before: 320, after: 160 },
    children: [new TextRun({ text, font: TNR, size: 28, bold: true })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { ...LINE15, before: 240, after: 120 },
    children: [new TextRun({ text, font: TNR, size: 24, bold: true })],
  });
}

function bullet(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { ...LINE15, before: 0, after: 80 },
    numbering: { reference: 'bullets', level: 0 },
    children: [new TextRun({ text, font: TNR, size: 24 })],
  });
}

function numbered(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { ...LINE15, before: 0, after: 80 },
    numbering: { reference: 'steps', level: 0 },
    children: [new TextRun({ text, font: TNR, size: 24 })],
  });
}

function code(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 276, before: 80, after: 80 },
    children: [new TextRun({ text, font: 'Courier New', size: 20 })],
    indent: { left: 720 },
  });
}

function gap(n = 1) {
  return Array.from({ length: n }, () => new Paragraph({
    spacing: { before: 0, after: 0, line: 240 },
    children: [new TextRun('')],
  }));
}

function coverLine(text, size = 24, bold = false, gap_after = 0) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: gap_after },
    children: [new TextRun({ text, font: TNR, size, bold })],
  });
}

function tocLine(label, page) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { ...LINE15, before: 0, after: 80 },
    tabStops: [{ type: TabStopType.RIGHT, position: 8640, leader: 'dot' }],
    children: [
      new TextRun({ text: label, font: TNR, size: 24 }),
      new TextRun({ text: '\t' + page, font: TNR, size: 24 }),
    ],
  });
}

function tocSubLine(label, page) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 320, before: 0, after: 60 },
    indent: { left: 360 },
    tabStops: [{ type: TabStopType.RIGHT, position: 8640, leader: 'dot' }],
    children: [
      new TextRun({ text: label, font: TNR, size: 22 }),
      new TextRun({ text: '\t' + page, font: TNR, size: 22 }),
    ],
  });
}

// ── data dictionary table builder ────────────────────────────────────────────
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: '888888' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const COL_WIDTHS = [1800, 1600, 2200, 3760]; // sum = 9360
const TABLE_W = 9360;

function ddTable(rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: ['Field', 'Data Type', 'Constraints', 'Description'].map((h, i) =>
      new TableCell({
        borders: BORDERS,
        width: { size: COL_WIDTHS[i], type: WidthType.DXA },
        shading: { fill: 'D9E1F2', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [new Paragraph({
          children: [new TextRun({ text: h, font: TNR, size: 20, bold: true })],
        })],
      })
    ),
  });

  const dataRows = rows.map(r =>
    new TableRow({
      children: r.map((cell, i) =>
        new TableCell({
          borders: BORDERS,
          width: { size: COL_WIDTHS[i], type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({
            children: [new TextRun({ text: cell, font: TNR, size: 20 })],
          })],
        })
      ),
    })
  );

  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: COL_WIDTHS,
    rows: [headerRow, ...dataRows],
  });
}

// ── header / footer factories ─────────────────────────────────────────────────
function makeHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '444444', space: 4 } },
      tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
      children: [
        new TextRun({ text: 'CT117-3-2-FWDD | Further Web Design and Development', font: TNR, size: 18 }),
        new TextRun({ text: '\tPython Adventure Quest', font: TNR, size: 18 }),
      ],
    })],
  });
}

function makeFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Page ', font: TNR, size: 20 }),
        new TextRun({ children: [PageNumber.CURRENT], font: TNR, size: 20 }),
      ],
    })],
  });
}

// ── note paragraph ────────────────────────────────────────────────────────────
function note(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { ...LINE15, before: 80, after: 80 },
    children: [new TextRun({ text, font: TNR, size: 22, italics: true, color: '666666' })],
  });
}

// ═════════════════════════════════════════════════════════════════════════════
//  DOCUMENT
// ═════════════════════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: 'steps',
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },

  sections: [

    // ── SECTION 1: Cover page (no header/footer) ──────────────────────────────
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1800, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        coverLine('Asia Pacific University of Technology and Innovation', 28, true, 800),
        ...gap(2),
        coverLine('CT117-3-2-FWDD', 26, false, 80),
        coverLine('Further Web Design and Development', 26, false, 800),
        ...gap(2),
        coverLine('Python Adventure Quest', 36, true, 80),
        coverLine('Final Report', 28, false, 800),
        ...gap(3),
        coverLine('Name: Tauedea Arehui Gabi', 24, false, 80),
        coverLine('Student ID: TP083304', 24, false, 80),
        coverLine('Intake: APD2F2509SE', 24, false, 80),
        coverLine('Subject: CT117-3-2-FWDD Further Web Design and Development', 24, false, 80),
        coverLine('Project Title: Python Adventure Quest', 24, false, 0),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },

    // ── SECTION 2: Table of Contents ──────────────────────────────────────────
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: { default: makeHeader() },
      footers: { default: makeFooter() },
      children: [
        h1('Table of Contents'),
        ...gap(1),
        tocLine('1.  Introduction / Project Plan', '3'),
        tocSubLine('1.1  Project Overview', '3'),
        tocSubLine('1.2  Objectives', '4'),
        tocSubLine('1.3  Scope', '4'),
        tocSubLine('1.4  End User Specifications', '5'),
        tocSubLine('1.5  Major Functions of the Web Application', '5'),
        tocLine('2.  Design', '8'),
        tocSubLine('2.1  Entity Relationship Diagram (ERD)', '8'),
        tocSubLine('2.2  Data Dictionary', '8'),
        tocSubLine('2.3  Storyboard', '13'),
        tocLine('3.  Implementation', '17'),
        tocSubLine('3.1  User Authentication', '17'),
        tocSubLine('3.2  Game Room Creation and QR Code', '18'),
        tocSubLine('3.3  Real Time Gameplay with Socket.io', '19'),
        tocSubLine('3.4  Shop and Elixir System', '22'),
        tocSubLine('3.5  Form Validation', '23'),
        tocLine('4.  User Guidance', '24'),
        tocSubLine('4.1  Setting Up the Physical Component', '24'),
        tocSubLine('4.2  How to Register and Login', '24'),
        tocSubLine('4.3  Equipping Items Before a Game', '25'),
        tocSubLine('4.4  Starting or Joining a Game', '25'),
        tocSubLine('4.5  Playing the Game', '26'),
        tocSubLine('4.6  Winning the Game', '27'),
        tocLine('5.  Conclusions', '28'),
        tocLine('6.  References', '29'),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },

    // ── SECTION 3: Main content ───────────────────────────────────────────────
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: { default: makeHeader() },
      footers: { default: makeFooter() },
      children: [

        // ── 1. Introduction ──────────────────────────────────────────────────
        h1('1.  Introduction / Project Plan'),

        h2('1.1  Project Overview'),
        body('Python Adventure Quest is an educational hybrid game that was developed as part of the CT117-3-2 Further Web Design and Development module at Asia Pacific University of Technology and Innovation. The main idea behind this project is to combine a physical board game with a digital web application to create an engaging and interactive way for users to learn and test their knowledge on a specific Python programming concept, which in this case is Control Flow. Control flow in Python covers topics such as if/elif/else statements, for loops, while loops, as well as special loop control keywords such as break, continue, and how to use the range() function effectively.'),
        body('The reason Control Flow was chosen as the Python concept is because it is one of the most fundamental aspects of Python programming and coding in general. Understanding how to control the flow of a program is a very important skill because without it, you would not be able to make decisions in your code, loop through data, or even create meaningful programs. With this said, it is also a concept that many beginners struggle with now a days, making it a perfect topic for a formative assessment type game where users can practice and test their understanding inn a fun and engaging way.'),
        body('The web application serves as the digital component of the educational hybrid game, and works together with the physical board game component to create the full hybrid experience. The web app is responsible for things like user registration and login, real time game sessions, question delivery, score tracking, a shop system, and a leaderboard to show player rankings. The physical component is an adventure themed board game with 20 spaces per player track, and question cards of different rarities that players scan using QR codes to interact with the digital component. When a player scans a card, the app picks up the scan and randomly determines the outcome, which can be a Python question, a trap, or a windfall reward, and this is what connects the physical and digital experience together.'),

        h2('1.2  Objectives'),
        body('The main objectives of this project are as follows:'),
        bullet('To design and implement a multi page web application using modern UI/UX principles that is engaging and easy to use for players.'),
        bullet('To develop the web application using Node.js and Express.js as the backend, and provide a well defined API for the client server communication between the game and the server.'),
        bullet('To integrate a MySQL database for data persistence, allowing the system to store and retrieve user data, game states, questions, items and other important information.'),
        bullet('To incorporate session based authentication to allow users to register and login securely, safeguarding their personal data and game progress.'),
        bullet('To connect the physical and digital components of the game through QR code scanning, where each question card on the physical board contains a QR code that links to the web application.'),

        h2('1.3  Scope'),
        body('The scope of this project is focused on creating a fully functional educational hybrid game prototype that is capable of supporting two players in a real time game session. The game focuses specifically on Python Control Flow concepts only, and will not cover any other Python topics. The web application includes a full user authentication system, a game lobby and room system, real time gameplay using Socket.io, a shop where players can spend their earned elixir on power up items, a player bag and card equipping system, a leaderboard, and an admin panel for managing questions and content.'),
        body('The physical component consists of a fantasy and coding dungeon themed board with 20 spaces, player tokens, dice, question cards with QR codes printed on them, and event cards. The board has different types of spaces including safe spaces, blessing spaces that give elixir, cursed spaces that cause the player to skip a turn, a shortcut space, scan spaces where players must scan a card, and a goal space at space 20 which resets the player to the start and deals damage to the opponent. There are two player tracks on the board, one for each player, and both tracks follow the same 20 space layout.'),
        body('It is also important to note what is outside the scope of this project. The game does not support more than 2 players at once, it does not include any audio or sound effects, and it does not support offline play. All gameplay requires an active internet connection since everything runs through the web server and Socket.io.'),

        h2('1.4  End User Specifications'),
        body('The game is designed for two types of users. The first type is the regular player or student user, which is the main target audience of this game. These users are expected to be students who have some basic familiarity with Python programming or are currently in the process of learning it. They should be comfortable using a web browser on a smartphone or laptop, and should be able to navigate the game with minimal guidance. The interface is designed to be very user friendly so even users with limited technical experience can understand and play the game without much trouble.'),
        body('The second type of user is the admin user, which is the host or game master who is responsible for managing the content of the game. The admin has access to a separate admin panel where they can add, edit or delete questions, manage card outcomes, view registered players and handle other content management tasks. The admin is typically the teacher or course facilitator running the game session. The admin account requires a special flag to be set in the database and cannot be created through the normal registration flow for security reasons.'),

        h2('1.5  Major Functions of the Web Application'),
        body('The major functions of the Python Adventure Quest web application are described in detail below.'),
        bodyRuns([
          new TextRun({ text: 'User Authentication: ', font: TNR, size: 24, bold: true }),
          new TextRun({ text: 'Players can register for an account using a username, email and password. The password is securely hashed using bcrypt before being stored in the database. Users can then login to their account and the system will keep them logged in using session based authentication. The session persists for 24 hours so players do not need to login again every time they return to the game. When they logout, the session is destroyed and they are redirected back to the login page.', font: TNR, size: 24 }),
        ]),
        bodyRuns([
          new TextRun({ text: 'Game Lobby and Room System: ', font: TNR, size: 24, bold: true }),
          new TextRun({ text: 'Logged in players can access the game lobby where they can either create a new game room or join an existing one. When a player creates a game room, a unique 6 character room code is generated and displayed to them along with a QR code that the second player can scan to join the game directly. The second player can also manually type inn the room code to join if they prefer not to scan. The room stays in a waiting state until both players have joined, at which point the game status changes to active and both players are taken to the game screen.', font: TNR, size: 24 }),
        ]),
        bodyRuns([
          new TextRun({ text: 'Real Time Gameplay: ', font: TNR, size: 24, bold: true }),
          new TextRun({ text: 'Once both players have joined the room, the game begins and both players can see each others status in real time thanks to Socket.io. Each player rolls a dice on their turn, moves along the board, and lands on different types of spaces that trigger different effects. When a player lands on a scan space, they must scan one of their physical question cards which triggers the web app to give them either a Python question, a trap, or a windfall reward. All of this happens in real time and both players can see the results simultaneously without needing to refresh the page.', font: TNR, size: 24 }),
        ]),
        bodyRuns([
          new TextRun({ text: 'Question and Answer System: ', font: TNR, size: 24, bold: true }),
          new TextRun({ text: 'When a player receives a Python question, the web app displays a multiple choice question related to Python Control Flow. The difficulty of the question depends on the rarity of the card that was scanned. Common cards give basic if/else questions worth 5 elixir and 5 XP if answered correctly, Rare cards give for/while loop questions worth 15 elixir, and Legendary cards give advanced nested loop, break and continue questions worth 30 elixir. If the player answers incorrectly they still earn 1 XP for participating. After every answer, the correct answer is revealed along with an explanation so the player can learn from the question regardless of whether they got it right or wrong.', font: TNR, size: 24 }),
        ]),
        bodyRuns([
          new TextRun({ text: 'Shop System: ', font: TNR, size: 24, bold: true }),
          new TextRun({ text: 'Players earn elixir throughout the game by answering questions correctly and landing on blessing spaces. The elixir can be spent in the shop to purchase power up items before a game. These items are loaded into the players active item deck for the match and can be used during a game to gain advantages or to hinder the opponent. There is also a bonus elixir feature where players can answer a question outside of a game to earn extra elixir, which keeps the learning aspect present even between matches.', font: TNR, size: 24 }),
        ]),
        bodyRuns([
          new TextRun({ text: 'Player Inventory and Card Equipping: ', font: TNR, size: 24, bold: true }),
          new TextRun({ text: 'Players have a bag that holds all the items they have purchased from the shop. Before entering a game, players can equip up to 3 items into their card slots which are the items that will be available for them to use during the match. This adds a strategic element to the game because players need to think about which items to bring based on their play style and how they plan to approach the game.', font: TNR, size: 24 }),
        ]),
        bodyRuns([
          new TextRun({ text: 'Leaderboard: ', font: TNR, size: 24, bold: true }),
          new TextRun({ text: 'A global leaderboard shows all registered players ranked by their total XP earned. This adds a competitive element to the game because players are motivated to keep playing and earning XP to climb the leaderboard and improve their rank.', font: TNR, size: 24 }),
        ]),
        bodyRuns([
          new TextRun({ text: 'Admin Panel: ', font: TNR, size: 24, bold: true }),
          new TextRun({ text: 'The admin user has access to a separate panel where they can manage all the questions in the database, view registered players, and handle other content management tasks. This makes it easy for the teacher or game facilitator to update the question pool without needing to directly access the database.', font: TNR, size: 24 }),
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ── 2. Design ────────────────────────────────────────────────────────
        h1('2.  Design'),

        h2('2.1  Entity Relationship Diagram (ERD)'),
        note('[Insert ERD diagram here. The ERD should show all 10 tables with their relationships and foreign keys clearly labeled.]'),
        body('The ERD above shows the relationships between all the tables in the Python Adventure Quest database. There are 10 main tables in total and they all work together to support the full functionality of the game. The users table is the central table that most other tables connect to, because almost everything in the game is tied to a specific user account. The games table connects both players and tracks the overall state of each game session, while the game_state table tracks the individual state of each player within a game. The shop_items table is referenced by user_inventory, equipped_cards and active_powerups to manage the item system across different stages, from purchasing, to equipping, to using in game.'),

        h2('2.2  Data Dictionary'),
        body('The data dictionary below describes each table in the database, the fields it contains, their data types, and what they are used for.'),

        h3('Table: users'),
        body('This is the main table that stores all registered user accounts. It contains the users id, username, email and hashed password. It also stores the users current XP and elixir amounts, their rank name which changes based on XP level, and their character attributes for damage, defense and agility. The is_admin field determines whether the user has administrator access to the admin panel.'),
        ddTable([
          ['id', 'INT', 'PK, AUTO_INCREMENT', 'Unique identifier for each user'],
          ['username', 'VARCHAR(50)', 'UNIQUE, NOT NULL', "The player's chosen display name"],
          ['email', 'VARCHAR(100)', 'UNIQUE, NOT NULL', 'Email address used for login'],
          ['password_hash', 'VARCHAR(255)', 'NOT NULL', "The bcrypt hashed version of the user's password"],
          ['xp', 'INT', 'DEFAULT 0', 'Total experience points the user has earned'],
          ['elixir', 'INT', 'DEFAULT 0', "The user's current elixir currency balance"],
          ['rank_name', 'ENUM', "DEFAULT 'Code Initiate'", "The user's current rank title based on XP"],
          ['damage_attr', 'INT', 'DEFAULT 0', 'Attribute that increases lap damage dealt to opponent'],
          ['defense_attr', 'INT', 'DEFAULT 0', 'Attribute that reduces incoming lap damage'],
          ['agility_attr', 'INT', 'DEFAULT 0', 'Allows dice to be rolled twice, higher result taken'],
          ['attr_points', 'INT', 'DEFAULT 0', 'Unspent attribute points available to allocate'],
          ['is_admin', 'TINYINT(1)', 'DEFAULT 0', 'Flag for admin access (1 = admin, 0 = regular user)'],
          ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP', 'When the account was created'],
        ]),
        ...gap(1),

        h3('Table: questions'),
        body('This table stores all the Python Control Flow questions used in the game. Each question has a difficulty level of either common, rare or legendary which determines when it will be selected and shown to a player. Each question has 4 multiple choice options and the correct answer stored as a single letter. An explanation is also stored for each question to show players the reasoning behind the correct answer after they submit.'),
        ddTable([
          ['id', 'INT', 'PK, AUTO_INCREMENT', 'Unique identifier for the question'],
          ['difficulty', 'ENUM', 'NOT NULL', 'The difficulty level: common, rare, or legendary'],
          ['question_text', 'TEXT', 'NOT NULL', 'The actual question being asked'],
          ['option_a', 'VARCHAR(255)', 'NOT NULL', 'Answer option A'],
          ['option_b', 'VARCHAR(255)', 'NOT NULL', 'Answer option B'],
          ['option_c', 'VARCHAR(255)', 'NOT NULL', 'Answer option C'],
          ['option_d', 'VARCHAR(255)', 'NOT NULL', 'Answer option D'],
          ['correct_ans', 'ENUM', 'NOT NULL', 'The letter of the correct answer (a, b, c, or d)'],
          ['explanation', 'TEXT', 'NOT NULL', 'Explanation of why the answer is correct'],
        ]),
        ...gap(1),

        h3('Table: card_outcomes'),
        body('This table stores all the possible trap and windfall outcomes that can happen when a player scans a card and gets a non-question result. Each outcome has a type of either trap or windfall, a name, a description, an effect type that tells the server what to do, an effect value, and a weight that influences how frequently it appears relative to other outcomes of the same type.'),
        ddTable([
          ['id', 'INT', 'PK, AUTO_INCREMENT', 'Unique identifier'],
          ['type', 'ENUM', 'NOT NULL', 'Whether this is a trap or windfall outcome'],
          ['name', 'VARCHAR(100)', 'NOT NULL', 'The name of the outcome'],
          ['description', 'TEXT', 'NOT NULL', 'Flavour text description shown to the player'],
          ['effect_type', 'VARCHAR(50)', 'NULL', 'The code identifier for the effect to apply'],
          ['effect_value', 'FLOAT', 'DEFAULT 0', 'The magnitude of the effect'],
          ['weight', 'INT', 'DEFAULT 10', 'Relative probability weight for random selection'],
        ]),
        ...gap(1),

        h3('Table: shop_items'),
        body('Stores all the power up items available for purchase in the shop. Each item has a cost in elixir, a description of what it does, and an effect_type that the game logic uses to identify which effect to apply when the item is used during a match.'),
        ddTable([
          ['id', 'INT', 'PK, AUTO_INCREMENT', 'Unique item identifier'],
          ['name', 'VARCHAR(100)', 'NOT NULL', 'Display name of the item'],
          ['description', 'TEXT', 'NOT NULL', 'What the item does during a game'],
          ['effect_type', 'VARCHAR(50)', 'NOT NULL', 'Code identifier for the effect'],
          ['effect_value', 'FLOAT', 'DEFAULT 0', 'Numeric value associated with the effect'],
          ['cost', 'INT', 'NOT NULL', 'Elixir cost to purchase from the shop'],
          ['cooldown_turns', 'INT', 'DEFAULT 0', 'Turns before the item can be used again'],
          ['image_file', 'VARCHAR(100)', 'NULL', 'Filename of the item image'],
        ]),
        ...gap(1),

        h3('Table: user_inventory'),
        body('A junction table that links users to the items they have purchased from the shop. It tracks how many of each item a user currently owns. When a user buys the same item again, the quantity is incremented instead of creating a new row.'),
        ddTable([
          ['id', 'INT', 'PK, AUTO_INCREMENT', 'Unique record identifier'],
          ['user_id', 'INT', 'FK references users.id', 'The user who owns this item'],
          ['item_id', 'INT', 'FK references shop_items.id', 'The item being owned'],
          ['quantity', 'INT', 'DEFAULT 1', 'How many of this item the user currently has'],
        ]),
        ...gap(1),

        h3('Table: equipped_cards'),
        body('Stores which items a player has selected to bring into their next game. Each player can have up to 3 equipped items stored in slot 1, slot 2 and slot 3. There is a unique constraint on user_id so each user can only have one row in this table, meaning they have one set of equipped cards at a time.'),
        ddTable([
          ['id', 'INT', 'PK, AUTO_INCREMENT', 'Unique record identifier'],
          ['user_id', 'INT', 'FK, UNIQUE, references users.id', 'The user this belongs to'],
          ['slot_1_item_id', 'INT', 'FK references shop_items.id, nullable', 'Item equipped in slot 1'],
          ['slot_2_item_id', 'INT', 'FK references shop_items.id, nullable', 'Item equipped in slot 2'],
          ['slot_3_item_id', 'INT', 'FK references shop_items.id, nullable', 'Item equipped in slot 3'],
        ]),
        ...gap(1),

        h3('Table: games'),
        body('Stores each individual game session that is created. A game tracks which two players are involved, whose turn it currently is, the current status of the game, and who won. The room_code is the unique identifier players use to find and join the same game.'),
        ddTable([
          ['id', 'INT', 'PK, AUTO_INCREMENT', 'Unique game identifier'],
          ['room_code', 'VARCHAR(10)', 'UNIQUE, NOT NULL', 'The 6-character code used to join the game'],
          ['player1_id', 'INT', 'FK references users.id, NOT NULL', 'The player who created the room'],
          ['player2_id', 'INT', 'FK references users.id, nullable', 'The player who joined the room'],
          ['current_turn_id', 'INT', 'FK references users.id', 'Whose turn it currently is'],
          ['status', 'ENUM', "DEFAULT 'waiting'", 'The game status: waiting, active, or finished'],
          ['winner_id', 'INT', 'FK references users.id, nullable', 'The user who won (set when game ends)'],
          ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP', 'When the game was created'],
        ]),
        ...gap(1),

        h3('Table: game_state'),
        body('This is one of the most important tables in the database because it tracks everything about each individual players state within a specific game. This includes their HP, their board position, any active status effects, and various boolean flags that represent pending power up states. There is one row per player per game.'),
        ddTable([
          ['id', 'INT', 'PK, AUTO_INCREMENT', 'Unique identifier'],
          ['game_id', 'INT', 'FK references games.id', 'The game this state belongs to'],
          ['user_id', 'INT', 'FK references users.id', 'The player this state belongs to'],
          ['hp', 'FLOAT', 'DEFAULT 5', "The player's current health points"],
          ['position', 'INT', 'DEFAULT 0', "The player's current space on the board (0 to 20)"],
          ['skip_next_turn', 'BOOLEAN', 'DEFAULT FALSE', 'Whether this player must skip their next turn'],
          ['fog_turns', 'INT', 'DEFAULT 0', "How many turns the opponent's position is hidden"],
          ['frost_turns', 'INT', 'DEFAULT 0', 'How many more turns this player cannot use items'],
          ['poison_turns', 'INT', 'DEFAULT 0', 'How many more turns elixir is drained at turn start'],
          ['elixir_this_game', 'INT', 'DEFAULT 0', 'Total elixir earned during this game session'],
          ['extra_turn_pending', 'BOOLEAN', 'DEFAULT FALSE', 'Whether an extra turn is queued after the current one'],
          ['item_used_this_turn', 'BOOLEAN', 'DEFAULT FALSE', 'Whether an item was already used this turn'],
          ['double_damage_pending', 'BOOLEAN', 'DEFAULT FALSE', 'Whether the next lap completion deals double damage'],
          ['ghost_step_pending', 'BOOLEAN', 'DEFAULT FALSE', 'Whether the next cursed space will be ignored'],
          ['mirror_active', 'BOOLEAN', 'DEFAULT FALSE', 'Whether opponent targeting effects will be reflected back'],
          ['time_warp_pending', 'BOOLEAN', 'DEFAULT FALSE', 'Whether the next scan card will be skipped'],
        ]),
        ...gap(1),

        h3('Table: active_powerups'),
        body('When a game starts, the 3 items that both players had equipped are loaded into this table for that specific game. This allows the server to track whether each item has been used and handle item availability during the match. When an item is used, the is_used flag is set to TRUE so it cannot be used again.'),
        ddTable([
          ['id', 'INT', 'PK, AUTO_INCREMENT', 'Unique identifier'],
          ['game_id', 'INT', 'FK references games.id', 'The game this power up belongs to'],
          ['user_id', 'INT', 'FK references users.id', 'The player who owns this power up'],
          ['item_id', 'INT', 'FK references shop_items.id', 'The item being tracked'],
          ['is_used', 'BOOLEAN', 'DEFAULT FALSE', 'Whether this item has already been used in the match'],
          ['cooldown_remaining', 'INT', 'DEFAULT 0', 'How many turns remain before this item is usable again'],
        ]),
        ...gap(1),

        h3('Table: game_sessions'),
        body('A log table that records every significant action that happens during a game. Every time a player answers a question or triggers a trap or windfall outcome, a new row is inserted into this table. This creates a full history of every game session that can be used for reviewing performance or debugging issues.'),
        ddTable([
          ['id', 'INT', 'PK, AUTO_INCREMENT', 'Unique record identifier'],
          ['game_id', 'INT', 'FK references games.id', 'The game this action happened in'],
          ['user_id', 'INT', 'FK references users.id', 'The player who took the action'],
          ['question_id', 'INT', 'FK references questions.id, nullable', 'The question answered (if applicable)'],
          ['answer_given', 'ENUM', 'nullable', 'The answer the player submitted (a, b, c, or d)'],
          ['is_correct', 'BOOLEAN', 'nullable', 'Whether the answer was correct'],
          ['elixir_earned', 'INT', 'DEFAULT 0', 'Elixir earned from this action'],
          ['outcome_type', 'ENUM', 'nullable', 'Whether this was a question, trap or windfall'],
          ['outcome_name', 'VARCHAR(100)', 'nullable', 'Name of the trap or windfall if applicable'],
          ['created_at', 'TIMESTAMP', 'DEFAULT CURRENT_TIMESTAMP', 'When this action occurred'],
        ]),
        ...gap(1),

        h3('Table: board_spaces'),
        body('A configuration table that defines all 20 spaces on the game board. Each space has a type and an optional effect. This table is seeded with fixed data and does not change during gameplay. It is queried when the game page loads so the frontend can render the board correctly.'),
        ddTable([
          ['space_number', 'INT', 'PRIMARY KEY', 'The space number from 1 to 20'],
          ['space_type', 'ENUM', 'NOT NULL', 'The type of space: safe, cursed, blessing, shortcut, scan, or goal'],
          ['effect_type', 'VARCHAR(50)', 'nullable', 'The code identifier for any effect this space triggers'],
          ['effect_value', 'FLOAT', 'DEFAULT 0', 'The value associated with the effect'],
          ['jump_to', 'INT', 'nullable', 'The destination space for shortcut type spaces'],
        ]),
        ...gap(1),

        h2('2.3  Storyboard'),
        body('The storyboard below describes the flow of the web application from the users perspective, covering all the main screens and how they connect to each other.'),

        h3('Screen 1: Login Page'),
        body('The first screen a user sees when visiting Python Adventure Quest is the login page. The user lands here because the root URL automatically redirects to /login. The page contains a simple form with an email field and a password field, a Login button, and a link to the register page for users who do not have an account yet. If the login attempt fails due to incorrect credentials, an error message is displayed at the top of the form. The login page is also where users are redirected after successfully registering or after logging out.'),
        note('[Insert screenshot of Login Page here]'),

        h3('Screen 2: Register Page'),
        body('New users can create their account from the register page. The form contains fields for a desired username, an email address, a password, and a confirm password field. All fields are required and the server validates each one before creating the account. If any validation fails such as the username being too short or the passwords not matching, the user is redirected back to the register page with an error message explaining what went wrong.'),
        note('[Insert screenshot of Register Page here]'),

        h3('Screen 3: Profile Page'),
        body('After logging in, the user is taken to their profile page which serves as the main hub of the application. This is the first page a regular user sees after a successful login. The profile page shows the users current XP, elixir balance, rank name, and their current attribute stats for damage, defense and agility. Users can also spend any unspent attribute points here to invest in the attributes that suit their play style. For example, putting points into damage means each lap completion deals more damage to the opponent, while defense reduces incoming damage.'),
        note('[Insert screenshot of Profile Page here]'),

        h3('Screen 4: Shop Page'),
        body('The shop page displays all the available power up items that players can purchase using their elixir currency. Each item card shows the items name, a description of what it does during a game, the elixir cost, and how many of that item the player currently owns in their inventory. Players can purchase items by clicking the Buy button. If they do not have enough elixir, an error message will inform them. The shop also has a section where players can answer bonus questions to earn additional elixir outside of a game.'),
        note('[Insert screenshot of Shop Page here]'),

        h3('Screen 5: Bag / Inventory Page'),
        body('The bag page allows players to view all the items they have purchased and equip up to 3 of them into their card slots for the next game. Items that are already equipped are highlighted differently from unequipped ones. This step is important because only items that are equipped before the game starts will be available during the match. If a player enters a game without equipping any items, a warning is shown on the lobby page to remind them.'),
        note('[Insert screenshot of Bag / Inventory Page here]'),

        h3('Screen 6: Game Lobby'),
        body('The lobby page is where players choose to either start a new game or join an existing one. From here they can click Create Game to generate a new room, or they can type a room code into the Join Game form and click Join to enter an existing room. If a player has no items equipped, a notice is displayed at the top of the lobby page reminding them to visit their bag first.'),
        note('[Insert screenshot of Game Lobby here]'),

        h3('Screen 7: Waiting Room'),
        body('After creating a game, the player is taken to the waiting room which shows the unique room code for the game and a QR code. The QR code encodes the join URL so the second player can scan it directly with their phone camera to join the game. The page is connected via Socket.io and automatically transitions to the game when the second player joins, so the first player does not need to do anything else after sharing the code.'),
        note('[Insert screenshot of Waiting Room with QR code here]'),

        h3('Screen 8: Game Page'),
        body('The main gameplay screen is the most complex page in the application. It shows both players status panels side by side, including their HP, current position on the board, and their item cards if applicable. The active player has a Roll Dice button available that they can click on their turn. Once clicked the dice result is shown and the player token moves on both the physical board and on the digital display. The app then handles the effect of whatever space the player landed on automatically. When a scan space is landed on, a Scan Card prompt appears asking the player to pick up a physical question card and press the button to scan it.'),
        note('[Insert screenshot of main Game Page here]'),

        h3('Screen 9: Question Modal'),
        body('When a Python question is triggered by a scan card event, a modal popup appears over the game screen showing the question text and four labeled answer choices. The player selects one of the options and clicks Submit. After submitting, the modal updates to show whether the answer was correct, what the correct answer was, and a short explanation. The elixir and XP earned are also displayed here. The modal closes after a few seconds and the game state updates to reflect the changes.'),
        note('[Insert screenshot of Question Modal here]'),

        h3('Screen 10: Leaderboard'),
        body('The leaderboard page shows all registered players sorted by their total XP from highest to lowest. The top 3 players have special styling to highlight their positions. This page is publicly visible to all logged in users and serves as a motivator for players to keep playing and earning XP to improve their rank.'),
        note('[Insert screenshot of Leaderboard here]'),

        h3('Screen 11: Admin Panel'),
        body('Admin users have access to a special admin panel that regular users cannot see. The admin navigation contains separate sections for managing questions, managing card outcomes, and viewing all registered players. From the questions section, admins can view all questions currently in the database, add new ones, edit existing ones, or delete questions they no longer want included in the game.'),
        note('[Insert screenshot of Admin Panel here]'),

        new Paragraph({ children: [new PageBreak()] }),

        // ── 3. Implementation ────────────────────────────────────────────────
        h1('3.  Implementation'),

        h2('3.1  User Authentication'),
        body('The user authentication system is handled by the auth.js route file and uses the bcryptjs library for password hashing and the express-session package for managing user sessions. When a user attempts to register, the server first runs through a series of validation checks before doing anything with the database. These checks include making sure all form fields have been filled in, that the username is between 3 and 20 characters, that the email address matches a valid email format using a regular expression, that the password is at least 6 characters long, and that the password and confirm password fields match each other.'),
        body('Once all validations pass, the server queries the database to check whether the email or username is already taken by an existing user. If either one is already in use, the user is sent back to the register page with an appropriate error message. If both are available, the password is hashed using bcrypt.hash() with a salt round value of 10 before it is stored in the database. This is an important security measure because it means that even if someone were to gain access to the database directly, they would not be able to see or use the original passwords since the hashes are one way and practically impossible to reverse.'),
        code("const hash = await bcrypt.hash(password, 10);"),
        code("await db.query("),
        code("  'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',"),
        code("  [username, email, hash]"),
        code(");"),
        body('When a user logs in, the server retrieves their user record from the database using the provided email address, then uses bcrypt.compare() to check if the plain text password they entered matches the stored hash. If it matches, the users relevant information is stored into the req.session.user object. This session object is then persisted using express-session and is available on every subsequent request the user makes. The session cookie is configured with a maxAge of 24 hours, meaning users stay logged in for an entire day before their session expires and they need to login again.'),
        body('The application uses two middleware functions to control access to routes. The requireLogin middleware is applied to all routes that should only be accessible to authenticated users. If a user without an active session tries to access a protected route, they are redirected to the login page. The requireGuest middleware does the opposite and is applied to the login and register routes to prevent users who are already logged in from accessing those pages again.'),

        h2('3.2  Game Room Creation and QR Code'),
        body('The game route in game.js handles all aspects of creating and joining game rooms. When a player clicks the Create Game button on the lobby page, a POST request is sent to /game/create. The server then generates a unique 6 character room code using a function that randomly selects characters from a specially chosen character set. The character set was designed to avoid visually confusing characters like the letter O and the number 0, or the letter I and the number 1, to make the code easier to read and type manually if needed.'),
        code("function generateRoomCode() {"),
        code("  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';"),
        code("  return Array.from({ length: 6 }, () =>"),
        code("    chars[Math.floor(Math.random() * chars.length)]).join('');"),
        code("}"),
        body('The generated code is then checked against the database to make sure no other game is currently using that same code. If the code is already taken, a new one is generated and checked again, repeating until a unique code is found. Once a unique code is confirmed, a new row is inserted into the games table with the room code and the creating users ID as player1_id, and a corresponding game_state row is created for that player.'),
        body('On the waiting room page, the server generates a QR code image using the qrcode npm package. The QR code encodes a full URL that includes the room code as a query parameter, specifically formatted as /game/join?code=ROOMCODE. When the second player scans this QR code with their phone, their browser navigates to that URL and the server automatically processes them into the game using the shared join logic in the performJoin function. This function handles everything needed to add the second player to the game, including updating the games table, inserting their game_state row, and loading both players equipped items into the active_powerups table for that game. After joining, Socket.io emits a game-ready event to both players in the room to notify them that the game can begin.'),
        code("const joinUrl = `${req.protocol}://${req.get('host')}/game/join?code=${roomCode}`;"),
        code("qrCodeUrl = await QRCode.toDataURL(joinUrl, {"),
        code("  errorCorrectionLevel: 'M', type: 'image/png', width: 240"),
        code("});"),

        h2('3.3  Real Time Gameplay with Socket.io'),
        body('The real time game logic is handled entirely by the gameSocket.js file which initialises a Socket.io event listener system when the server starts. Socket.io works by maintaining persistent connections between the server and each connected client, and allows the server to emit events to all clients in a specific room simultaneously. This is what makes the real time aspect of the game possible, because when one player does something on their turn, both players see the update at the same time without either of them having to refresh the page.'),

        h3('Roll Dice'),
        body('When a player clicks the Roll Dice button on their turn, the game client emits a roll-dice Socket.io event to the server along with the room code. The server first verifies that the socket emitting the event actually belongs to the player whose turn it currently is by comparing the session user ID with the current_turn_id stored in the games table. This check is very important because without it any player could technically emit a roll event even when it is not their turn.'),
        body('After confirming it is the correct players turn, the server calls the tickStatusEffects function which processes any active status effects on the player. For example if the player has poison_turns greater than 0, they lose 5 elixir at the start of their turn and the counter is decremented. If the player has fog_turns or frost_turns active, those counters are also decremented here.'),
        body('The server then checks if the player has a skip_next_turn flag set from a previous cursed space. If they do, the skip flag is cleared and the turn is passed to the opponent immediately without the player being able to move. Otherwise the dice roll is processed. If the player has an agility attribute greater than 0, the dice is rolled twice using Math.random() and the higher of the two results is used, giving them a small but meaningful advantage. The new position is calculated and the type of space the player landed on is determined using the BOARD configuration object. Depending on the space type, different effects are applied to game_state in the database.'),

        h3('Scan Card and Question System'),
        body('When a player lands on a scan space and presses the Scan Card button, the client emits a scan-card event. The server first checks if the player has a time_warp_pending flag set, which means they have an active Time Warp item. If so, the scan is skipped entirely and the turn ends. Otherwise the server checks if a Curse Scroll is active on the player, which would force the next question to be legendary difficulty.'),
        body('The server then calls getRandomCardOutcome() to determine what the player gets. This function uses a weighted probability system where the roll variable is a random number between 0 and 100. If it falls below 55 the outcome is a question, below 85 it is a trap, and otherwise it is a windfall. This gives a 55% chance of a question, 30% chance of a trap and 15% chance of a windfall.'),
        code("const roll = Math.random() * 100;"),
        code("let type = roll < 55 ? 'question' : roll < 85 ? 'trap' : 'windfall';"),
        body('If the outcome is a question, a similar probability roll is done to determine the difficulty. The server then queries the questions table for a random question of that difficulty and emits a show-question event to the scanning player. An opponent-answering event is also emitted to the other player in the room so they can see that their opponent is currently answering a question.'),

        h3('Submit Answer'),
        body('When the player submits their answer, a submit-answer event is emitted to the server containing the question ID, the selected answer letter and the difficulty. The server retrieves the correct answer from the database and compares it to the submitted answer. If correct, the elixir reward is calculated based on difficulty (5 for common, 15 for rare, 30 for legendary). If the player has an active Elixir Surge item, the elixir reward is doubled. The elixir and XP are then added to both the game_state and the users record in the database, and a row is inserted into game_sessions to log the answer. An answer-feedback event is then emitted back to the player with the result and explanation.'),

        h3('Item Usage'),
        body('Players can use their equipped items during their turn by clicking on them in the item bar. The use-item event handler in gameSocket.js uses a switch statement to handle each different effect_type. Before applying any effect, the server checks that it is the correct players turn, that they have not already used an item this turn (one item per turn limit), and that they are not affected by the Cursed Frost status which blocks item usage. Some items like Double Damage and Ghost Step set a pending flag in game_state that gets consumed later at the appropriate moment. Other items like Fog of War and Elixir Drain target the opponent directly. The Mirror Hex trap adds an interesting dynamic because if the opponent has a mirror_active flag set, any opponent targeting item effects are reflected back at the caster instead of hitting the intended target.'),

        h2('3.4  Shop and Elixir System'),
        body('The shop route in shop.js handles all item purchasing and elixir management outside of games. When a player visits the shop page, the server performs three database queries in sequence. First it retrieves all shop items ordered by cost, then it retrieves the players inventory to know how many of each item they currently own, and finally it retrieves the players current elixir balance directly from the database and syncs it back into the session. Syncing the elixir from the database rather than relying solely on the session value ensures the displayed amount is always accurate, especially if the player earned elixir from a recently completed game.'),
        body('To purchase an item, the player submits a POST request to /shop/buy/:itemId. The server verifies the item exists, checks if the player has enough elixir, and if so deducts the cost and adds the item to the players inventory. The inventory check uses an upsert pattern, where if the player already owns that item the quantity is incremented, and if they do not own it a new row is inserted.'),
        body('The bonus elixir feature works by having the player click on one of the elixir amounts (10, 50 or 100) which sends a GET request to retrieve a random question from the database. The question is displayed to the player in a modal, and when they submit their answer a POST request verifies it. If correct, the specified elixir amount is added to their balance. If incorrect, they are shown the error and can try again.'),

        h2('3.5  Form Validation'),
        body('Form validation is implemented on the server side in the auth.js route to ensure all user registration input is valid before processing. The validation checks are applied in sequence, and if any check fails the user is redirected back to the form with a descriptive error message passed as a URL query parameter.'),
        body('The checks performed during registration are as follows. All fields must be present and non-empty. The username must be between 3 and 20 characters in length. The email must match the regular expression /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/ which checks for a basic email format with an @ symbol and a domain. The password must be at least 6 characters long. And the password must match the confirm password field exactly. Any input that fails these checks will not proceed to the database query step, which also protects against unnecessary database load and potential injection attempts through the use of parameterised queries throughout the codebase.'),

        new Paragraph({ children: [new PageBreak()] }),

        // ── 4. User Guidance ─────────────────────────────────────────────────
        h1('4.  User Guidance'),

        h2('4.1  Setting Up the Physical Component'),
        body('Before starting a game of Python Adventure Quest, make sure the physical board is set up and ready. You will need the adventure board with its 20 space track for each player, a player token for each player, a standard 6 sided dice, the question card deck which is sorted into Common (red), Rare (blue) and Legendary (gold) cards, and the event cards. Each question card has a QR code on it. Make sure both players have a smartphone or device with a browser and a working camera to scan QR codes during gameplay. Both devices will need to be connected to the internet since the game runs through the web server.'),

        h2('4.2  How to Register and Login'),
        numbered('Open the Python Adventure Quest web application in your browser by navigating to the application URL.'),
        numbered('You will be directed to the login page automatically. If you are a new user and do not have an account yet, click the Register link on the login page to go to the registration form.'),
        numbered('On the register page, fill in your desired username, your email address, a password, and re-enter the same password in the confirm password field. All fields are required. Click the Register button when done.'),
        numbered('If registration is successful you will be redirected to the login page with a success message. Enter your email and password and click Login.'),
        numbered('After logging in you will be taken to your profile page where you can see your current stats.'),
        note('[Insert screenshot of login page here]'),
        note('[Insert screenshot of register page here]'),
        note('[Insert screenshot of profile page here]'),

        h2('4.3  Equipping Items Before a Game'),
        numbered('From the navigation bar, click on Shop to browse available power up items. Each item shows its name, what it does during a game, and its elixir cost.'),
        numbered('Click the Buy button next to any item you want to purchase. Make sure you have enough elixir first. If not, scroll down to the Earn Elixir section and answer a bonus question to earn more.'),
        numbered('Once you have purchased items, go to your Bag page from the navigation bar. Your owned items will be listed here.'),
        numbered('Click the Equip button next to the items you want to bring into your next match. You can equip a maximum of 3 items. The equipped items are the ones that will appear in your item bar during the game.'),
        note('[Insert screenshot of shop page here]'),
        note('[Insert screenshot of bag/inventory page here]'),

        h2('4.4  Starting or Joining a Game'),
        numbered('From the navigation bar, click Play to go to the Game Lobby.'),
        numbered('To start a new game as the host, click the Create Game button. You will be taken to the waiting room.'),
        numbered('The waiting room shows your room code and a QR code. Share either of these with the second player. They can scan the QR code with their phone camera to join directly, or they can go to the Game Lobby and type the room code into the Join Game field and click Join.'),
        numbered('Once the second player joins, both players will automatically be taken to the game page and the match will begin.'),
        note('[Insert screenshot of game lobby here]'),
        note('[Insert screenshot of waiting room with QR code here]'),

        h2('4.5  Playing the Game'),
        numbered("At the start of the game, it is Player 1's turn. On your turn you will see the Roll Dice button active on your screen. Click it to roll. Your token moves on the digital display and you should move your physical token on the board to the matching space."),
        numbered('The app will automatically process what happens on the space you landed on and display a notification.'),
        numbered('If you land on a Blessing space (spaces 3 and 11), you gain 10 elixir automatically. Nothing else needs to be done.'),
        numbered('If you land on a Cursed space (spaces 5 and 13), a message will inform you that you will skip your next turn. Your turn ends and it moves to the opponent.'),
        numbered('If you land on the Shortcut space (space 7), you are automatically moved forward to space 12. This is displayed on the board both physically and digitally.'),
        numbered('If you land on a Scan space (spaces 9 and 16), a Scan Card prompt will appear. Pick up one of your physical question cards from your deck and press the Scan Card button in the app. The server will determine your outcome randomly.'),
        numbered('If the outcome is a Python question, a multiple choice question modal will appear on your screen. Read the question carefully, select your answer by clicking on it, and click Submit. After submitting you will see whether you were correct and an explanation of the answer. Elixir and XP are awarded automatically.'),
        numbered('If the outcome is a Trap, the effect is applied immediately and the turn ends. If it is a Windfall, you receive the bonus and the turn ends.'),
        numbered('If you reach Space 20 which is the Goal space, your position resets to 0 and you deal damage to your opponent. The damage amount is based on your damage attribute. The game shows how much damage was dealt.'),
        numbered('During your turn, before or after rolling, you can also use one of your equipped items by clicking on it in the item bar at the bottom of the screen. You can only use one item per turn.'),
        note('[Insert screenshot of game page here]'),
        note('[Insert screenshot of question modal here]'),
        note('[Insert screenshot of card outcome notification here]'),

        h2('4.6  Winning the Game'),
        body("The goal of Python Adventure Quest is to reduce your opponent's HP to 0. Each time you complete a full lap of the board by reaching space 20, you automatically deal damage to your opponent. The base damage is 1 point, increased by your damage attribute. The opponent's defense attribute reduces the incoming damage. The game ends when one player's HP reaches 0, and the other player is declared the winner. After the game ends, both players receive XP that is permanently added to their overall account progress. The winner receives more XP than the losing player."),
        note('[Insert screenshot of game over screen here]'),
        note('[Insert screenshot of leaderboard here]'),

        new Paragraph({ children: [new PageBreak()] }),

        // ── 5. Conclusions ───────────────────────────────────────────────────
        h1('5.  Conclusions'),
        body('Python Adventure Quest successfully achieves the goal of combining a physical board game with a digital web application to create an engaging educational hybrid game experience built around Python Control Flow concepts. The game fulfils all the main technical requirements of the assignment by implementing a complete user authentication system, real time multiplayer functionality through Socket.io, a MySQL database with full CRUD operations, QR code integration as the physical to digital connection, and a responsive design that works across different devices.'),
        body('From a technical standpoint, this project was a very good exercise in working with real time web applications and managing shared state between multiple connected clients. The implementation of Socket.io for the game logic was one of the more challenging parts of the project because you have to think carefully about what happens when multiple players are connected at the same time and how the server handles events coming from different users within the same game room. Ensuring that only the player whose turn it is can actually roll the dice or scan a card required careful server side validation on every single Socket.io event handler, and getting this wrong even once could allow a player to take actions out of turn which would break the game entirely.'),
        body('To add on, the game mechanics such as status effects, item interactions and the mirror system added a good amount of depth to the gameplay loop but also significantly increased the complexity of the game state management. With multiple boolean flags and counters needing to be tracked per player per game in the database, careful attention had to be given to making sure flags were reset at the right times and that effects were applied in the correct order. For example, the poison effect needs to tick at the start of a players turn, the frost effect needs to be checked before allowing item usage, and the mirror flag needs to be checked before any opponent targeting item is applied. Getting all of these to work together correctly in the right sequence was something that required a lot of testing.'),
        body('Looking at potential future enhancements for the project, there are several things that could improve the game further. First and most importantly, expanding the question pool to cover additional Python concepts beyond just Control Flow would significantly increase the educational value and replayability of the game. Second, adding a spectator mode would allow other students or classmates to watch live games without participating, which could be useful in a classroom setting. Third, the physical board could be enhanced with NFC chips instead of QR codes to make the physical to digital connection faster and more seamless, since NFC just requires a tap rather than having to open the camera and scan. Fourth, a more detailed post game statistics screen showing each players performance during the match, such as how many questions they answered correctly and how much elixir they earned per turn, would add another layer of feedback and learning value. And finally, supporting more than 2 players at once would make the game more suitable for larger classroom group activities.'),
        body('Overall Python Adventure Quest turned out to be a challenging but rewarding project that successfully demonstrates the ability to build a full stack real time web application with database integration, user authentication, and a physical to digital game mechanism.'),

        new Paragraph({ children: [new PageBreak()] }),

        // ── 6. References ────────────────────────────────────────────────────
        h1('6.  References'),
        body('Nodejs.org. (2024). Node.js documentation. Retrieved from https://nodejs.org/en/docs'),
        body('Expressjs.com. (2024). Express.js web framework for Node.js. Retrieved from https://expressjs.com'),
        body('Socket.io. (2024). Socket.IO documentation. Retrieved from https://socket.io/docs/v4'),
        body('MySQL. (2024). MySQL 8.0 reference manual. Oracle Corporation. Retrieved from https://dev.mysql.com/doc/refman/8.0/en'),
        body('npm. (2024). bcryptjs. npm registry. Retrieved from https://www.npmjs.com/package/bcryptjs'),
        body('npm. (2024). qrcode. npm registry. Retrieved from https://www.npmjs.com/package/qrcode'),
        body('npm. (2024). express-session. npm registry. Retrieved from https://www.npmjs.com/package/express-session'),
        body('npm. (2024). mysql2. npm registry. Retrieved from https://www.npmjs.com/package/mysql2'),
        body('Prensky, M. (2001). Digital game-based learning. McGraw-Hill.'),
        body('Plass, J. L., Homer, B. D., & Kinzer, C. K. (2015). Foundations of game-based learning. Educational Psychologist, 50(4), 258-283. https://doi.org/10.1080/00461520.2015.1122533'),
        body('Deterding, S., Dixon, D., Khaled, R., & Nacke, L. (2011). From game design elements to gamefulness: Defining gamification. Proceedings of the 15th International Academic MindTrek Conference, 9-15.'),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('C:\\Users\\user\\Desktop\\Python Adventure Quest\\Python_Adventure_Quest_Final_Report.docx', buffer);
  console.log('Done! File saved.');
}).catch(err => {
  console.error('Error:', err);
});
