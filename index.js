const express = require('express');
const cors    = require('cors');
const navlinksRouter = require('./routes/navlinks');
const prodlinksRouter = require('./routes/products');
const categoriesRouter = require('./routes/categories');

const app = express();
app.use(cors());
app.use(express.json());            // parse JSON bodies

/* Mount every route in routes/navlinks.js under /api/navlinks */
app.use('/api/navlinks', navlinksRouter);
app.use('/api/products', prodlinksRouter);

app.use('/api/categories', categoriesRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🟢  Server ready → http://localhost:${PORT}`)
);
