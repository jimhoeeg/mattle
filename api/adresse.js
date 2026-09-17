import { DF_TOKEN, bad } from './_util.js';
// Adressesøgning via Dataforsyningens GSearch v2.0 (koordinater i WGS84)
function firstCoord(g){
  if(!g) return null;
  let c = g.coordinates;
  while(Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) ? c : null;
}
export default async function handler(req, res){
  const token = DF_TOKEN(); if(!token) return bad(res, 503, 'not configured');
  const q = String(req.query.q || '').trim();
  if(q.length < 2 || q.length > 100) return bad(res, 400, 'invalid query');
  try{
    const url = 'https://api.dataforsyningen.dk/rest/gsearch/v2.0/husnummer?q=' + encodeURIComponent(q) + '&limit=6&srid=4326';
    const r = await fetch(url, { headers: { token } });
    if(!r.ok) return bad(res, 502, 'upstream ' + r.status);
    const data = await r.json();
    const results = (Array.isArray(data) ? data : []).map(x => {
      const c = firstCoord(x.geometri || x.adgangspunkt_geometri || x.vejpunkt_geometri);
      return c ? { label: x.visningstekst, lon: c[0], lat: c[1] } : null;
    }).filter(Boolean);
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    res.status(200).json({ results });
  }catch(e){ bad(res, 502, 'upstream error'); }
}
