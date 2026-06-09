require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const shopRoutes = require('./routes/shop');
const profileRoutes = require('./routes/profile');
const initGameSocket = require('./sockets/gameSocket');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 24 hours
});
app.use(sessionMiddleware);

// Share session with Socket.io
io.engine.use(sessionMiddleware);

// Make user available in all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Routes
app.use('/', authRoutes);
app.use('/game', require('./routes/game')(io));
app.use('/shop', shopRoutes);
app.use('/bag', require('./routes/bag'));
app.use('/leaderboard', require('./routes/leaderboard'));
app.use('/admin', require('./routes/admin'));
app.use('/profile', require('./routes/profile'));

// Socket.io game logic
initGameSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Python Adventure Quest running at http://localhost:${PORT}`);
});
