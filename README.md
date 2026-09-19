# Mattle Løsningsbygger

Selvstændig webapp: `public/index.html` (hele brugerfladen) + serverfunktioner i `api/`, som holder alle tokens skjult for browseren.

## Opsætning på Vercel
1. Gå til vercel.com → *Add New… → Project* → importér GitHub-repoet `jimhoeeg/mattle`.
   Framework preset: **Other**, ingen build-kommando, Root Directory: `./` (repoets rod).
2. Tilføj miljøvariabler under *Settings → Environment Variables* (se `.env.example`):
   - `DATAFORSYNINGEN_TOKEN` – aktiverer kort og adressesøgning.
   - `RESEND_API_KEY`, `LEAD_TO_EMAIL`, `LEAD_FROM_EMAIL` – sender leads som e-mail. Afsenderdomænet skal være verificeret i Resend.
   - (valgfrit) `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` – gemmer leads i tabellen fra `supabase-leads.sql`.
3. Redeploy. `/api/config` viser, hvilke funktioner der er aktive.

Uden token viser løsningsbyggeren en pæn reserveløsning, hvor arealet angives manuelt. Uden lead-opsætning låses rapporten op lokalt uden at sende data.

## Endpoints
| Sti | Funktion | Kilde |
|---|---|---|
| `/api/config` | Hvilke funktioner er aktive | – |
| `/api/adresse?q=` | Adressesøgning (WGS84) | Dataforsyningen GSearch v2.0 |
| `/tiles/{z}/{x}/{y}` | Ortofoto forår, Web Mercator | orto_foraar_webm_DAF |
| `/api/lead` (POST) | Lead + projektresumé | Resend og/eller Supabase |

## Skråfotos

Løsningsbyggeren viser ikke selv skråfotos. Den linker i stedet til Klimadatastyrelsens
egen viser på adressens koordinater:

    https://skraafoto.dataforsyningen.dk/viewer.html?orientation=north&center=<x>,<y>

Koordinaterne er EPSG:25832, som viseren selv bruger, og som appen i forvejen regner ud
til arealberegningen.

Baggrund: at placere et punkt rigtigt i et skråfoto kræver fotogrammetri — billederne er
optaget i ca. 45 graders vinkel og er ikke ortorettede. En tidligere udgave gjorde det
selv og placerede udsnittet flere hundrede meter forkert. Fejlen lå hverken i
terrænkoten, rotationsmatricen eller udlæsningen af billedfilen; et lodret billede
ramte præcis rigtigt med samme kode, mens de skrå ikke gjorde. Frem for at vise en
fremmed ejendom til en kunde bruges kilden direkte.

## Indlejring på mattle.dk
Enklest: link fra menuen til løsningsbyggerens domæne (f.eks. `loesningsbygger.mattle.dk` via CNAME i Vercel).
Alternativt en iframe på en WordPress-side.

## Tracking
Hændelser skrives til `window.dataLayer` (Google Tag Manager) med præfikset `mattle_`. Der sendes aldrig navne, e-mails eller adresser.

## Før lancering
- Erstat eksempelpriserne (`price` i `GROUPS`/`STANDALONES`) og faktorerne i `priceDrivers()`.
- Lad Mattle godkende `KNOWLEDGE`, `TIPS` og beslutningsreglerne.
- Indsæt link til Mattles privatlivspolitik (`id="privacy-link"`).
