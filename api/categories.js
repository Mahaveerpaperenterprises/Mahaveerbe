const pool = require('../db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { rows } = await pool.query(`
      WITH leaves AS (
        SELECT n1.id
        FROM   "NavLinks" n1
        WHERE  NOT EXISTS (
                 SELECT 1 FROM "NavLinks" n2
                 WHERE  n2.parent_id = n1.id
               )
          AND  n1.published
      )
      SELECT label AS label,
             REGEXP_REPLACE(slug, '^\/', '') AS value
      FROM   "NavLinks"
      WHERE  id IN (SELECT id FROM leaves)
      ORDER  BY label;
    `);

    const options = [
      { label: 'All Categories', value: 'all' },
      ...rows,
    ];

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load categories' });
  }
};
