'use client';

import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

export default function SiteShell({ children }) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" className="site-main container">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}