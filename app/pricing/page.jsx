'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Card, { CardBody, CardFooter, CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import ProviderButtons from '../../components/ProviderButtons';
import EmptyState from '../../components/ui/EmptyState';
import { LoadingState, ErrorState } from '../../components/ui/StateViews';
import { getPaymentPlans, getPaymentProviders, createPaymentCheckout } from '../../lib/api';
import { formatPrice, formatInterval } from '../../lib/format';

export default function PricingPage() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);

  const [providers, setProviders] = useState([]);
  const [providersStatus, setProvidersStatus] = useState('loading');
  const [providersError, setProvidersError] = useState('');

  const [busyId, setBusyId] = useState(null);
  const [checkoutError, setCheckoutError] = useState('');

  const loadPlans = useCallback(async (signal) => {
    setStatus('loading');
    setError('');
    try {
      const data = await getPaymentPlans({ signal });
      if (signal && signal.aborted) return;
      setCurrency(data && data.currency ? data.currency : 'USD');
      setPlans(Array.isArray(data && data.plans) ? data.plans : []);
      setProducts(Array.isArray(data && data.products) ? data.products : []);
      setStatus('ready');
    } catch (err) {
      if (signal && signal.aborted) return;
      if (err && err.name === 'AbortError') return;
      setError((err && err.message) || 'We could not load the membership tiers.');
      setStatus('error');
    }
  }, []);

  const loadProviders = useCallback(async (signal) => {
    setProvidersStatus('loading');
    setProvidersError('');
    try {
      const data = await getPaymentProviders({ signal });
      if (signal && signal.aborted) return;
      if (data && data.currency) setCurrency(data.currency);
      setProviders(Array.isArray(data && data.providers) ? data.providers : []);
      setProvidersStatus('ready');
    } catch (err) {
      if (signal && signal.aborted) return;
      if (err && err.name === 'AbortError') return;
      setProviders([]);
      setProvidersError((err && err.message) || 'Checkout options are unavailable right now.');
      setProvidersStatus('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadPlans(controller.signal);
    loadProviders(controller.signal);
    return () => controller.abort();
  }, [loadPlans, loadProviders]);

  const startCheckout = useCallback(
    async (provider, payload, key) => {
      if (!provider || !provider.id) return;
      setBusyId(`${key}:${provider.id}`);
      setCheckoutError('');
      try {
        const result = await createPaymentCheckout({ provider: provider.id, ...payload });
        if (result && result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        setCheckoutError('The payment provider did not return a checkout link. Please try another provider.');
        setBusyId(null);
      } catch (err) {
        if (err && err.status === 401) {
          setCheckoutError('Please sign in before starting a checkout.');
        } else {
          setCheckoutError((err && err.message) || 'We could not start that checkout. Please try again.');
        }
        setBusyId(null);
      }
    },
    []
  );

  return (
    <div className="stack page-stack">
      <header className="page-header stack">
        <Badge tone="accent" size="sm">Membership</Badge>
        <h1>Street Pass &amp; one-off extras</h1>
        <p>
          Street Pass members get first access to every STREET/PLATINUM drop, free shipping on all
          orders and member-only colourways that never hit the public grid. Cancel whenever you
          like — your access runs to the end of the paid period.
        </p>
      </header>

      {status === 'loading' ? <LoadingState rows={3} variant="cards" /> : null}

      {status === 'error' ? (
        <ErrorState message={error} onRetry={() => loadPlans()} />
      ) : null}

      {status === 'ready' ? (
        <>
          {checkoutError ? (
            <p className="form-error user-text" role="alert" aria-live="assertive">
              {checkoutError}
            </p>
          ) : null}

          {providersStatus === 'error' ? (
            <ErrorState message={providersError} onRetry={() => loadProviders()} />
          ) : null}

          <section className="stack" aria-labelledby="pricing-plans-heading">
            <h2 id="pricing-plans-heading">Membership tiers</h2>

            {plans.length === 0 ? (
              <EmptyState
                title="No membership tiers yet"
                description="Street Pass opens with the next drop. Shop the current release in the meantime."
                action={<Link className="btn btn--secondary btn--md" href="/shop">Shop the drop</Link>}
              />
            ) : (
              <div className="grid grid--cards">
                {plans.map((plan) => (
                  <Card key={plan.id} className="pricing-card">
                    <CardHeader>
                      <div className="cluster cluster--between">
                        <h3 className="user-text">{plan.name}</h3>
                        <Badge tone="accent" size="sm">
                          {formatInterval({
                            interval: plan.interval,
                            intervalCount: plan.intervalCount,
                          })}
                        </Badge>
                      </div>
                      <p className="price-figure">{formatPrice(plan.amount, currency)}</p>
                    </CardHeader>
                    <CardBody>
                      {plan.description ? <p className="user-text">{plan.description}</p> : null}
                      {Array.isArray(plan.features) && plan.features.length > 0 ? (
                        <ul className="feature-list">
                          {plan.features.map((feature) => (
                            <li key={feature} className="user-text">{feature}</li>
                          ))}
                        </ul>
                      ) : null}
                    </CardBody>
                    <CardFooter>
                      <ProviderButtons
                        providers={providers}
                        loading={providersStatus === 'loading'}
                        error={providersStatus === 'error' ? providersError : ''}
                        busyId={busyId}
                        label={`Join ${plan.name} with`}
                        onPay={(provider) =>
                          startCheckout(provider, { planId: plan.id }, `plan-${plan.id}`)
                        }
                        idPrefix={`plan-${plan.id}`}
                      />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {products.length > 0 ? (
            <section className="stack" aria-labelledby="pricing-products-heading">
              <h2 id="pricing-products-heading">One-off purchases</h2>
              <div className="grid grid--cards">
                {products.map((product) => (
                  <Card key={product.id} className="pricing-card">
                    <CardHeader>
                      <h3 className="user-text">{product.name}</h3>
                      <p className="price-figure">{formatPrice(product.amount, currency)}</p>
                    </CardHeader>
                    <CardBody>
                      {product.description ? (
                        <p className="user-text">{product.description}</p>
                      ) : null}
                    </CardBody>
                    <CardFooter>
                      <ProviderButtons
                        providers={providers}
                        loading={providersStatus === 'loading'}
                        error={providersStatus === 'error' ? providersError : ''}
                        busyId={busyId}
                        label={`Buy ${product.name} with`}
                        onPay={(provider) =>
                          startCheckout(provider, { productId: product.id }, `product-${product.id}`)
                        }
                        idPrefix={`product-${product.id}`}
                      />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          <section className="stack" aria-labelledby="pricing-faq-heading">
            <h2 id="pricing-faq-heading">Already a member?</h2>
            <p>
              Manage or cancel your Street Pass any time from your billing page — changes take
              effect at the end of the current period and your drop access stays live until then.
            </p>
            <div className="cluster">
              <Link className="btn btn--secondary btn--md" href="/billing">Go to billing</Link>
              <Link className="btn btn--ghost btn--md" href="/shop">Back to the shop</Link>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}