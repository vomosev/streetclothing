const express = require('express');
const { createCartCheckout, listOrders } = require('../controllers/orderController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Checkout a cart — the server recomputes the total from the products table.
// Authentication is optional here (guest checkout is allowed) but the signed-in
// user is attached to the order when a session exists.
router.post('/checkout', createCartCheckout);

// Order history for the signed-in user.
router.get('/', requireAuth, listOrders);

module.exports = router;