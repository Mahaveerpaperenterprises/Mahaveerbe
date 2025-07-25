const express = require('express');
const cors = require('cors');
const path = require('path');
const navlinksRouter = require('./routes/navlinks');
const prodlinksRouter = require('./routes/products');
const categoriesRouter = require('./routes/categories');
const authRouter = require('./routes/auth');
const uploadRoute = require('./routes/upload');

const app = express();

const corsOptions = {
  origin: ['http://localhost:3000', 'http://192.168.0.106:3000'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/navlinks', navlinksRouter);
app.use('/api/products', prodlinksRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRoute);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🟢 Server running locally → http://localhost:${PORT}`);
  });
}

module.exports = app;
