import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/css/styles.css', ['css/styles.css', 'text/css; charset=utf-8']],
  ['/js/config.js', ['js/config.js', 'text/javascript; charset=utf-8']],
  ['/js/api.js', ['js/api.js', 'text/javascript; charset=utf-8']],
  ['/js/money.js', ['js/money.js', 'text/javascript; charset=utf-8']],
  ['/js/app.js', ['js/app.js', 'text/javascript; charset=utf-8']],
]);

createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1:5500').pathname;
  const entry = files.get(pathname);
  if (!entry) {
    response.writeHead(404).end('Not found');
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const content = await readFile(new URL(entry[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(500).end('Unable to serve this file');
  }
}).listen(5500, '127.0.0.1', () => {
  process.stdout.write('Frontend available at http://127.0.0.1:5500\n');
});
