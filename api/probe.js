import { DF_TOKEN } from './_util.js';
import { fromUrl } from 'geotiff';
// MIDLERTIDIG. Gentager nøjagtig samme udklip som browseren laver, og rapporterer
// filens opbygning samt et lille billede, så resultatet kan efterses.
const BASE = 'https://api.dataforsyningen.dk/rest/skraafoto_api/v2';
const CRS = 'http://www.opengis.net/def/crs/EPSG/0/25832';

function getImageXY(item, X, Y, Z){
  const P=item.properties, io=P['pers:interior_orientation'];
  const xx0=io.principal_point_offset[0], yy0=io.principal_point_offset[1];
  const ci=io.focal_length, pix=io.pixel_spacing[0];
  const dimXi=io.sensor_array_dimensions[0], dimYi=io.sensor_array_dimensions[1];
  const X0=P['pers:perspective_center'][0], Y0=P['pers:perspective_center'][1], Z0=P['pers:perspective_center'][2];
  const r=d=>d*Math.PI/180;
  const o=r(P['pers:omega']), p=r(P['pers:phi']), k=r(P['pers:kappa']);
  const c=-ci, dimX=-(dimXi*pix/2), dimY=-(dimYi*pix/2);
  const D11=Math.cos(p)*Math.cos(k), D12=-Math.cos(p)*Math.sin(k), D13=Math.sin(p);
  const D21=Math.cos(o)*Math.sin(k)+Math.sin(o)*Math.sin(p)*Math.cos(k), D22=Math.cos(o)*Math.cos(k)-Math.sin(o)*Math.sin(p)*Math.sin(k), D23=-Math.sin(o)*Math.cos(p);
  const D31=Math.sin(o)*Math.sin(k)-Math.cos(o)*Math.sin(p)*Math.cos(k), D32=Math.sin(o)*Math.cos(k)+Math.cos(o)*Math.sin(p)*Math.sin(k), D33=Math.cos(o)*Math.cos(p);
  const den=D13*(X-X0)+D23*(Y-Y0)+D33*(Z-Z0);
  const xd=-c*((D11*(X-X0)+D21*(Y-Y0)+D31*(Z-Z0))/den);
  const yd=-c*((D12*(X-X0)+D22*(Y-Y0)+D32*(Z-Z0))/den);
  return [((xd-xx0)+dimX)*-1/pix, ((yd-yy0)+dimY)*-1/pix];
}

export default async function handler(req, res){
  const token = DF_TOKEN(); if(!token) return res.status(503).json({error:'no token'});
  const x=Number(req.query.x), y=Number(req.query.y), Z=Number(req.query.z||0);
  const dir=String(req.query.direction||'north');
  const filter={and:[{contains:[{property:'geometry'},{type:'Point',coordinates:[x,y]}]},{eq:[{property:'direction'},dir]}]};
  const u=`${BASE}/collections/skraafotos2025/items?limit=1&filter=${encodeURIComponent(JSON.stringify(filter))}`
    +`&filter-lang=cql-json&filter-crs=${encodeURIComponent(CRS)}&crs=${encodeURIComponent(CRS)}`;
  const r=await fetch(u,{headers:{token}});
  const d=await r.json();
  const it=d.features && d.features[0];
  if(!it) return res.status(404).json({error:'no image'});

  const item={properties:it.properties};
  const out={id:it.id, dir, z:Z};
  try{
    const tiff=await fromUrl(it.assets.data.href);
    const count=await tiff.getImageCount();
    const full=await tiff.getImage(0);
    const W=full.getWidth(), H=full.getHeight();
    out.ifd_antal=count; out.ifd0=[W,H];
    out.ifd_alle=[];
    for(let i=0;i<count;i++){ const im=await tiff.getImage(i); out.ifd_alle.push([im.getWidth(), im.getHeight()]); }
    out.sensor = item.properties['pers:interior_orientation'].sensor_array_dimensions;

    let center=getImageXY(item,x,y,Z);
    if(req.query.px) center=[Number(req.query.px), Number(req.query.py)];
    out.center=[Math.round(center[0]),Math.round(center[1])];
    out.beregnet=getImageXY(item,x,y,Z).map(Math.round);
    const outW=640,outH=440,aspect=outW/outH; const half=Number(req.query.half||450), hw=half*aspect, hh=half;
    let x0=Math.round(center[0]-hw), y0=Math.round(center[1]-hh), x1=Math.round(center[0]+hw), y1=Math.round(center[1]+hh);
    out.vindue_fuld=[x0,y0,x1,y1];
    x0=Math.max(0,x0); y0=Math.max(0,y0); x1=Math.min(W,x1); y1=Math.min(H,y1);
    let img=full, scale=1;
    for(let i=count-1;i>=1;i--){ const ov=await tiff.getImage(i); const s=ov.getWidth()/W; if((x1-x0)*s>=outW*0.9){ img=ov; scale=s; break; } }
    out.valgt_skala=scale; out.valgt_stoerrelse=[img.getWidth(),img.getHeight()];
    const win=[Math.floor(x0*scale),Math.floor(y0*scale),Math.ceil(x1*scale),Math.ceil(y1*scale)];
    out.vindue_i_oversigt=win;
    const cw=Number(req.query.w||240), ch=Math.round(cw*440/640);
    const rgb=await img.readRGB({window:win,width:cw,height:ch,interleave:true});
    out.pixels=[cw,ch];
    out.rgb=Buffer.from(rgb.buffer||rgb).toString('base64');
  }catch(e){ out.fejl=String(e.message); }
  res.status(200).json(out);
}
