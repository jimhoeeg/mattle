export default function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    maps: !!process.env.DATAFORSYNINGEN_TOKEN,
    leads: !!((process.env.RESEND_API_KEY && process.env.LEAD_TO_EMAIL) || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)),
  });
}
