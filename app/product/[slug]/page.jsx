'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getProduct } from '../../../lib/api';
import { formatPrice, titleCase } from '../../../lib/format';
import ProductArtwork from '../../../components/ProductArtwork';
import AddToCartForm from '../../../components/AddToCartForm';
import Badge from '../../../components/ui/Badge';
import EmptyState from '../../../components/ui/EmptyState';
import Button from '../../../components/ui/Button';
import { LoadingState, ErrorState } from '../../../components/ui/StateViews';

export default function ProductDetailPage() {
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!slug) {
      setStatus('missing');
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    setStatus('loading');
    setError('');

    getProduct(slug, { signal: controller.signal })
      .then((data) => {
        if (!active) return;
        const found = data && data.product ? data.product : null;
        if (!found) {
          setProduct(null);
          setStatus('missing');
          return;
        }
        setProduct(found);
        setStatus('ready');
      })
      .catch((err) => {
        if (!active || (err && err.name === 'AbortError')) return;
        if (err && err.status === 404) {
          setProduct(null);
          setStatus('missing');
          return;
        }
        setError((err && err.message) || 'We could not load this piece right now.');
        setStatus('error');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [slug, reloadKey]);

  if (status === 'loading') {
    return (
      <section className="stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/shop">Shop</Link>
        </nav>
        <LoadingState rows={2} variant="detail" />
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="stack">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/shop">Shop</Link>
        </nav>
        <ErrorState message={error} onRetry={retry} />
      </section>
    );
  }

  if (status === 'missing' || !product) {
    return (
      <section className="stack">
        <EmptyState
          title="Piece not found"
          description="This item is no longer in the drop, or the link you followed is out of date. The rest of the collection is still live."
          action={
            <Button as="a" href="/shop" variant="primary" size="md">
              Back to the shop
            </Button>
          }
        />
      </section>
    );
  }

  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const totalStock = sizes.reduce((sum, size) => sum + (Number(size.stock) || 0), 0);
  const soldOut = product.inStock === 0 || product.inStock === false || (sizes.length > 0 && totalStock === 0);
  const paragraphs = String(product.description || '')
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <section className="stack">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/shop">Shop</Link>
        <span aria-hidden="true">/</span>
        <span className="truncate user-text">{product.name}</span>
      </nav>

      <div className="product-detail">
        <div className="product-detail__media">
          <ProductArtwork
            name={product.name}
            accentHex={product.accentHex}
            category={product.category}
            ratio="4/5"
          />
        </div>

        <div className="product-detail__info stack">
          <div className="cluster">
            {product.dropName ? <Badge tone="accent">{product.dropName}</Badge> : null}
            {product.category ? <Badge tone="neutral">{titleCase(product.category)}</Badge> : null}
            {soldOut ? <Badge tone="danger">Sold out</Badge> : <Badge tone="success">In stock</Badge>}
          </div>

          <h1 className="user-text">{product.name}</h1>

          {product.tagline ? <p className="text-muted user-text">{product.tagline}</p> : null}

          <p className="product-detail__price">{formatPrice(product.priceCents)}</p>

          {product.colorway ? (
            <p className="text-muted user-text">
              Colourway — <strong>{product.colorway}</strong>
            </p>
          ) : null}

          <AddToCartForm product={product} />

          <div className="stack">
            <h2>Details</h2>
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => (
                <p key={index} className="user-text">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="text-muted">
                Cut and finished in heavyweight fabric for the STREET/PLATINUM drop. Full spec sheet lands with the
                next release.
              </p>
            )}

            <h2>Shipping &amp; returns</h2>
            <ul>
              <li>Free worldwide shipping for Street Pass members, $8 flat otherwise.</li>
              <li>Dispatched within two working days of the drop closing.</li>
              <li>30-day returns on unworn pieces with tags attached.</li>
              <li>Every order ships with a signed drop card and care guide.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}