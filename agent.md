# Agent Notes — LEGO Set Tracker

## Project Overview
A static web app (HTML/CSS/JS) to track a personal LEGO collection. Replaces manual spreadsheet tracking with a proper UI, Rebrickable API integration for set data, and BrickLink links for pricing and parts lists.

## Key Decisions

### API Choice: Rebrickable over BrickLink
- **BrickLink API** requires OAuth 1.0 with IP-based access tokens (you register static IPs and get tokens per IP). This makes it impractical for a static web app — you'd need a backend proxy server.
- **Rebrickable API** is free, uses a simple API key, supports CORS, and provides set metadata (name, year, theme, piece count, images).
- **Trade-off**: No inline pricing data. Instead, each set gets direct links to BrickLink's price guide page.

### Data Storage: localStorage
- Chose localStorage for simplicity — no account, no backend, works offline.
- JSON import/export provides backup and data portability between devices/browsers.
- If the user outgrows this, a future version could add Firebase/Supabase for cloud sync.

### Architecture: Static Site
- No build tools, no frameworks, no dependencies. Just vanilla HTML/CSS/JS.
- Can be opened from filesystem or hosted anywhere (GitHub Pages, Namecheap, etc.).
- Scripts are loaded in dependency order: storage → api → export → import → app.

### CSV Import with Column Mapping
- The user has an existing Google Sheet. Rather than requiring a specific format, the import UI lets the user map their spreadsheet columns to app fields interactively.
- Auto-guesses column mappings based on common header names.
- Optionally looks up missing data from Rebrickable after import.

## Conversation Summary

1. **User** wants a LEGO set tracking app similar to BrickLink's collection feature, accessible from anywhere.
2. **Requirements gathered**:
   - Track: set number, name, condition, location (bins, display), quantity, missing pieces, notes
   - BrickLink links for set pages, parts lists, price guides
   - Export to spreadsheet (CSV)
   - Import from Google Sheets
   - Auto-populate set data by number
3. **BrickLink API** explored but ruled out for static site due to IP-based token restrictions.
4. **Rebrickable API** chosen — user generated key: stored in localStorage.
5. **Conditions**: Sealed/New, Built - On Display, Back in the Box (Disassembled), No Box.
6. **Built**: Static web app with storage.js, api.js, export.js, import.js, app.js, styles.css, index.html.

## User Preferences
- Familiar with BrickLink
- Uses Windows (C:\Users\jared) and Mac (/Users/wingedyeti)
- Wants things easy to run
- Has a Namecheap account for potential hosting
- May have a GitHub account
