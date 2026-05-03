import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /* config options here */
  // Vercel build trigger - Ders Izlenceleri module
};

export default withNextIntl(nextConfig);
