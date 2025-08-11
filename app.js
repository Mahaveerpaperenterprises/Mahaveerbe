require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.set('trust proxy', 1);

const allowlist = new Set([
  'http://localhost:3000',
  'http://192.168.0.106:3000',
  'http://localhost:3001',
  'https://mahaveerbe.vercel.app',            
  'https://mahaveerpaperenterprises-sand.vercel.app',
]);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
t
    const isAllowed =
      allowlist.has(origin) ||
      /\.vercel\.app$/i.test(origin);

    return cb(isAllowed ? null : new Error('Not allowed by CORS'), isAllowed);
  },
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());

const isVercel = !!process.env.VERCEL;
const uploadsPath = isVercel
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, 'uploads');

try {
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
} catch (e) {
  console.error('Failed to ensure uploads dir:', uploadsPath, e);
}

const setStaticHeaders = (res, filePath) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
};

app.use('/uploads', express.static(uploadsPath, { setHeaders: setStaticHeaders }));

// ---- Routes ----
const navlinksRouter = require('./routes/navlinks');
const prodlinksRouter = require('./routes/products');
const categoriesRouter = require('./routes/categories');
const authRouter = require('./routes/auth');
const uploadRoute = require('./routes/upload');    
const ordersRouter = require('./routes/orders');
const checkoutRouter = require('./routes/checkout');

app.use('/api/navlinks', navlinksRouter);
app.use('/api/products', prodlinksRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRoute);
app.use('/api/orders', ordersRouter);
app.use('/api/checkout', checkoutRouter);

app.get('/', (_req, res) => res.send('API is running'));

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🟢 Server running on → http://localhost:${PORT}`);
  });
}

module.exports = app;
