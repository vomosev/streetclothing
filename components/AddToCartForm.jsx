'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useCart } from '../context/CartContext';
import Button from './ui/Button';
import { Field } from './ui/Input';
import { formatPrice } from '../lib/format';

export default function AddToCartForm({ product }) {
  const { addItem } = useCart();
  const sizes = useMemo(() => (Array.isArray(product?.sizes) ? product.sizes : []), [product]);

  const firstAvailable = useMemo(() => {
    const found = sizes.find((size) => Number(size.stock) > 0);
    return found ? found.label : sizes.length > 0 ? sizes[0].label : '';
  }, [sizes]);

  const [sizeLabel, setSizeLabel] = useState(firstAvailable);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    setSizeLabel(firstAvailable);
    setQuantity(1);
    setMessage('');
    setError('');
  }, [firstAvailable, product?.slug]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  if (!product) {
    return null;
  }

  const soldOut = product.inStock === 0 || product.inStock === false;
  const selected = sizes.find((size) => size.label === sizeLabel);
  const selectedStock = selected ? Number(selected.stock) || 0 : 0;
  const maxQuantity = Math.max(1, Math.min(10, selectedStock || 10));

  const changeQuantity = (delta) => {
    setQuantity((current) => {
      const next = current + delta;
      if (next < 1) return 1;
      if (next > maxQuantity) return maxQuantity;
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');

    if (soldOut) {
      setError('This piece is sold out.');
      return;
    }
    if (sizes.length > 0 && !sizeLabel) {
      setError('Choose a size before adding to your bag.');
      return;
    }
    if (selected && selectedStock <= 0) {
      setError(`Size ${sizeLabel} is sold out — pick another.`);
      return;
    }

    try {
      addItem({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        sizeLabel: sizeLabel || 'OS',
        quantity,
        priceCents: product.priceCents,
        accentHex: product.accentHex,
      });

      setMessage(
        `Added ${quantity} × ${product.name}${sizeLabel ? ` (${sizeLabel})` : ''} to your bag.`
      );

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err?.message || 'Could not add this piece to your bag.');
    }
  };

  return (
    <form className="add-to-cart stack" onSubmit={handleSubmit} noValidate>
      {sizes.length > 0 ? (
        <Field
          id="size-selector"
          label="Size"
          hint={
            selected && selectedStock > 0 && selectedStock <= 3
              ? `Only ${selectedStock} left in ${selected.label}`
              : 'Fits true to size. Size up for a boxier drape.'
          }
          error={error && !message ? error : ''}
        >
          <div className="cluster size-options" role="group" aria-label="Choose a size">
            {sizes.map((size) => {
              const out = Number(size.stock) <= 0;
              const active = size.label === sizeLabel;
              return (
                <button
                  key={size.label}
                  type="button"
                  className={`size-option${active ? ' is-active' : ''}${out ? ' is-disabled' : ''}`}
                  aria-pressed={active}
                  disabled={out}
                  onClick={() => {
                    setSizeLabel(size.label);
                    setQuantity(1);
                    setError('');
                  }}
                >
                  {size.label}
                  {out ? <span className="size-option__note">Sold out</span> : null}
                </button>
              );
            })}
          </div>
        </Field>
      ) : null}

      <Field id="quantity-stepper" label="Quantity" hint={`Maximum ${maxQuantity} per order`}>
        <div className="cluster quantity-stepper">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => changeQuantity(-1)}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
          >
            −
          </Button>
          <output className="quantity-stepper__value" aria-live="off">
            {quantity}
          </output>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => changeQuantity(1)}
            disabled={quantity >= maxQuantity}
            aria-label="Increase quantity"
          >
            +
          </Button>
        </div>
      </Field>

      <div className="cluster add-to-cart__actions">
        <Button type="submit" variant="primary" size="lg" disabled={soldOut}>
          {soldOut ? 'Sold out' : `Add to bag — ${formatPrice(product.priceCents)}`}
        </Button>
        <Button as="a" href="/cart" variant="ghost" size="lg">
          View bag
        </Button>
      </div>

      <p className="form-status" role="status" aria-live="polite">
        {message ? (
          <>
            {message} <Link href="/cart">Go to bag</Link>
          </>
        ) : (
          ''
        )}
      </p>

      {error && !message ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}