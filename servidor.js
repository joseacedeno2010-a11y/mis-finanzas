/* Servidor local sin dependencias. Uso: node servidor.js  ->  http://localhost:8765 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const root = __dirname, port = Number(process.env.PORT) || 8765;
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon', '.md':'text/markdown; charset=utf-8' };
http.createServer((req, res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p==='/') p = '/index.html';
  const f = path.normalize(path.join(root, p));
  if (!f.startsWith(root)){ res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data)=>{
    if (err){ res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-cache' });
    res.end(data);
  });
}).listen(port, '0.0.0.0', ()=>{
  console.log(`Mis Finanzas en:  http://localhost:${port}`);
  for (const ifs of Object.values(os.networkInterfaces())) for (const i of ifs) if (i.family==='IPv4' && !i.internal) console.log(`Desde el teléfono (misma wifi):  http://${i.address}:${port}`);
});
