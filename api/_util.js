export const DF_TOKEN = () => process.env.DATAFORSYNINGEN_TOKEN || '';
export function allowOrigin(req, res){
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if(origin && allowed.includes(origin)){
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}
export function bad(res, code, msg){ res.status(code).json({error: msg}); }
