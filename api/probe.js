import { DF_TOKEN } from './_util.js';
// MIDLERTIDIG. Henter raa STAC-egenskaber inkl. pers:rotation_matrix for alle fire retninger.
const BASE = 'https://api.dataforsyningen.dk/rest/skraafoto_api/v2';
const CRS = 'http://www.opengis.net/def/crs/EPSG/0/25832';
export default async function handler(req, res){
  const token = DF_TOKEN(); if(!token) return res.status(503).json({error:'no token'});
  const x = Number(req.query.x), y = Number(req.query.y);
  const out = {};
  for(const dir of ['north','east','south','west']){
    const filter = {and:[{contains:[{property:'geometry'},{type:'Point',coordinates:[x,y]}]},{eq:[{property:'direction'},dir]}]};
    const u = `${BASE}/collections/skraafotos2025/items?limit=1&filter=${encodeURIComponent(JSON.stringify(filter))}`
      + `&filter-lang=cql-json&filter-crs=${encodeURIComponent(CRS)}&crs=${encodeURIComponent(CRS)}`;
    try{
      const r = await fetch(u, { headers:{ token } });
      const d = await r.json();
      const it = d.features && d.features[0];
      if(!it){ out[dir] = {ingen:true}; continue; }
      const p = it.properties;
      out[dir] = {
        id: it.id,
        io: p['pers:interior_orientation'],
        pc: p['pers:perspective_center'],
        omega: p['pers:omega'], phi: p['pers:phi'], kappa: p['pers:kappa'],
        rotation_matrix: p['pers:rotation_matrix'],
        crs: p['pers:crs'], vertical_crs: p['pers:vertical_crs'],
        bbox: it.bbox,
      };
    }catch(e){ out[dir] = {fejl:String(e.message)}; }
  }
  res.status(200).json(out);
}
