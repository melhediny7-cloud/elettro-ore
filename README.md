# OraLavoro Italia — Registro Ore e Posizione Geolocalizzata

Un'applicazione web completa, moderna e in lingua italiana per la **registrazione giornaliera delle ore di lavoro** e della **posizione geolocalizzata GPS**, con generazione e stampa della **scheda presenze e report mensile finale**.

## Caratteristiche Principali

- ⏱️ **Timbratrice Live (Clock In / Clock Out)**: Timbratura in tempo reale di inizio e fine turno con timer trascorso.
- 📍 **Geolocalizzazione GPS e Luoghi di Lavoro**: Rilevamento automatico dell'indirizzo GPS (tramite OpenStreetMap Reverse Geocoding) o selezione rapida tra sedi, cantieri, trasferte e Smart Working.
- 📅 **Registro Giornaliero Completo**: Gestione, modifica ed eliminazione manuale delle timbrature con calcolo automatico delle ore nette (al netto della pausa).
- 📊 **Pagina Report Mensile (Scheda Ore Ufficiale)**:
  - Selezione del mese e dell'anno.
  - Indicatori di sintesi: Ore Totali Mese, Giorni Lavorati, Media Giornaliera, Straordinari.
  - Grafico a barre della distribuzione giornaliera delle ore.
  - Tabella dettagliata presenze pronta per l'approvazione e le firme.
  - **Stampa / Salva in PDF**: Layout A4 ottimizzato per la stampa.
  - **Esportazione CSV / Excel**: Download del file `.csv` per l'amministrazione o i fogli di calcolo.
- 💾 **Persistenza Dati con Netlify Database (Postgres)**: Salvataggio persistente tramite `@netlify/database` e Drizzle ORM.

## Tecnologia Utilizzata

- **Framework**: TanStack Start / React 19 / Vite
- **Styling**: Tailwind CSS v4
- **Database**: Netlify Database (Managed Postgres) con Drizzle ORM
- **Icone & Grafici**: Lucide React, Chart.js / React-ChartJS-2
- **Mappe**: Browser Geolocation API & OpenStreetMap Nominatim Reverse Geocoding

## Avvio Locale

1. Installa le dipendenze:
   ```bash
   pnpm install
   ```

2. Avvia il server di sviluppo:
   ```bash
   pnpm run dev
   ```

3. Apri il browser all'indirizzo `http://localhost:3000`.
