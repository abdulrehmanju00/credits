import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = '0.0.0.0';

  app.use(express.json({ limit: '10mb' }));

  // Serve original Stitch screens with nav and db scripts injected
  app.get(['/screens/*/*.html', '/reference-screens/*/*.html'], (req, res, next) => {
    const filePath = req.path.slice(1);
    const absolutePath = path.join(__dirname, filePath);
    if (fs.existsSync(absolutePath)) {
      let content = fs.readFileSync(absolutePath, 'utf-8');
      const injection = `
        <script src="/creditflow-db.js"></script>
        <script src="/creditflow-nav.js"></script>
        <script>
          // Ensure navigation clicks inside this screen navigate the top application window
          document.addEventListener('click', function(e) {
            const a = e.target.closest('a');
            if (a && a.href && !a.href.startsWith('javascript:') && !a.getAttribute('target')) {
              try {
                const url = new URL(a.href, window.location.origin);
                if (url.origin === window.location.origin && url.pathname && url.pathname !== '/' && !url.hash.startsWith('#')) {
                  e.preventDefault();
                  if (window.top && window.top !== window) {
                    window.top.location.href = url.pathname;
                  } else {
                    window.location.href = url.pathname;
                  }
                }
              } catch (err) {
                // Ignore URL parsing errors for non-standard schemes
              }
            }
          }, true);
        </script>
      `;
      if (content.includes('</body>')) {
        content = content.replace('</body>', `${injection}</body>`);
      } else {
        content += injection;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(content);
    }
    next();
  });

  // Static assets for original Stitch screens and references (images, css, etc.)
  app.use('/screens', express.static(path.join(__dirname, 'screens')));
  app.use('/reference-screens', express.static(path.join(__dirname, 'reference-screens')));

  // Direct script and library access
  app.get('/creditflow-db.js', (_req, res) => {
    res.sendFile(path.join(__dirname, 'creditflow-db.js'));
  });

  app.get('/creditflow-nav.js', (_req, res) => {
    res.sendFile(path.join(__dirname, 'creditflow-nav.js'));
  });

  app.get('/library', (_req, res) => {
    res.sendFile(path.join(__dirname, 'library.html'));
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', framework: 'react-19-vite-ts' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`CreditFlow React running on http://${HOST}:${PORT}`);
  });
}

startServer();
