const path = require('path');
const { PORT, CLIENT_ORIGIN } = require('./config/env');
const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const { testMysqlConnection } = require('./config/mysql');

const authRoutes      = require('./routes/auth.routes');
const adminRoutes     = require('./routes/admin.routes');
const appRoutes       = require('./routes/app.routes');
const formRoutes      = require('./routes/form.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const powerRoutes     = require('./routes/power.routes');
const biRoutes        = require('./routes/bi.routes');

const app = express();

// ─── Database connections ────────────────────────────────────
testMysqlConnection();

// ─── Global middleware ───────────────────────────────────────
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Rate limiting ───────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// Strict limiter for password-based login only (brute-force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many login attempts, please try again later.' },
});

app.use(globalLimiter);

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth',       authRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/apps',       appRoutes);
app.use('/api/forms',      formRoutes);
app.use('/api/equipment',  equipmentRoutes);
app.use('/api/power',      powerRoutes);
app.use('/api/bi',        biRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ─── 404 handler ─────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));

// ─── Global error handler ────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error.' });
});

app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));
