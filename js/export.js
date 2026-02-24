// export.js — CSV and JSON export

const Export = {
  // ── CSV Export ────────────────────────────────────────────────────

  toCSV(collection) {
    const headers = [
      'Set Number', 'Name', 'Theme', 'Year', 'Pieces', 'Status',
      'Complete', 'Has Box', 'Has Instructions', 'Location', 'Quantity',
      'Notes', 'Date Added',
      'BrickLink Set URL', 'BrickLink Parts URL', 'BrickLink Price Guide URL',
    ];

    const rows = collection.map(s => [
      s.setNumber,
      s.name,
      s.theme,
      s.year || '',
      s.pieceCount || '',
      s.status || '',
      s.completeness || '',
      s.hasBox ? 'Yes' : 'No',
      s.hasInstructions ? 'Yes' : 'No',
      s.location,
      s.quantity || 1,
      s.notes,
      s.dateAdded || '',
      API.getBrickLinkSetUrl(s.setNumber),
      API.getBrickLinkPartsUrl(s.setNumber),
      API.getBrickLinkPriceUrl(s.setNumber),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  },

  downloadCSV(collection) {
    const csv = this.toCSV(collection);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = `lego_collection_${new Date().toISOString().slice(0, 10)}.csv`;
    this._download(blob, filename);
  },

  // ── JSON Export ──────────────────────────────────────────────────

  toJSON(collection) {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      version: 1,
      sets: collection,
    }, null, 2);
  },

  downloadJSON(collection) {
    const json = this.toJSON(collection);
    const blob = new Blob([json], { type: 'application/json' });
    const filename = `lego_collection_${new Date().toISOString().slice(0, 10)}.json`;
    this._download(blob, filename);
  },

  // ── Download helper ──────────────────────────────────────────────

  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
