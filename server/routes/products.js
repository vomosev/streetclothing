const express = require('express');
const {
  listProducts,
  listCategories,
  getProductBySlug,
} = require('../controllers/productController');

const router = express.Router();

// GET /api/products?category=&featured=1&search=&limit=
router.get('/', listProducts);

// GET /api/products/categories  (declared before /:slug so it is not shadowed)
router.get('/categories', listCategories);

// GET /api/products/:slug
router.get('/:slug', getProductBySlug);

module.exports = router;