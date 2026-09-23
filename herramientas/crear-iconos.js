/* Genera icons/icon-192.png e icons/icon-512.png sin dependencias (PNG RGBA + zlib) */
const zlib = require('zlib'), fs = require('fs'), path = require('path');
function crc32(buf){ let crc = 0xffffffff; for (let n=0; n<buf.length; n++){ let c = (crc ^ buf[n]) & 0xff; for (let k=0; k<8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data){ const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); }
function png(w, h, rgba){
  const raw = Buffer.alloc((w*4+1)*h);
  for (let y=0; y<h; y++){ raw[y*(w*4+1)] = 0; rgba.copy(raw, y*(w*4+1)+1, y*w*4, (y+1)*w*4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function distSeg(px, py, a, b){ const dx = b[0]-a[0], dy = b[1]-a[1]; const l2 = dx*dx+dy*dy || 1; let t = ((px-a[0])*dx + (py-a[1])*dy)/l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px-(a[0]+t*dx), py-(a[1]+t*dy)); }
function draw(size){
  const px = Buffer.alloc(size*size*4);
  const top = [15,118,110], bottom = [19,78,74], fg = [255,255,255];
  const P = (x, y)=>[x*size, y*size];
  const segs = [[P(.18,.72), P(.40,.50)], [P(.40,.50), P(.56,.63)], [P(.56,.63), P(.82,.32)], [P(.64,.32), P(.82,.32)], [P(.82,.32), P(.82,.50)]];
  const th = size*0.095;
  for (let y=0; y<size; y++) for (let x=0; x<size; x++){
    const t = y/size; const bg = [0,1,2].map(i=>top[i]+(bottom[i]-top[i])*t);
    let d = Infinity; for (const s of segs) d = Math.min(d, distSeg(x+0.5, y+0.5, s[0], s[1]));
    const a = Math.max(0, Math.min(1, (th/2 - d) + 0.5));
    const i = (y*size+x)*4;
    px[i] = bg[0]+(fg[0]-bg[0])*a; px[i+1] = bg[1]+(fg[1]-bg[1])*a; px[i+2] = bg[2]+(fg[2]-bg[2])*a; px[i+3] = 255;
  }
  return png(size, size, px);
}
const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const s of [192, 512]) fs.writeFileSync(path.join(out, `icon-${s}.png`), draw(s));
console.log('Íconos creados en', out);
