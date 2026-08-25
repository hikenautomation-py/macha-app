/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint tetap bisa dijalankan manual via `npm run lint`; jangan blokir build di tahap awal.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
