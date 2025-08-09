require('dotenv').config(); // Load env variables from .env for local development or vercel deployment

const express = require('express');
const cors = require('cors');
const path = require('path');

// Route imports
const navlinksRouter = require('./routes/navlinks');
const prodlinksRouter = require('./routes/products');
const categoriesRouter = require('./routes/categories');
const authRouter = require('./routes/auth');
const uploadRoute = require('./routes/upload');
const ordersRouter = require('./routes/orders');

const app = express();

// Allow listed origins for local development
const corsOptions = {
  origin: ['http://localhost:3000', 'http://192.168.0.106:3000', 'http://localhost:3001',],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/navlinks', navlinksRouter);
app.use('/api/products', prodlinksRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRoute);
app.use('/api/orders', ordersRouter);

// Start server
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🟢 Server running on → http://localhost:${PORT}`);
  });
}

module.exports = app;
