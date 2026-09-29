import Link from 'next/link';

const SHOP_LINKS = [
  { href: '/shop?category=tees', label: 'Tees' },
  { href: '/shop?category=hoodies', label: 'Hoodies' },
  { href: '/shop?category=outerwear', label: 'Outerwear' },
  { href: '/shop?category=pants', label: 'Pants' },
  { href: '/shop?category=accessories', label: 'Accessories' },
];

const SUPPORT_LINKS = [
  { href: '/shop', label: 'Sizing & fit' },
  { href: '/account', label: 'Order tracking' },
  { href: '/cart', label: 'Your bag' },
  { href: '/billing', label: 'Billing help' },
];

const MEMBER_LINKS = [
  { href: '/pricing', label: 'Street Pass tiers' },
  { href: '/billing', label: 'Manage membership' },
  { href: '/signup', label: 'Create an account' },
  { href: '/login', label: 'Sign in' },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="footer-wordmark">STREET/PLATINUM</span>
            <p className="footer-blurb">
              Limited streetwear cut in small runs from a studio in East London. Every drop is
              numbered, restocked once, and finished in blackout and platinum hardware.
            </p>
          </div>

          <nav className="footer-col" aria-label="Shop categories">
            <h3 className="footer-heading">Shop</h3>
            <ul className="footer-list">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="footer-col" aria-label="Support">
            <h3 className="footer-heading">Support</h3>
            <ul className="footer-list">
              {SUPPORT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="footer-col" aria-label="Membership">
            <h3 className="footer-heading">Membership</h3>
            <ul className="footer-list">
              {MEMBER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="footer-bar">
          <p className="footer-legal">&copy; {year} STREET/PLATINUM. All rights reserved.</p>
          <p className="footer-legal">Prices in USD. Free shipping for Street Pass members.</p>
        </div>
      </div>
    </footer>
  );
}