# LEGO Set Tracker

A web-based app to track your personal LEGO collection with set details, conditions, storage locations, and BrickLink integration.

## Quick Start

1. Open `index.html` in your web browser
2. Click **Settings** and enter your Rebrickable API key
3. Click **+ Add Set** and enter a set number to start tracking

## Getting a Rebrickable API Key (Free)

1. Create a free account at [rebrickable.com/register](https://rebrickable.com/register/)
2. Log in and go to your profile settings: **Profile → Settings → API**
3. Click **Generate Key** to get your API key
4. Copy the key and paste it into the app's **Settings** panel

The API key is stored locally in your browser and never sent anywhere except Rebrickable's servers.

## Features

- **Set Lookup** — Enter a set number, click "Look Up", and the app auto-fills name, theme, year, piece count, and image from Rebrickable
- **BrickLink Links** — Each set gets direct links to its BrickLink set page, parts list, and price guide
- **Conditions** — Track sets as Sealed/New, Built - On Display, Back in the Box (Disassembled), or No Box
- **Locations** — Free-text location (e.g. "Display", "Bin 1", "Bin 2") with auto-suggestions from previous entries
- **Missing Pieces** — Flag sets with missing pieces and add notes about what's missing
- **Search & Filter** — Search by name, set number, theme, or notes; filter by condition or location
- **Sort** — Click any column header to sort ascending/descending
- **Dashboard** — See total sets, total pieces, and condition breakdowns at a glance
- **CSV Export** — Export your entire collection as a spreadsheet-compatible CSV
- **JSON Export** — Full backup of all data as JSON
- **CSV Import** — Import from a spreadsheet with interactive column mapping
- **JSON Import** — Restore from a previous JSON backup

## Data Storage

All data is stored in your browser's `localStorage`. This means:

- **Pros**: No account needed, instant, works offline, private
- **Cons**: Data is tied to the browser; clearing browser data will erase it

**Always keep a backup!** Use **Export JSON** regularly to save a backup file. You can restore it anytime with **Import**.

## Hosting

This is a static site with no backend. Options to host it:

- **Local** — Just open `index.html` in your browser
- **GitHub Pages** — Push to a GitHub repo, enable Pages in settings
- **Any web host** — Upload the files via FTP (e.g. Namecheap hosting)

## File Structure

```
├── index.html          Main page
├── css/
│   └── styles.css      Styling
├── js/
│   ├── storage.js      localStorage data management
│   ├── api.js          Rebrickable API + BrickLink URLs
│   ├── export.js       CSV/JSON export
│   ├── import.js       CSV/JSON import with column mapping
│   └── app.js          Main app controller
├── agent.md            Build notes
├── log.md              Build log
└── README.md           This file
```
