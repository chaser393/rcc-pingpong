import type { NextConfig } from 'next';

const nextConfig: NextConfig =
  ['windows', 'node'].includes(process.env.PONG_TARGET ?? '') ? { output: 'standalone' } : {};

export default nextConfig;
