require('dotenv').config(); // Load env variables from .env for local development or Vercel deployment

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Route imports
const navlinksRouter = require('./routes/navlinks');
const prodlinksRouter = require('./routes/products');
const categoriesRouter = require('./routes/categories');
const authRouter = require('./routes/auth');
const uploadRoute = require('./routes/upload');
const ordersRouter = require('./routes/orders');
const checkoutRouter = require('./routes/checkout');

// Allow listed origins for local development
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://192.168.0.106:3000',
    'http://localhost:3001',
    'https://mahaveerpaperenterprises-sand.vercel.app',
  ],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve uploads from /tmp on Vercel or local uploads folder
const isVercel = !!process.env.VERCEL;
const uploadsPath = isVercel
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, 'uploads');

app.use('/uploads', express.static(uploadsPath));

// Routes
app.use('/api/navlinks', navlinksRouter);
app.use('/api/products', prodlinksRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRoute);
app.use('/api/orders', ordersRouter);
app.use('/api/checkout', checkoutRouter);

// Health check route
app.get('/', (_req, res) => res.send('API is running'));

// Start server
const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🟢 Server running on → http://localhost:${PORT}`);
  });
}

module.exports = app;
