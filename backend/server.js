const { PORT, CLIENT_ORIGIN, NODE_ENV } = require('./config/env');
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const { testMysqlConnection, pool } = require('./config/mysql');
const { globalErrorMessage, logServerError, mapDbError } = require('./utils/httpError');

const authRoutes      = require('./routes/auth.routes');
const adminRoutes     = require('./routes/admin.routes');
const appRoutes       = require('./routes/app.routes');
const formRoutes      = require('./routes/form.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const powerRoutes     = require('./routes/power.routes');
const powerNewRoutes  = require('./routes/powerNew.routes');
const sugarNewRoutes  = require('./routes/sugarNew.routes');
const productionHouseRoutes = require('./routes/productionHouse.routes');
const biRoutes        = require('./routes/bi.routes');
const homepageCardsRoutes = require('./routes/homepageCards.routes');
const dataUploadRoutes    = require('./routes/dataUpload.routes');
const canePerformanceRoutes = require('./routes/canePerformanceRoutes');
const biPowerHouseRoutes = require('./routes/biPowerHouse.routes');
const activityRoutes = require('./routes/activity.routes');
const { expireStaleSessions } = require('./utils/sessionActivity');

const app = express();

if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ─── Database connections ────────────────────────────────────
testMysqlConnection();

// Expire abandoned browser sessions (no heartbeat)
setInterval(() => {
  expireStaleSessions(pool).catch((err) => {
    console.error('[sessionSweeper]', err.message);
  });
}, 60 * 1000);

// ─── Global middleware ───────────────────────────────────────
app.use(helmet({
  // JSON API — CSP is enforced by the Vite SPA, not these responses.
  contentSecurityPolicy: false,
  // Allow the SPA (possibly another origin) to load avatar blobs from /api.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // HSTS is enabled by helmet in production when the request is HTTPS (trust proxy above).
}));
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const { auditMiddleware } = require('./middleware/auditMiddleware');
app.use(auditMiddleware);
// Uploads (avatars, data-ingestion) are served only via authenticated API routes.

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
app.use('/api/power-new',  powerNewRoutes);
app.use('/api/sugar-new',  sugarNewRoutes);
app.use('/api/production-house', productionHouseRoutes);
app.use('/api/bi',             biRoutes);
app.use('/api/bi/cane-performance', canePerformanceRoutes);
app.use('/api/bi/power-house', biPowerHouseRoutes);
app.use('/api/homepage-cards', homepageCardsRoutes);
app.use('/api/data-upload',      dataUploadRoutes);
app.use('/api/activity',         activityRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ─── 404 handler ─────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));

// ─── Global error handler ────────────────────────────────────
app.use((err, _req, res, _next) => {
  logServerError('unhandled', err);
  const mapped = mapDbError(err);
  if (mapped) {
    return res.status(mapped.status).json({ message: mapped.message });
  }
  res.status(err.status || 500).json({ message: globalErrorMessage(err) });
});

app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));
