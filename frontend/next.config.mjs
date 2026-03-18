import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  // Explicitly set workspace root to silence Turbopack warning
  // about multiple lockfiles in parent directories
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
