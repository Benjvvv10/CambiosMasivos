/**
 * Configuración de Next.js
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,

  // Variables de entorno expuestas al navegador
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  
  // Configuración de imágenes
  images: {
    domains: [],
  },
}

module.exports = nextConfig
