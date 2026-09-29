/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      'https://streetclothing-api.arx-app.com:4117',
  },
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;