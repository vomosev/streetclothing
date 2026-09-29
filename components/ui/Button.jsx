'use client';

import Link from 'next/link';
import Spinner from './Spinner';

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  as = 'button',
  href,
  type = 'button',
  loading = false,
  disabled = false,
  fullWidth = false,
  className,
  onClick,
  ...rest
}) {
  const isDisabled = Boolean(disabled || loading);

  const classes = classNames(
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth && 'btn--block',
    loading && 'is-loading',
    isDisabled && 'is-disabled',
    className
  );

  const content = (
    <>
      {loading ? (
        <span className="btn__spinner" aria-hidden="true">
          <Spinner size={size === 'lg' ? 'md' : 'sm'} label="Working" />
        </span>
      ) : null}
      <span className="btn__label">{children}</span>
    </>
  );

  if (as === 'a' || href) {
    if (isDisabled || !href) {
      return (
        <span
          className={classes}
          role="link"
          aria-disabled="true"
          aria-busy={loading ? 'true' : undefined}
          {...rest}
        >
          {content}
        </span>
      );
    }

    const isExternal = /^https?:\/\//i.test(href) || href.startsWith('mailto:');

    if (isExternal) {
      return (
        <a
          className={classes}
          href={href}
          onClick={onClick}
          aria-busy={loading ? 'true' : undefined}
          {...rest}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        className={classes}
        href={href}
        onClick={onClick}
        aria-busy={loading ? 'true' : undefined}
        {...rest}
      >
        {content}
      </Link>
    );
  }

  function handleClick(event) {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    if (typeof onClick === 'function') {
      try {
        onClick(event);
      } catch (error) {
        // Surface handler failures without breaking the render tree.
        console.error('Button onClick handler failed:', error);
      }
    }
  }

  return (
    <button
      className={classes}
      type={type}
      disabled={isDisabled}
      aria-busy={loading ? 'true' : undefined}
      onClick={handleClick}
      {...rest}
    >
      {content}
    </button>
  );
}