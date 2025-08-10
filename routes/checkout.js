const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/", async (req, res) => {
  const client = await db.connect();
  try {
    const { billing, shipping, payment, items, total } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "No items in order" });
    }

    await client.query("BEGIN");

    const orderInsert = await client.query(
      `
      INSERT INTO orders (
        email, total_amount, currency,
        payment_status, order_status, fulfill_status,
        shipping_addr, billing_addr
      )
      VALUES ($1, $2, 'INR', 'PENDING', 'PENDING', 'NOT_PACKED', $3::jsonb, $4::jsonb)
      RETURNING id
      `,
      [
        billing?.email || null,
        Number(total) || 0,
        JSON.stringify({ address: shipping?.address || {} }),
        JSON.stringify({
          name: billing?.name || null,
          email: billing?.email || null,
          address: billing?.address || {}
        })
      ]
    );

    const orderId = orderInsert.rows[0].id;

    const vals = [];
    const placeholders = items
      .map((it, i) => {
        const base = i * 7;
        vals.push(
          orderId,
          it.product_id,
          it.product_name,
          Number(it.unit_price_minor) || 0,
          Number(it.quantity) || 0,
          Number(it.subtotal_minor) || 0,
          it.image_url || ""
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
      })
      .join(", ");

    await client.query(
      `
      INSERT INTO order_items
        (order_id, product_id, product_name, unit_price_minor, quantity, subtotal_minor, image_url)
      VALUES ${placeholders}
      `,
      vals
    );

    await client.query("COMMIT");
    res.status(201).json({ message: "Order placed successfully", orderId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Checkout error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
