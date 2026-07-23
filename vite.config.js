import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const securityHeadersPlugin = () => ({
  name: 'security-headers',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url.split('?')[0];
      if (url.startsWith('/.git') || url.startsWith('/.vercel') || url === '/package.json' || url === '/config.json' || url.includes('.env')) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'nonce-liceo-vite-dev' https://challenges.cloudflare.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com; connect-src 'self' https://localhost:* wss://localhost:* http://localhost:* ws://localhost:* https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://turnstile-siteverify-liceocares.harleybusa82.workers.dev; frame-src https://challenges.cloudflare.com https://accounts.google.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });
  }
});

export default defineConfig({
  plugins: [react(), basicSsl(), securityHeadersPlugin()],
  html: { cspNonce: 'liceo-vite-dev' },
  server: {
    host: 'localhost',
    port: 5174,
    strictPort: true,
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.vercel/**'],
    },
    hmr: { protocol: 'wss', host: 'localhost', clientPort: 5174 },
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
})
