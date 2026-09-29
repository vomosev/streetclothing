'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

const NAV_LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/shop?category=outerwear', label: 'New Drop' },
  { href: '/pricing', label: 'Membership' },
  { href: '/billing', label: 'Billing' },
];

function firstName(user) {
  if (!user) return '';
  const source = user.fullName || user.full_name || user.email || '';
  const trimmed = String(source).trim();
  if (!trimmed) return 'Member';
  if (trimmed.includes('@')) return trimmed.split('@')[0];
  return trimmed.split(/\s+/)[0];
}

export default function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();

  let user = null;
  let authStatus = 'ready';
  let logout = null;
  try {
    const auth = useAuth();
    user = auth?.user ?? null;
    authStatus = auth?.status ?? 'ready';
    logout = auth?.logout ?? null;
  } catch (err) {
    user = null;
  }

  let itemCount = 0;
  try {
    const cart = useCart();
    itemCount = cart?.itemCount ?? 0;
  } catch (err) {
    itemCount = 0;
  }

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    if (!logout || signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } catch (err) {
      // Signing out locally is enough when the API is unreachable.
    } finally {
      setSigningOut(false);
      setMenuOpen(false);
    }
  }

  const isActive = (href) => {
    const base = href.split('?')[0];
    if (base === '/') return pathname === '/';
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="wordmark" aria-label="STREET/PLATINUM home">
          <span className="wordmark__mark" aria-hidden="true">S/P</span>
          <span className="wordmark__text">STREET/PLATINUM</span>
        </Link>

        <button
          type="button"
          className="site-header__toggle"
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            {menuOpen ? (
              <path
                d="M5 5l14 14M19 5L5 19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>

        <div
          id="site-nav"
          className={menuOpen ? 'site-header__panel site-header__panel--open' : 'site-header__panel'}
        >
          <nav className="site-nav" aria-label="Primary">
            <ul className="site-nav__list">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={isActive(link.href) ? 'site-nav__link is-active' : 'site-nav__link'}
                    aria-current={isActive(link.href) ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="site-header__actions">
            <Link href="/cart" className="cart-link" aria-label={`Bag, ${itemCount} item${itemCount === 1 ? '' : 's'}`}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path
                  d="M6 8h12l-1 11H7L6 8Zm3 0V6.5a3 3 0 0 1 6 0V8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="cart-link__text">Bag</span>
              {itemCount > 0 ? (
                <Badge tone="accent" size="sm">
                  {itemCount}
                </Badge>
              ) : null}
            </Link>

            {authStatus === 'loading' ? (
              <span className="site-header__auth-placeholder" aria-hidden="true" />
            ) : user ? (
              <div className="site-header__auth">
                <Link href="/account" className="site-nav__link truncate">
                  {firstName(user)}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  loading={signingOut}
                  disabled={signingOut}
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="site-header__auth">
                <Button as="a" href="/login" variant="ghost" size="sm">
                  Sign in
                </Button>
                <Button as="a" href="/signup" variant="primary" size="sm">
                  Join
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}