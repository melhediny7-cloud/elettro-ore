# AGENTS.md

## Project Overview

**OraLavoro Italia** is an Italian daily work hour logger and location tracker application with monthly PDF/CSV report exports and GPS geolocation detection.

## Tech Stack & Architecture

- **Framework**: TanStack Start (React 19, Vite)
- **Styling**: Tailwind CSS 4 (`@tailwindcss/vite`) with custom `@media print` rules
- **Database & Persistence**: Netlify Database (Managed Postgres) using `drizzle-orm@beta` and `@netlify/database`
- **Functions / API**: Netlify Serverless Functions in `netlify/functions/work-logs.ts` and `netlify/functions/seed.ts`
- **Charts**: Chart.js / `react-chartjs-2`

## Key File Locations

- `db/schema.ts`: Drizzle ORM database schema definition (`work_logs` table)
- `db/index.ts`: Netlify Database client setup
- `drizzle.config.ts`: Drizzle Kit configuration targeting `netlify/database/migrations`
- `netlify/functions/work-logs.ts`: API endpoint (`/api/work-logs`) handling GET, POST, PUT, DELETE operations for work logs
- `netlify/functions/seed.ts`: Initial sample data seeding endpoint (`/api/seed`)
- `src/utils/api.ts`: API client helpers with offline `localStorage` fallback
- `src/utils/italian.ts`: Italian date formatting, work types, and OpenStreetMap reverse geocoding
- `src/components/`:
  - `Header.tsx`: Navigation and Italian header bar
  - `LiveClockIn.tsx`: Realtime clock-in/clock-out panel with GPS reverse geocoding
  - `DailyLogManager.tsx`: Manual CRUD log manager with filters and search
  - `MonthlyReportView.tsx`: End-of-month printable report sheet, PDF generator, and CSV exporter
  - `SettingsView.tsx`: User metadata settings and database seed controls
- `src/routes/index.tsx`: Main application entry point orchestrating tab views

## Database Migrations

Migrations are stored in `netlify/database/migrations/`.
Generate new migrations after updating `db/schema.ts` with:
```bash
npx drizzle-kit generate --name <descriptive_name>
```

## Conventions

- Language: All UI text, badges, headers, and exports are in Italian.
- Date format: ISO strings (`YYYY-MM-DD`) internally, formatted to Italian dates (`Lunedì 6 Agosto 2026`) in the UI.
- Net Hours Calculation: `((EndMinutes - StartMinutes) - BreakMinutes) / 60`, formatted to 2 decimal places (`0.00`).
