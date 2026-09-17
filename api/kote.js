import { DF_TOKEN, bad } from './_util.js';
// Terrænkote (DVR90) i et punkt, fra Danmarks Højdemodel via Dataforsyningens WCS.
//
// Hvorfor det er nødvendigt: skråfotos er optaget i ca. 45 graders vinkel. Skal et punkt på
// jorden placeres rigtigt i et skråfoto, skal punktets højde over havet kendes. Regner man
// med kote 0, forskydes udsnittet vandret med omtrent lige så mange meter, som terrænet
// ligger over havet — og i retning mod kameraet. De fire retninger forskydes derfor hver
// sin vej: ved kote 40 ligger de fire udsnit ca. 83 m fra hinanden.
const WCS = 'https://api.dataforsyningen.dk/dhm_wcs_DAF';
const cache = new Map();   // nøgle: 10x10 m-celle. Terrænet ændrer sig ikke mellem forespørgsler.

/* Minimal TIFF-læser. Tjenesten leverer kun GTiff, så vi læser rasteret selv. */
function samples(buf){
  const tag = buf.toString('ascii', 0, 2);
  const le = tag === 'II';
  if(!le && tag !== 'MM') throw new Error('ikke en tiff');
  const u16 = o => le ? buf.readUInt16LE(o) : buf.readUInt16BE(o);
  const u32 = o => le ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
  if(u16(2) !== 42) throw new Error('ikke en tiff');
  const SIZES = {1:1, 2:1, 3:2, 4:4, 5:8, 6:1, 7:1, 8:2, 9:4, 10:8, 11:4, 12:8};
  const ifd = u32(4), n = u16(ifd), t = {};
  for(let i=0;i<n;i++){
    const e = ifd + 2 + i*12, id = u16(e), type = u16(e+2), count = u32(e+4);
    const inline = (SIZES[type] || 1) * count <= 4;
    const at = inline ? e + 8 : u32(e + 8);
    t[id] = { type, count, at, value: type === 3 ? u16(at) : (type === 4 ? u32(at) : at) };
  }
  if(t[259] && t[259].value !== 1) throw new Error('komprimeret tiff');
  const bits = t[258] ? t[258].value : 32;
  const fmt  = t[339] ? t[339].value : 1;            // 1=heltal, 2=fortegnet, 3=kommatal
  if(!t[273]) throw new Error('ingen billeddata');
  const off = t[273].value;
  const bytes = t[279] ? t[279].value : 4;
  const step = bits / 8;
  const read = (bits === 32 && fmt === 3) ? (o => le ? buf.readFloatLE(o)  : buf.readFloatBE(o))
             : (bits === 64 && fmt === 3) ? (o => le ? buf.readDoubleLE(o) : buf.readDoubleBE(o))
             : (bits === 16)              ? (o => le ? buf.readInt16LE(o)  : buf.readInt16BE(o))
             : (bits === 32)              ? (o => le ? buf.readInt32LE(o)  : buf.readInt32BE(o))
             : null;
  if(!read) throw new Error('ukendt talformat');
  const out = [];
  for(let o = off; o + step <= Math.min(off + bytes, buf.length); o += step) out.push(read(o));
  if(!out.length) throw new Error('tomt raster');
  return out;
}

export default async function handler(req, res){
  const token = DF_TOKEN(); if(!token) return bad(res, 503, 'not configured');
  const x = Number(req.query.x), y = Number(req.query.y);
  if(!(x > 400000 && x < 910000 && y > 6000000 && y < 6420000)) return bad(res, 400, 'outside Denmark');

  const key = Math.round(x/10) + ':' + Math.round(y/10);
  if(cache.has(key)){
    res.setHeader('Cache-Control', 'public, s-maxage=2592000');
    return res.status(200).json({ kote: cache.get(key), cached: true });
  }
  try{
    // Et for lille udtræk svarer tjenesten på med lutter nuller — et 1x1-vindue giver 0
    // overalt, og selv 16 m rammer ved siden af nogle steder. 40 m virker. Og fordi et
    // nul ikke kan skelnes fra "ingen data", prøves der igen med et større vindue,
    // før et nul accepteres som en rigtig kote ved havoverfladen.
    const median = async function(h){
      const bbox = [(x-h).toFixed(2), (y-h).toFixed(2), (x+h).toFixed(2), (y+h).toFixed(2)].join(',');
      const url = WCS + '?SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=dhm_terraen'
        + '&CRS=epsg:25832&RESPONSE_CRS=epsg:25832&BBOX=' + bbox + '&WIDTH=4&HEIGHT=4&FORMAT=GTiff'
        + '&token=' + encodeURIComponent(token);
      const r = await fetch(url);
      if(!r.ok) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      if(!/^(II|MM)/.test(buf.toString('ascii', 0, 2))) return null;
      const v = samples(buf).filter(function(n){ return isFinite(n); }).sort(function(a,b){ return a-b; });
      if(!v.length) return null;
      return v.length % 2 ? v[(v.length-1)/2] : (v[v.length/2-1] + v[v.length/2]) / 2;
    };
    let kote = await median(20);
    if(kote === 0) kote = await median(60);
    if(kote === 0) kote = await median(200);
    if(kote === null) return bad(res, 502, 'no elevation');
    // Danmarks laveste punkt er ca. -7 m, det højeste ca. 171 m. Ugyldige celler
    // kommer typisk tilbage som et meget stort negativt tal.
    if(!isFinite(kote) || kote < -20 || kote > 300) return bad(res, 502, 'no elevation');
    if(cache.size > 2000) cache.clear();
    cache.set(key, kote);
    res.setHeader('Cache-Control', 'public, s-maxage=2592000');
    res.status(200).json({ kote });
  }catch(e){ bad(res, 502, 'upstream error'); }
}
