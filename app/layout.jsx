import './globals.css';
import { Inter, Space_Grotesk } from 'next/font/google';
import SiteShell from '../components/layout/SiteShell';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';

const bodyFont = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

export const metadata = {
  metadataBase: new URL('https://streetclothing.arx-app.com'),
  title: 'STREET/PLATINUM — Streetwear Drops',
  description:
    'STREET/PLATINUM is a black-and-platinum streetwear label. Shop limited drops of hoodies, tees, cargo pants and outerwear, or join Street Pass for early access and free shipping.',
  applicationName: 'STREET/PLATINUM',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'STREET/PLATINUM — Streetwear Drops',
    description:
      'Limited black-and-platinum streetwear drops. Hoodies, tees, cargo pants and outerwear, released drop-first.',
    type: 'website',
    url: '/',
    siteName: 'STREET/PLATINUM',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <AuthProvider>
          <CartProvider>
            <SiteShell>{children}</SiteShell>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}