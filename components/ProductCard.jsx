'use client';

import Link from 'next/link';
import Card, { CardBody } from './ui/Card';
import Badge from './ui/Badge';
import ProductArtwork from './ProductArtwork';
import { formatPrice } from '../lib/format';

export default function ProductCard({ product }) {
  if (!product) return null;

  const {
    slug,
    name,
    tagline,
    colorway,
    dropName,
    priceCents,
    accentHex,
    category,
    inStock,
  } = product;

  const soldOut = inStock === 0 || inStock === false;

  return (
    <Card as="article" interactive padded={false} className="product-card">
      <Link href={`/product/${slug}`} className="product-card__link">
        <div className="product-card__media">
          <ProductArtwork
            name={name}
            accentHex={accentHex}
            category={category}
            ratio="4/5"
          />
          <div className="product-card__tags cluster">
            {dropName ? <Badge tone="accent" size="sm">{dropName}</Badge> : null}
            {soldOut ? <Badge tone="danger" size="sm">Sold out</Badge> : null}
          </div>
        </div>

        <CardBody className="product-card__body">
          <div className="product-card__text user-text">
            <h3 className="product-card__name">{name}</h3>
            <p className="product-card__meta">
              {colorway || tagline || 'Core collection'}
            </p>
          </div>
          <p className="product-card__price">{formatPrice(priceCents)}</p>
        </CardBody>
      </Link>
    </Card>
  );
}