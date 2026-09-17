import { bad } from './_util.js';
// Modtager lead + projektresumé. Gemmer i Supabase og/eller sender e-mail til Mattle via Resend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const esc = s => clip(s, 2000).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kr = n => Math.round(Number(n) || 0).toLocaleString('da-DK') + ' kr.';

export default async function handler(req, res){
  if(req.method !== 'POST') return bad(res, 405, 'method not allowed');
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const lead = body.lead || {}, project = body.project || {};
  if(!clip(lead.name, 200).trim() || !EMAIL_RE.test(clip(lead.email, 200)) || lead.consent !== true) return bad(res, 400, 'invalid lead');
  if(JSON.stringify(body).length > 60000) return bad(res, 413, 'too large');

  const record = {
    name: clip(lead.name, 200), email: clip(lead.email, 200), phone: clip(lead.phone, 50), company: clip(lead.company, 200),
    place: clip(lead.place, 200), build_year: clip(lead.year, 50), role: clip(body.role, 50), phase: clip(body.phase, 50),
    newsletter: !!lead.newsletter, consent: true, project,
  };
  const done = [];

  if(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY){
    const r = await fetch(process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/leads', {
      method: 'POST',
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(record),
    });
    if(r.ok) done.push('supabase');
  }
  if(process.env.RESEND_API_KEY && process.env.LEAD_TO_EMAIL){
    const lines = (project.lines || []).map(l => `<tr><td>${esc(l.name)}${l.variant ? ' – ' + esc(l.variant) : ''}</td><td>${esc(l.qty)} ${esc(l.unit)}</td><td>${kr(l.lo)}–${kr(l.hi)}</td></tr>`).join('');
    const facts = [...(project.facts || []), ...(project.conditions || [])].map(f => `<tr><td><b>${esc(f[0])}</b></td><td>${esc(f[1])}</td></tr>`).join('');
    const html = `<h2>Nyt lead fra Løsningsbyggeren</h2>
      <p><b>${esc(record.name)}</b>${record.company ? ', ' + esc(record.company) : ''}<br>${esc(record.email)}${record.phone ? ' · ' + esc(record.phone) : ''}<br>
      Rolle: ${esc(record.role || 'ikke angivet')} · Fase: ${esc(record.phase || 'ikke angivet')} · Anlægsår: ${esc(record.build_year || 'ikke angivet')}<br>
      Kommune/placering: ${esc(record.place || 'ikke angivet')} · Nyhedsbrev: ${record.newsletter ? 'ja' : 'nej'}</p>
      <table cellpadding="4">${facts}</table>
      <h3>Pakke</h3><table cellpadding="4">${lines}</table>
      <p><b>Samlet overslag:</b> ${kr((project.total || [])[0])}–${kr((project.total || [])[1])}</p>
      <p><b>Fagtips vist:</b> ${(project.tips || []).map(esc).join(' · ')}</p>
      ${project.link ? `<p><a href="${esc(project.link)}">Åbn kundens løsning</a></p>` : ''}`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.LEAD_FROM_EMAIL || 'Løsningsbygger <onboarding@resend.dev>', to: process.env.LEAD_TO_EMAIL.split(','),
        reply_to: record.email, subject: `Nyt lead: ${record.name}${record.company ? ' (' + record.company + ')' : ''}`, html }),
    });
    if(r.ok) done.push('resend');
  }
  if(!done.length) return bad(res, 503, 'lead delivery not configured or failed');
  res.status(200).json({ ok: true, delivered: done });
}
