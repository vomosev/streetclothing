'use client';

import { useCallback, useEffect, useState } from 'react';
import { getProducts } from '../lib/api';
import ProductGrid from '../components/ProductGrid';
import Button from '../components/ui/Button';
import Card, { CardBody, CardHeader, CardFooter } from '../components/ui/Card';
import { OfflineNotice } from '../components/ui/StateViews';

const VALUE_PROPS = [
  {
    id: 'drops',
    title: 'Drop-first releases',
    body:
      'Every capsule is cut in a limited run. When a colourway sells through, it stays gone — no restocks, no dilution.',
  },
  {
    id: 'shipping',
    title: 'Free member shipping',
    body:
      'Street Pass members ship free on every order, worldwide, with tracked delivery from our Lagos and Berlin hubs.',
  },
  {
    id: 'returns',
    title: '30-day returns',
    body:
      'Try it on at home. If the fit is wrong, send it back within 30 days for a full refund or a size swap.',
  },
];

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback((signal) => {
    setLoading(true);
    setError(null);
    setOffline(false);

    return getProducts({ featured: 1, limit: 6 }, { signal })
      .then((data) => {
        if (signal && signal.aborted) return;
        const list = Array.isArray(data?.products) ? data.products : [];
        setProducts(list);
        setLoading(false);
      })
      .catch((err) => {
        if (signal && signal.aborted) return;
        if (err && err.name === 'AbortError') return;
        setProducts([]);
        setOffline(!err || !err.status);
        setError(err?.message || 'The featured drop could not be loaded.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleRetry = useCallback(() => {
    const controller = new AbortController();
    load(controller.signal);
  }, [load]);

  return (
    <div className="stack stack--page">
      <section className="hero">
        <div className="hero__content stack">
          <p className="eyebrow">Capsule 07 — Platinum Static</p>
          <h1>Streetwear cut in black. Finished in platinum.</h1>
          <p className="hero__lede">
            STREET/PLATINUM builds heavyweight staples for people who move after dark — boxed
            tees, taped hoodies and utility cargos in near-black cloth with brushed platinum
            hardware. Small runs, honest weights, no filler.
          </p>
          <div className="cluster">
            <Button as="a" href="/shop" variant="primary" size="lg">
              Shop the drop
            </Button>
            <Button as="a" href="/pricing" variant="secondary" size="lg">
              Membership
            </Button>
          </div>
        </div>
        <div className="hero__panel" aria-hidden="true">
          <svg viewBox="0 0 320 400" role="presentation" focusable="false">
            <defs>
              <linearGradient id="home-hero-base" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#111114" />
                <stop offset="100%" stopColor="#050506" />
              </linearGradient>
              <linearGradient id="home-hero-streak" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#6d7076" stopOpacity="0.15" />
                <stop offset="50%" stopColor="#d9dde3" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#6d7076" stopOpacity="0.15" />
              </linearGradient>
            </defs>
            <rect width="320" height="400" fill="url(#home-hero-base)" />
            <path d="M-40 300 L200 -40 L268 -40 L28 300 Z" fill="url(#home-hero-streak)" opacity="0.5" />
            <path d="M60 440 L300 100 L332 100 L92 440 Z" fill="url(#home-hero-streak)" opacity="0.28" />
            <text
              x="160"
              y="222"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize="64"
              fontWeight="700"
              letterSpacing="-2"
              fill="#e6e9ee"
              opacity="0.92"
            >
              S/P
            </text>
            <text
              x="160"
              y="258"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontSize="13"
              letterSpacing="6"
              fill="#8b9098"
            >
              CAPSULE 07
            </text>
          </svg>
        </div>
      </section>

      <section className="section" aria-labelledby="featured-heading">
        <div className="section__head">
          <h2 id="featured-heading">Featured this week</h2>
          <Button as="a" href="/shop" variant="ghost" size="sm">
            View all pieces
          </Button>
        </div>
        {offline && !loading ? (
          <OfflineNotice>
            The catalogue is temporarily unavailable. Everything else still works — try the
            featured drop again in a moment.
          </OfflineNotice>
        ) : null}
        <ProductGrid
          products={products}
          loading={loading}
          error={offline ? null : error}
          onRetry={handleRetry}
        />
      </section>

      <section className="section" aria-labelledby="values-heading">
        <h2 id="values-heading">Why people keep coming back</h2>
        <div className="grid grid--3">
          {VALUE_PROPS.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <h3>{item.title}</h3>
              </CardHeader>
              <CardBody>
                <p>{item.body}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="membership-heading">
        <Card className="teaser">
          <CardHeader>
            <p className="eyebrow">Street Pass</p>
            <h2 id="membership-heading">Get the drop 48 hours early</h2>
          </CardHeader>
          <CardBody>
            <p>
              Street Pass members unlock every capsule two days before public release, ship free
              on all orders and get access to member-only colourways that never hit the main
              catalogue.
            </p>
            <ul>
              <li>Early access to every drop</li>
              <li>Free tracked shipping, no minimum</li>
              <li>Member-only platinum colourways</li>
            </ul>
          </CardBody>
          <CardFooter>
            <div className="cluster">
              <Button as="a" href="/pricing" variant="primary" size="md">
                See membership plans
              </Button>
              <Button as="a" href="/billing" variant="ghost" size="md">
                Manage billing
              </Button>
            </div>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}