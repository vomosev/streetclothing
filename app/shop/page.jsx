'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCategories, getProducts } from '../../lib/api';
import ProductGrid from '../../components/ProductGrid';
import CategoryFilter from '../../components/CategoryFilter';
import Input, { Field } from '../../components/ui/Input';

export default function ShopPage() {
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Debounce the search field by 300ms before hitting the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Categories — loaded once, failure is non-fatal (the grid still works).
  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      try {
        const data = await getCategories({ signal: controller.signal });
        if (!mountedRef.current || controller.signal.aborted) return;
        const list = Array.isArray(data?.categories) ? data.categories : [];
        setCategories(list);
        setCategoriesError(null);
      } catch (err) {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        if (!mountedRef.current) return;
        setCategories([]);
        setCategoriesError(err?.message || 'Categories are unavailable right now.');
      }
    }

    loadCategories();
    return () => controller.abort();
  }, [reloadToken]);

  // Products — refetched whenever the filter, search term or retry token changes.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    async function loadProducts() {
      try {
        const params = {};
        if (activeCategory && activeCategory !== 'all') params.category = activeCategory;
        if (search) params.search = search;

        const data = await getProducts(params, { signal: controller.signal });
        if (!mountedRef.current || controller.signal.aborted) return;
        setProducts(Array.isArray(data?.products) ? data.products : []);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        if (!mountedRef.current) return;
        setProducts([]);
        setError(
          err?.message || 'The catalogue is temporarily unavailable. Please try again.'
        );
      } finally {
        if (mountedRef.current && !controller.signal.aborted) setLoading(false);
      }
    }

    loadProducts();
    return () => controller.abort();
  }, [activeCategory, search, reloadToken]);

  const handleRetry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const handleCategoryChange = useCallback((next) => {
    setActiveCategory(next || 'all');
  }, []);

  const filterOptions = useMemo(() => {
    const total = categories.reduce((sum, c) => sum + (Number(c.count) || 0), 0);
    return [{ id: 'all', label: 'All pieces', count: total }, ...categories];
  }, [categories]);

  const resultLabel = useMemo(() => {
    if (loading) return 'Loading the drop\u2026';
    if (error) return 'Catalogue unavailable';
    const count = products.length;
    if (count === 0) return 'No pieces matched';
    return `${count} piece${count === 1 ? '' : 's'} in view`;
  }, [loading, error, products.length]);

  return (
    <section className="stack page-section">
      <header className="page-header stack">
        <p className="eyebrow">Season 04 · Platinum Static</p>
        <h1>Shop the drop</h1>
        <p>
          Every piece is cut heavy, finished in near-black and trimmed in platinum.
          Filter by category or search the archive — stock moves fast and sizes are
          released drop by drop.
        </p>
      </header>

      <div className="shop-toolbar stack">
        <CategoryFilter
          categories={filterOptions}
          active={activeCategory}
          onChange={handleCategoryChange}
        />

        <div className="shop-search">
          <Field
            id="shop-search"
            label="Search the archive"
            hint="Try “hoodie”, “cargo” or a colourway name."
          >
            <Input
              id="shop-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search pieces, drops and colourways"
              autoComplete="off"
            />
          </Field>
        </div>

        <p className="shop-results" role="status" aria-live="polite">
          {resultLabel}
        </p>

        {categoriesError ? (
          <p className="shop-note user-text">
            Category filters could not load — showing everything instead.
          </p>
        ) : null}
      </div>

      <ProductGrid
        products={products}
        loading={loading}
        error={error}
        onRetry={handleRetry}
      />
    </section>
  );
}