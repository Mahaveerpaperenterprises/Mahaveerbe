const express = require('express');
const cors = require('cors');
const navlinksRouter = require('./routes/navlinks');
const prodlinksRouter = require('./routes/products');
const categoriesRouter = require('./routes/categories');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/navlinks', navlinksRouter);
app.use('/api/products', prodlinksRouter);
app.use('/api/categories', categoriesRouter);


if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🟢 Server running locally → http://localhost:${PORT}`);
  });
}
// ✅ Export the app (Vercel will use this)
module.exports = app;
