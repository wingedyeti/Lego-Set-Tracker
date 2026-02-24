// import.js — CSV and JSON import with column mapping

const Import = {
  APP_FIELDS: [
    { key: 'setNumber', label: 'Set Number', required: true },
    { key: 'name', label: 'Name' },
    { key: 'theme', label: 'Theme' },
    { key: 'year', label: 'Year' },
    { key: 'pieceCount', label: 'Pieces' },
    { key: 'status', label: 'Status' },
    { key: 'completeness', label: 'Complete?' },
    { key: 'hasBox', label: 'Has Box?' },
    { key: 'hasInstructions', label: 'Has Instructions?' },
    { key: 'location', label: 'Location' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'notes', label: 'Notes' },
  ],

  // ── CSV Parsing ──────────────────────────────────────────────────

  parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');

    const headers = this._parseCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCSVLine(lines[i]);
      if (values.some(v => v.trim())) {
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
        rows.push(row);
      }
    }
    return { headers, rows };
  },

  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  },

  // ── Column Mapping UI ────────────────────────────────────────────

  showMappingModal(headers, rows, onComplete) {
    const modal = document.getElementById('import-modal');
    const content = document.getElementById('import-mapping-content');

    // Auto-guess mappings
    const guesses = this._guessMapping(headers);

    let html = `
      <p class="import-info">Found <strong>${rows.length}</strong> rows with <strong>${headers.length}</strong> columns. Map each CSV column to a field:</p>
      <div class="mapping-grid">
    `;

    headers.forEach((header, idx) => {
      html += `
        <div class="mapping-row">
          <span class="csv-col-name" title="${header}">${header}</span>
          <span class="mapping-arrow">→</span>
          <select class="mapping-select" data-csv-col="${idx}">
            <option value="">— Skip —</option>
            ${this.APP_FIELDS.map(f =>
              `<option value="${f.key}" ${guesses[idx] === f.key ? 'selected' : ''}>${f.label}${f.required ? ' *' : ''}</option>`
            ).join('')}
          </select>
        </div>
      `;
    });

    html += `</div>
      <div class="import-options">
        <label><input type="checkbox" id="import-lookup" checked> Look up missing data from Rebrickable (slower)</label>
        <label><input type="checkbox" id="import-merge" checked> Merge with existing collection (skip duplicates)</label>
      </div>
      <div class="import-preview">
        <strong>Preview (first 3 rows):</strong>
        <div id="import-preview-table"></div>
      </div>
    `;

    content.innerHTML = html;
    this._updatePreview(headers, rows);

    // Listen for mapping changes to update preview
    content.querySelectorAll('.mapping-select').forEach(select => {
      select.addEventListener('change', () => this._updatePreview(headers, rows));
    });

    // Store callbacks for the confirm button
    modal._importData = { headers, rows, onComplete };
    modal.classList.add('active');
  },

  _guessMapping(headers) {
    const guesses = {};
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    const patterns = {
      setNumber: ['set number', 'set num', 'set #', 'set_number', 'setnumber', 'item number', 'item #', 'number', 'set no', 'set'],
      name: ['name', 'set name', 'title', 'description'],
      theme: ['theme', 'category', 'series'],
      year: ['year', 'release year', 'released'],
      pieceCount: ['pieces', 'piece count', 'parts', 'num parts', 'piece_count', 'pcs'],
      status: ['status', 'state', 'condition'],
      completeness: ['complete', 'completeness', 'complete?'],
      hasBox: ['box', 'has box', 'box?', 'has box?'],
      hasInstructions: ['instructions', 'has instructions', 'has instructions?', 'manual', 'instr'],
      location: ['location', 'storage', 'bin', 'where', 'place'],
      quantity: ['quantity', 'qty', 'count', 'amount'],
      notes: ['notes', 'note', 'comments', 'comment', 'remarks'],
    };

    lowerHeaders.forEach((header, idx) => {
      for (const [field, keywords] of Object.entries(patterns)) {
        if (keywords.includes(header) && !Object.values(guesses).includes(field)) {
          guesses[idx] = field;
          break;
        }
      }
    });

    return guesses;
  },

  _updatePreview(headers, rows) {
    const container = document.getElementById('import-preview-table');
    if (!container) return;

    const selects = document.querySelectorAll('.mapping-select');
    const mapping = {};
    selects.forEach(s => {
      if (s.value) mapping[s.dataset.csvCol] = s.value;
    });

    const previewRows = rows.slice(0, 3);
    const mappedFields = Object.values(mapping);

    if (mappedFields.length === 0) {
      container.innerHTML = '<p class="text-muted">Select at least one column mapping to see a preview.</p>';
      return;
    }

    let html = '<table class="preview-table"><thead><tr>';
    for (const field of mappedFields) {
      const f = this.APP_FIELDS.find(af => af.key === field);
      html += `<th>${f ? f.label : field}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of previewRows) {
      html += '<tr>';
      for (const [colIdx, field] of Object.entries(mapping)) {
        const header = headers[parseInt(colIdx)];
        html += `<td>${row[header] || ''}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;
  },

  // ── Execute Import ───────────────────────────────────────────────

  async executeImport() {
    const modal = document.getElementById('import-modal');
    const { headers, rows, onComplete } = modal._importData;

    const selects = document.querySelectorAll('.mapping-select');
    const mapping = {};
    selects.forEach(s => {
      if (s.value) mapping[parseInt(s.dataset.csvCol)] = s.value;
    });

    // Validate: setNumber must be mapped
    const mappedFields = Object.values(mapping);
    if (!mappedFields.includes('setNumber')) {
      alert('You must map at least one column to "Set Number".');
      return;
    }

    const doLookup = document.getElementById('import-lookup').checked;
    const doMerge = document.getElementById('import-merge').checked;

    // Convert rows using mapping
    const sets = [];
    for (const row of rows) {
      const entry = {};
      for (const [colIdx, field] of Object.entries(mapping)) {
        const header = headers[parseInt(colIdx)];
        let value = row[header] || '';

        // Type conversions
        if (field === 'year' || field === 'pieceCount' || field === 'quantity') {
          value = parseInt(value) || (field === 'quantity' ? 1 : null);
        } else if (field === 'hasBox' || field === 'hasInstructions') {
          value = ['yes', 'true', '1', 'y', 'has box', 'has instructions'].includes(value.toLowerCase());
        }
        entry[field] = value;
      }

      if (entry.setNumber) {
        // Clean set number: strip whitespace, remove trailing -1
        entry.setNumber = String(entry.setNumber).trim().replace(/-\d+$/, '');
        sets.push(entry);
      }
    }

    if (sets.length === 0) {
      alert('No valid sets found in the imported data.');
      return;
    }

    // Show progress
    const progressEl = document.getElementById('import-progress');
    if (progressEl) {
      progressEl.style.display = 'block';
      progressEl.textContent = `Importing ${sets.length} sets...`;
    }

    // Optionally look up from Rebrickable
    if (doLookup) {
      const numbersToLookup = sets
        .filter(s => !s.name || !s.theme)
        .map(s => s.setNumber);

      if (numbersToLookup.length > 0) {
        const results = await API.lookupSetsBatch(numbersToLookup, (done, total) => {
          if (progressEl) progressEl.textContent = `Looking up set ${done}/${total}...`;
        });

        for (const result of results) {
          if (result.success) {
            const set = sets.find(s => s.setNumber === result.setNumber);
            if (set) {
              if (!set.name) set.name = result.data.name;
              if (!set.theme) set.theme = result.data.theme;
              if (!set.year) set.year = result.data.year;
              if (!set.pieceCount) set.pieceCount = result.data.pieceCount;
              if (!set.imageUrl) set.imageUrl = result.data.imageUrl;
            }
          }
        }
      }
    }

    const mode = doMerge ? 'merge' : 'replace';
    const count = Storage.importSets(sets, mode);

    modal.classList.remove('active');
    if (onComplete) onComplete(count);
  },

  // ── JSON Import ──────────────────────────────────────────────────

  parseJSON(text) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data;
    if (data.sets && Array.isArray(data.sets)) return data.sets;
    throw new Error('Invalid JSON format. Expected an array of sets or { sets: [...] }.');
  },

  importJSON(text, mode = 'merge') {
    const sets = this.parseJSON(text);
    return Storage.importSets(sets, mode);
  },

  // ── File Reader Helper ───────────────────────────────────────────

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsText(file);
    });
  },
};
