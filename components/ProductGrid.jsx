'use client';

import ProductCard from './ProductCard';
import EmptyState from './ui/EmptyState';
import { LoadingState, ErrorState } from './ui/StateViews';

export default function ProductGrid({
  products,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = 'No pieces in this drop yet',
  emptyDescription = 'Nothing is live in this category right now. Check the full shop or come back when the next drop lands.',
  emptyAction = null,
  skeletonRows = 6,
}) {
  if (loading) {
    return <LoadingState rows={skeletonRows} variant="grid" />;
  }

  if (error) {
    return (
      <ErrorState
        message={
          typeof error === 'string'
            ? error
            : error?.message || 'The catalogue could not be loaded.'
        }
        onRetry={onRetry}
      />
    );
  }

  const list = Array.isArray(products) ? products : [];

  if (list.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="product-grid">
      {list.map((product) => (
        <ProductCard
          key={product.id ?? product.slug}
          product={product}
        />
      ))}
    </div>
  );
}