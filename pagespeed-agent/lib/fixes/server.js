import chalk from 'chalk';

// ─── Generate Nginx config snippet ────────────────────────────────────────────

export function generateNginxConfig(targetUrl) {
  const config = `
# ─── PageSpeed Agent — Nginx Configuration ───────────────────────────────────
# Add this inside your server {} block (or include as a separate .conf file)

server {
    listen 443 ssl http2;
    server_name ${new URL(targetUrl || 'https://example.com').hostname};

    # ── Compression ────────────────────────────────────────────────────────────
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain text/css text/xml text/javascript
        application/json application/javascript application/xml
        image/svg+xml font/woff font/woff2;

    # Serve pre-compressed brotli/gzip files if they exist
    # (requires nginx-brotli module — see: https://github.com/google/ngx_brotli)
    brotli on;
    brotli_comp_level 6;
    brotli_types text/html text/css application/javascript application/json image/svg+xml;

    # ── Cache headers ──────────────────────────────────────────────────────────
    # Long-lived cache for content-hashed static assets
    location ~* \\.(js|css|woff2?|ttf|eot|otf|ico|svg|webp|avif|png|jpg|jpeg|gif)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header Vary Accept-Encoding;
    }

    # HTML — short cache, always revalidate
    location ~* \\.html$ {
        expires 1h;
        add_header Cache-Control "public, max-age=3600, must-revalidate";
    }

    # ── Security headers (Best Practices score) ────────────────────────────────
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Content Security Policy (start permissive, tighten later)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https:; frame-ancestors 'none'" always;

    # ── HTTP → HTTPS redirect ─────────────────────────────────────────────────
    # (in a separate server block)
    # server {
    #     listen 80;
    #     return 301 https://$host$request_uri;
    # }
}
`;
  return config;
}

// ─── Generate Express.js middleware snippet ────────────────────────────────────

export function generateExpressMiddleware() {
  return `
// ─── PageSpeed Agent — Express.js Middleware ──────────────────────────────────
// Install: npm install helmet compression express-static-gzip

import helmet from 'helmet';
import compression from 'compression';
import expressStaticGzip from 'express-static-gzip';
import express from 'express';

const app = express();

// Security headers (Best Practices score)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
}));

// Gzip compression
app.use(compression({ level: 6 }));

// Serve pre-compressed static files (brotli first, then gzip)
app.use('/', expressStaticGzip('dist', {
  enableBrotli: true,
  orderPreference: ['br', 'gz'],
  serveStatic: {
    maxAge: '1y',
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      }
    },
  },
}));
`;
}

// ─── Print server config instructions ─────────────────────────────────────────

export function printServerInstructions(targetUrl) {
  console.log('\n' + chalk.bold.yellow('⚠  Server Configuration Required'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log('The agent cannot apply server-level changes automatically.');
  console.log('Apply the following to get compression, caching, and security headers:\n');
  console.log(chalk.bold('For Nginx:'));
  console.log(chalk.dim('  Save to /etc/nginx/conf.d/pagespeed.conf, then: nginx -s reload'));
  console.log(chalk.cyan(generateNginxConfig(targetUrl)));
  console.log(chalk.bold('For Express.js:'));
  console.log(chalk.cyan(generateExpressMiddleware()));
}
