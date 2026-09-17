# Mattle Løsningsbygger

Selvstændig webapp: `public/index.html` (hele brugerfladen) + serverfunktioner i `api/`, som holder alle tokens skjult for browseren.

## Opsætning på Vercel
1. Gå til vercel.com → *Add New… → Project* → importér GitHub-repoet `jimhoeeg/mattle`.
   Framework preset: **Other**, ingen build-kommando, Root Directory: `./` (repoets rod).
2. Tilføj miljøvariabler under *Settings → Environment Variables* (se `.env.example`):
   - `DATAFORSYNINGEN_TOKEN` – aktiverer kort, adressesøgning, skråfotos og terrænhøjde.
   - `RESEND_API_KEY`, `LEAD_TO_EMAIL`, `LEAD_FROM_EMAIL` – sender leads som e-mail. Afsenderdomænet skal være verificeret i Resend.
   - (valgfrit) `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` – gemmer leads i tabellen fra `supabase-leads.sql`.
3. Redeploy. `/api/config` viser, hvilke funktioner der er aktive.

Uden token viser løsningsbyggeren en pæn reserveløsning, hvor arealet angives manuelt. Uden lead-opsætning låses rapporten op lokalt uden at sende data.

## Endpoints
| Sti | Funktion | Kilde |
|---|---|---|
| `/api/config` | Hvilke funktioner er aktive | – |
| `/api/adresse?q=` | Adressesøgning (WGS84) | Dataforsyningen GSearch v2.0 |
| `/api/skraafoto?x=&y=&direction=` | Nyeste skråfoto over punkt (EPSG:25832) | Skråfoto STAC API v2 |
| `/api/kote?x=&y=` | Terrænkote (DVR90) i punktet | Danmarks Højdemodel, `dhm_wcs_DAF` |
| `/tiles/{z}/{x}/{y}` | Ortofoto forår, Web Mercator | orto_foraar_webm_DAF |
| `/api/lead` (POST) | Lead + projektresumé | Resend og/eller Supabase |

Skråfotos læses direkte som Cloud Optimized GeoTIFF i browseren (geotiff.js). Kun det nødvendige udsnit hentes.

**Terrænhøjden er ikke valgfri.** Skråfotos er optaget i ca. 45 graders vinkel. Placerer man et
punkt i billedet ud fra kote 0 i stedet for den virkelige højde over havet, forskydes udsnittet
vandret med omtrent lige så mange meter, som terrænet ligger over havet — og i retning mod
kameraet. De fire retninger forskydes derfor hver sin vej: ligger adressen 40 m over havet,
ligger de fire udsnit 83 m fra hinanden og viser fire forskellige steder. Koten hentes fra
`dhm_wcs_DAF` med samme token som resten. Kan den ikke hentes, vises skråfotos slet ikke —
et billede af nabogrunden er værre end intet billede.

## Indlejring på mattle.dk
Enklest: link fra menuen til løsningsbyggerens domæne (f.eks. `loesningsbygger.mattle.dk` via CNAME i Vercel).
Alternativt en iframe på en WordPress-side.

## Tracking
Hændelser skrives til `window.dataLayer` (Google Tag Manager) med præfikset `mattle_`. Der sendes aldrig navne, e-mails eller adresser.

## Før lancering
- Erstat eksempelpriserne (`price` i `GROUPS`/`STANDALONES`) og faktorerne i `priceDrivers()`.
- Lad Mattle godkende `KNOWLEDGE`, `TIPS` og beslutningsreglerne.
- Indsæt link til Mattles privatlivspolitik (`id="privacy-link"`).
