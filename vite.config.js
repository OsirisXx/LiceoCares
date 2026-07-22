import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const securityHeadersPlugin = () => ({
  name: 'security-headers',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url.split('?')[0];
      if (url.startsWith('/.git') || url === '/package.json' || url === '/config.json' || url.includes('.env')) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' https://localhost:* wss://localhost:* http://localhost:* ws://localhost:* https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';");
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
  server: {
    host: 'localhost',
    port: 5174,
    strictPort: true,
    hmr: { protocol: 'wss', host: 'localhost', clientPort: 5174 },
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
