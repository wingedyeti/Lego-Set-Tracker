# Build Log — LEGO Set Tracker

## 2026-02-23

### Session 1 — Initial Build (v1.0)

**Time**: ~14:30–14:40 UTC

1. **Research & Planning**
   - Explored BrickLink API (https://www.bricklink.com/v3/api.page) — requires OAuth 1.0 with IP-based tokens, impractical for static site
   - Explored Rebrickable API (https://rebrickable.com/api/) — free, simple API key, CORS support, set metadata available
   - Decision: Use Rebrickable for set data, construct BrickLink URLs for links

2. **Project Setup**
   - Created project at `C:\Users\jared\Documents\Warp\Lego Set Sorting App`
   - Directory structure: `css/`, `js/`, root files

3. **Files Created**
   - `js/storage.js` — localStorage CRUD, stats, bulk import, API key management
   - `js/api.js` — Rebrickable API integration (set lookup, theme lookup, batch lookup), BrickLink URL construction
   - `js/export.js` — CSV export (all fields + BrickLink URLs), JSON backup export
   - `js/import.js` — CSV parser, column mapping UI with auto-guess, Rebrickable batch enrichment, JSON import
   - `css/styles.css` — Responsive design, LEGO-themed (red header), condition badges, modal system, toast notifications
   - `js/app.js` — Main controller: dashboard rendering, sortable/filterable table, add/edit/delete modals, search, import/export wiring
   - `index.html` — Full HTML structure with all modals (add/edit, settings, import mapping)
   - `README.md` — Setup instructions, feature list, hosting guide
   - `agent.md` — Build decisions and conversation summary
   - `log.md` — This file

4. **Features Implemented**
   - Add set by number with Rebrickable auto-fill
   - Edit and delete sets
   - Sortable columns (set #, name, theme, year, pieces, condition, location, qty)
   - Search by name, set number, theme, notes
   - Filter by condition and location
   - Dashboard stats (unique sets, total sets, total pieces, missing pieces count, condition breakdown)
   - BrickLink links per set (set page, parts list, price guide)
   - CSV export with all fields
   - JSON backup/restore
   - CSV import with interactive column mapping and auto-guess
   - Settings panel for Rebrickable API key
   - Responsive design for mobile
   - Toast notifications for user feedback
