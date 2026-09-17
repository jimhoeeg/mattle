import { DF_TOKEN, bad } from './_util.js';
// Skråfoto STAC API v2: finder det nyeste skråfoto, der dækker punktet, set fra en given retning
const BASE = 'https://api.dataforsyningen.dk/rest/skraafoto_api/v2';
const CRS = 'http://www.opengis.net/def/crs/EPSG/0/25832';
const DIRS = new Set(['north', 'south', 'east', 'west', 'nadir']);
let collectionsCache = null, collectionsAt = 0;

async function collections(token){
  if(collectionsCache && Date.now() - collectionsAt < 6 * 3600 * 1000) return collectionsCache;
  const r = await fetch(BASE + '/collections', { headers: { token } });
  if(!r.ok) throw new Error('collections ' + r.status);
  const data = await r.json();
  collectionsCache = (data.collections || []).map(c => c.id).filter(id => !/test/i.test(id)).sort().reverse();
  collectionsAt = Date.now();
  return collectionsCache;
}
export default async function handler(req, res){
  const token = DF_TOKEN(); if(!token) return bad(res, 503, 'not configured');
  const x = Number(req.query.x), y = Number(req.query.y), direction = String(req.query.direction || '');
  if(!(x > 400000 && x < 910000 && y > 6000000 && y < 6420000)) return bad(res, 400, 'outside Denmark');
  if(!DIRS.has(direction)) return bad(res, 400, 'invalid direction');
  const filter = { and: [
    { contains: [ { property: 'geometry' }, { type: 'Point', coordinates: [x, y] } ] },
    { eq: [ { property: 'direction' }, direction ] },
  ]};
  try{
    const cols = await collections(token);
    for(const col of cols.slice(0, 4)){
      const url = `${BASE}/collections/${encodeURIComponent(col)}/items?limit=1&filter=${encodeURIComponent(JSON.stringify(filter))}&filter-lang=cql-json&filter-crs=${encodeURIComponent(CRS)}&crs=${encodeURIComponent(CRS)}`;
      const r = await fetch(url, { headers: { token } });
      if(!r.ok) continue;
      const data = await r.json();
      const item = data.features && data.features[0];
      if(!item || !item.assets || !item.assets.data) continue;
      const p = item.properties || {};
      res.setHeader('Cache-Control', 'public, s-maxage=86400');
      return res.status(200).json({
        id: item.id, collection: col, datetime: p.datetime, direction: p.direction,
        href: item.assets.data.href,
        properties: {
          'pers:interior_orientation': p['pers:interior_orientation'],
          'pers:perspective_center': p['pers:perspective_center'],
          'pers:omega': p['pers:omega'], 'pers:phi': p['pers:phi'], 'pers:kappa': p['pers:kappa'],
        },
      });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return bad(res, 404, 'no image');
  }catch(e){ return bad(res, 502, 'upstream error'); }
}
