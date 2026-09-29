'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'streetclothing.cart';
const MIN_QTY = 1;
const MAX_QTY = 10;

const CartContext = createContext(null);

function clampQuantity(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return MIN_QTY;
  if (number < MIN_QTY) return MIN_QTY;
  if (number > MAX_QTY) return MAX_QTY;
  return number;
}

function lineKey(item) {
  return `${item.productId}::${item.sizeLabel || 'ONE'}`;
}

function normaliseItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const productId = raw.productId;
  if (productId === undefined || productId === null || productId === '') return null;
  const priceCents = Number.parseInt(raw.priceCents, 10);
  return {
    productId,
    slug: typeof raw.slug === 'string' ? raw.slug : '',
    name: typeof raw.name === 'string' ? raw.name : 'Untitled piece',
    sizeLabel: typeof raw.sizeLabel === 'string' && raw.sizeLabel ? raw.sizeLabel : 'ONE',
    quantity: clampQuantity(raw.quantity),
    priceCents: Number.isFinite(priceCents) && priceCents >= 0 ? priceCents : 0,
    accentHex: typeof raw.accentHex === 'string' ? raw.accentHex : '',
  };
}

function readStoredCart() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normaliseItem).filter(Boolean);
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('Could not read the saved bag:', error);
    }
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readStoredCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.warn('Could not save the bag:', error);
      }
    }
  }, [items, hydrated]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    function handleStorage(event) {
      if (event.key && event.key !== STORAGE_KEY) return;
      setItems(readStoredCart());
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const addItem = useCallback((raw) => {
    const item = normaliseItem(raw);
    if (!item) return;
    setItems((current) => {
      const key = lineKey(item);
      const index = current.findIndex((line) => lineKey(line) === key);
      if (index === -1) return [...current, item];
      const next = current.slice();
      next[index] = {
        ...next[index],
        quantity: clampQuantity(next[index].quantity + item.quantity),
        priceCents: item.priceCents || next[index].priceCents,
      };
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId, sizeLabel, quantity) => {
    const key = `${productId}::${sizeLabel || 'ONE'}`;
    setItems((current) =>
      current.map((line) =>
        lineKey(line) === key ? { ...line, quantity: clampQuantity(quantity) } : line
      )
    );
  }, []);

  const removeItem = useCallback((productId, sizeLabel) => {
    const key = `${productId}::${sizeLabel || 'ONE'}`;
    setItems((current) => current.filter((line) => lineKey(line) !== key));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        if (typeof console !== 'undefined') {
          console.warn('Could not clear the saved bag:', error);
        }
      }
    }
  }, []);

  const itemCount = useMemo(
    () => items.reduce((total, line) => total + clampQuantity(line.quantity), 0),
    [items]
  );

  const subtotalCents = useMemo(
    () =>
      items.reduce(
        (total, line) => total + clampQuantity(line.quantity) * (line.priceCents || 0),
        0
      ),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      hydrated,
      itemCount,
      subtotalCents,
      addItem,
      updateQuantity,
      removeItem,
      clear,
      maxQuantity: MAX_QTY,
      minQuantity: MIN_QTY,
    }),
    [items, hydrated, itemCount, subtotalCents, addItem, updateQuantity, removeItem, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside a CartProvider');
  }
  return context;
}

export default CartContext;