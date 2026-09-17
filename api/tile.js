import { DF_TOKEN } from './_util.js';
// Ortofoto forår (Web Mercator WMTS) via Dataforsyningen. Token tilføjes på serveren.
export default async function handler(req, res){
  const token = DF_TOKEN(); if(!token){ res.status(503).end(); return; }
  const z = parseInt(req.query.z, 10), x = parseInt(req.query.x, 10), y = parseInt(req.query.y, 10);
  if(!(z >= 0 && z <= 20) || !(x >= 0 && x < 2 ** z) || !(y >= 0 && y < 2 ** z)){ res.status(400).end(); return; }
  const url = 'https://api.dataforsyningen.dk/orto_foraar_webm_DAF?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
    '&LAYER=orto_foraar_webm&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=DFD_GoogleMapsCompatible' +
    `&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&token=${encodeURIComponent(token)}`;
  try{
    const r = await fetch(url);
    if(!r.ok){ res.status(r.status === 404 ? 404 : 502).end(); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000');
    res.status(200).send(buf);
  }catch(e){ res.status(502).end(); }
}
