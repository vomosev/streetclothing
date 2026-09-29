'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { getPaymentProviders, checkoutCart } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import Card, { CardHeader, CardBody, CardFooter } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ProviderButtons from '../../components/ProviderButtons';
import ProductArtwork from '../../components/ProductArtwork';

export default function CartPage() {
  const { items, updateQuantity, removeItem, clear, itemCount, subtotalCents } = useCart();
  const { user } = useAuth();

  const [providers, setProviders] = useState([]);
  const [providersStatus, setProvidersStatus] = useState('loading');
  const [providersError, setProvidersError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);

  const loadProviders = useCallback(async (signal) => {
    setProvidersStatus('loading');
    setProvidersError('');
    try {
      const data = await getPaymentProviders({ signal });
      if (signal && signal.aborted) return;
      setProviders(Array.isArray(data?.providers) ? data.providers : []);
      setProvidersStatus('ready');
    } catch (err) {
      if (signal && signal.aborted) return;
      if (err && err.name === 'AbortError') return;
      setProviders([]);
      setProvidersError(
        err && err.message ? err.message : 'We could not reach the payment service.'
      );
      setProvidersStatus('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadProviders(controller.signal);
    return () => controller.abort();
  }, [loadProviders]);

  const handlePay = useCallback(
    async (providerId) => {
      if (!providerId || busyId) return;
      setBusyId(providerId);
      setCheckoutError('');
      setNeedsAuth(false);
      try {
        const payload = {
          provider: providerId,
          items: items.map((item) => ({
            productId: item.productId,
            sizeLabel: item.sizeLabel,
            quantity: item.quantity,
          })),
        };
        const data = await checkoutCart(payload);
        if (data && data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
        setCheckoutError('The payment service did not return a checkout link. Try again.');
        setBusyId(null);
      } catch (err) {
        if (err && err.status === 401) {
          setNeedsAuth(true);
          setCheckoutError('Sign in to complete your order.');
        } else {
          setCheckoutError(
            err && err.message ? err.message : 'Checkout failed. Please try again.'
          );
        }
        setBusyId(null);
      }
    },
    [busyId, items]
  );

  if (!items.length) {
    return (
      <section className="stack">
        <header className="page-header">
          <h1>Your bag</h1>
          <p>Nothing in the bag yet. The current drop restocks in limited runs, so move quick.</p>
        </header>
        <EmptyState
          title="Your bag is empty"
          description="Add a piece from the current drop and it will show up here with size and quantity."
          action={
            <Button as="a" href="/shop" variant="primary" size="md">
              Browse the drop
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section className="stack">
      <header className="page-header">
        <h1>Your bag</h1>
        <p>
          {itemCount} {itemCount === 1 ? 'piece' : 'pieces'} reserved. Totals are recalculated on our
          server at checkout, so the price you pay always matches the live catalogue.
        </p>
      </header>

      <div className="cart-layout">
        <div className="stack cart-items">
          {items.map((item) => (
            <Card key={`${item.productId}-${item.sizeLabel}`} className="cart-item">
              <CardBody>
                <div className="cart-item__row">
                  <div className="cart-item__media">
                    <ProductArtwork
                      name={item.name}
                      accentHex={item.accentHex}
                      category={item.category}
                      ratio="1/1"
                    />
                  </div>

                  <div className="cart-item__info user-text">
                    <h2 className="cart-item__name">
                      <Link href={`/product/${item.slug}`}>{item.name}</Link>
                    </h2>
                    <p className="cart-item__meta">
                      Size {item.sizeLabel} · {formatPrice(item.priceCents)} each
                    </p>
                  </div>

                  <div className="cart-item__controls cluster">
                    <div className="qty" role="group" aria-label={`Quantity for ${item.name}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateQuantity(item.productId, item.sizeLabel, item.quantity - 1)
                        }
                        disabled={item.quantity <= 1}
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        −
                      </Button>
                      <span className="qty__value" aria-live="polite">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          updateQuantity(item.productId, item.sizeLabel, item.quantity + 1)
                        }
                        disabled={item.quantity >= 10}
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        +
                      </Button>
                    </div>

                    <p className="cart-item__line-total">
                      {formatPrice(item.priceCents * item.quantity)}
                    </p>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => removeItem(item.productId, item.sizeLabel)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}

          <div className="cluster">
            <Button as="a" href="/shop" variant="secondary" size="md">
              Keep shopping
            </Button>
            <Button variant="ghost" size="md" onClick={clear}>
              Empty bag
            </Button>
          </div>
        </div>

        <aside className="cart-summary">
          <Card>
            <CardHeader>
              <h2 className="card__title">Order summary</h2>
            </CardHeader>
            <CardBody>
              <dl className="summary-list">
                <div className="summary-list__row">
                  <dt>Subtotal</dt>
                  <dd>{formatPrice(subtotalCents)}</dd>
                </div>
                <div className="summary-list__row">
                  <dt>Shipping</dt>
                  <dd>Calculated at checkout</dd>
                </div>
                <div className="summary-list__row summary-list__row--total">
                  <dt>Total due now</dt>
                  <dd>{formatPrice(subtotalCents)}</dd>
                </div>
              </dl>
              <p className="summary-note">
                Street Pass members ship free on every order. Card details are handled entirely by
                the payment provider — we never see them.
              </p>
            </CardBody>
            <CardFooter>
              <div className="stack">
                {needsAuth ? (
                  <div className="alert alert--warning" role="alert">
                    <p>You need an account to place this order.</p>
                    <div className="cluster">
                      <Button as="a" href="/login?next=/cart" variant="primary" size="sm">
                        Sign in
                      </Button>
                      <Button as="a" href="/signup" variant="secondary" size="sm">
                        Join
                      </Button>
                    </div>
                  </div>
                ) : null}

                {checkoutError && !needsAuth ? (
                  <p className="form-error" role="alert">
                    {checkoutError}
                  </p>
                ) : null}

                <ProviderButtons
                  providers={providers}
                  loading={providersStatus === 'loading'}
                  error={providersStatus === 'error' ? providersError : ''}
                  onPay={handlePay}
                  busyId={busyId}
                  label={`Pay ${formatPrice(subtotalCents)} with`}
                />

                {providersStatus === 'error' ? (
                  <Button variant="secondary" size="sm" onClick={() => loadProviders()}>
                    Retry
                  </Button>
                ) : null}

                {user ? (
                  <p className="summary-note">
                    Ordering as <strong>{user.email}</strong>.
                  </p>
                ) : null}
              </div>
            </CardFooter>
          </Card>
        </aside>
      </div>
    </section>
  );
}