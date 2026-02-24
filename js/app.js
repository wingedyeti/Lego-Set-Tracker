// app.js — Main application controller

const App = {
  // ── State ─────────────────────────────────────────────────────────
  currentView: 'collection', // 'collection', 'wishlist', or a custom list ID
  sortField: 'dateAdded',
  sortDir: 'desc',
  searchQuery: '',
  filterStatus: '',
  filterCompleteness: '',
  filterLocation: '',
  editingId: null,
  selectedIds: new Set(),

  STATUSES: ['Sealed', 'Built - On Display', 'In Storage'],
  COMPLETENESS: ['Complete', 'Incomplete'],

  // ── Init ──────────────────────────────────────────────────────────

  init() {
    Storage.migrate();
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Header buttons
    document.getElementById('btn-add-set').addEventListener('click', () => this.openAddModal());
    document.getElementById('btn-settings').addEventListener('click', () => this.openSettingsModal());
    document.getElementById('btn-export-csv').addEventListener('click', () => this.exportCSV());
    document.getElementById('btn-export-json').addEventListener('click', () => this.exportJSON());
    document.getElementById('btn-import').addEventListener('click', () => this.openImportFileDialog());
    document.getElementById('btn-refresh-all').addEventListener('click', () => this.refreshAllMissing());

    // Search & filters
    document.getElementById('search-input').addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderTable();
    });
    document.getElementById('filter-status').addEventListener('change', (e) => {
      this.filterStatus = e.target.value;
      this.renderTable();
    });
    document.getElementById('filter-completeness').addEventListener('change', (e) => {
      this.filterCompleteness = e.target.value;
      this.renderTable();
    });
    document.getElementById('filter-location').addEventListener('change', (e) => {
      this.filterLocation = e.target.value;
      this.renderTable();
    });

    // Add/Edit modal
    document.getElementById('btn-lookup').addEventListener('click', () => this.lookupSet());
    document.getElementById('set-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSet();
    });

    // Settings modal
    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    // Import modal confirm
    document.getElementById('btn-import-confirm').addEventListener('click', () => {
      Import.executeImport().then(() => {
        this.render();
        this.toast('Import complete!', 'success');
      }).catch(err => {
        this.toast('Import failed: ' + err.message, 'error');
      });
    });

    // Import file input
    document.getElementById('import-file-input').addEventListener('change', (e) => this.handleImportFile(e));

    // Close modals on overlay click or close button
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-overlay').classList.remove('active');
      });
    });

    // Cancel buttons
    document.querySelectorAll('[data-dismiss="modal"]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-overlay').classList.remove('active');
      });
    });
  },

  // ── Rendering ─────────────────────────────────────────────────────

  render() {
    this.renderListBar();
    this.renderDashboard();
    this.renderFilters();
    this.renderTable();
    this.populateListDropdowns();
  },

  // ── List Bar ──────────────────────────────────────────────────────

  renderListBar() {
    const bar = document.getElementById('list-bar');
    const lists = Storage.getLists();
    const cv = this.currentView;

    let html = `<button class="list-pill ${cv === 'collection' ? 'active' : ''}" onclick="App.switchView('collection')">Collection</button>`;
    html += `<button class="list-pill ${cv === 'wishlist' ? 'active' : ''}" onclick="App.switchView('wishlist')">Wishlist</button>`;

    for (const list of lists) {
      const active = cv === list.id ? 'active' : '';
      html += `<span class="list-pill-wrap">`;
      html += `<button class="list-pill ${active}" onclick="App.switchView('${list.id}')">${this.esc(list.name)}</button>`;
      html += `<button class="list-pill-action" onclick="App.openListMenu('${list.id}', event)" title="List options">⋯</button>`;
      html += `</span>`;
    }

    html += `<button class="list-pill list-pill-add" onclick="App.createNewList()">+ New List</button>`;
    bar.innerHTML = html;
  },

  switchView(view) {
    this.currentView = view;
    this.selectedIds.clear();
    this.updateBulkBar();
    this.render();
  },

  createNewList() {
    const name = prompt('List name:');
    if (!name || !name.trim()) return;
    const list = Storage.createList(name);
    this.switchView(list.id);
    this.toast(`List "${list.name}" created!`, 'success');
  },

  openListMenu(listId, event) {
    event.stopPropagation();
    const list = Storage.getListById(listId);
    if (!list) return;
    const action = prompt(`List: ${list.name}\n\nType "rename" to rename or "delete" to delete:`);
    if (!action) return;
    if (action.toLowerCase() === 'rename') {
      const newName = prompt('New name:', list.name);
      if (newName && newName.trim()) {
        Storage.renameList(listId, newName);
        this.render();
        this.toast('List renamed!', 'success');
      }
    } else if (action.toLowerCase() === 'delete') {
      if (confirm(`Delete list "${list.name}"? (Sets won't be deleted)`)) {
        Storage.deleteList(listId);
        if (this.currentView === listId) this.currentView = 'collection';
        this.render();
        this.toast('List deleted.', 'success');
      }
    }
  },

  isWishlistView() { return this.currentView === 'wishlist'; },
  isCustomListView() { return this.currentView !== 'collection' && this.currentView !== 'wishlist'; },

  renderDashboard() {
    // Compute stats from current view's sets
    const viewSets = this._getViewSets();
    const totalSets = viewSets.reduce((sum, s) => sum + (s.quantity || 1), 0);
    const totalPieces = viewSets.reduce((sum, s) => sum + ((s.pieceCount || 0) * (s.quantity || 1)), 0);

    document.getElementById('stat-unique').textContent = viewSets.length;
    document.getElementById('stat-total').textContent = totalSets;
    document.getElementById('stat-pieces').textContent = totalPieces.toLocaleString();

    const incompleteStat = document.getElementById('stat-incomplete');
    const noboxStat = document.getElementById('stat-nobox');
    if (this.isWishlistView()) {
      incompleteStat.parentElement.style.display = 'none';
      noboxStat.parentElement.style.display = 'none';
    } else {
      incompleteStat.parentElement.style.display = '';
      noboxStat.parentElement.style.display = '';
      incompleteStat.textContent = viewSets.filter(s => s.completeness === 'Incomplete').length;
      noboxStat.textContent = viewSets.filter(s => !s.hasBox).length;
    }

    const breakdown = document.getElementById('stat-breakdown');
    if (breakdown && !this.isWishlistView()) {
      const byStatus = {};
      for (const s of viewSets) { const st = s.status || 'Unset'; byStatus[st] = (byStatus[st] || 0) + (s.quantity || 1); }
      breakdown.innerHTML = Object.entries(byStatus)
        .filter(([st]) => st !== 'Unset')
        .map(([st, count]) => `<span class="badge badge-status">${st}: ${count}</span>`)
        .join(' ');
    } else if (breakdown) {
      breakdown.innerHTML = '';
    }
  },

  /** Get the raw set array for the current view (before search/filter/sort) */
  _getViewSets() {
    const all = Storage.getCollection();
    if (this.currentView === 'collection') return all.filter(s => s.listType !== 'wishlist');
    if (this.currentView === 'wishlist') return all.filter(s => s.listType === 'wishlist');
    // Custom list
    const list = Storage.getListById(this.currentView);
    if (!list) return [];
    const idSet = new Set(list.setIds);
    return all.filter(s => idSet.has(s.id));
  },

  renderFilters() {
    const collection = Storage.getCollection();

    // Location filter
    const locations = [...new Set(collection.map(s => s.location).filter(Boolean))].sort();
    const locSelect = document.getElementById('filter-location');
    const currentLoc = locSelect.value;
    locSelect.innerHTML = '<option value="">All Locations</option>' +
      locations.map(l => `<option value="${l}" ${l === currentLoc ? 'selected' : ''}>${l}</option>`).join('');

    // Status filter
    const statusSelect = document.getElementById('filter-status');
    const currentStatus = statusSelect.value;
    statusSelect.innerHTML = '<option value="">All Statuses</option>' +
      this.STATUSES.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('');

    // Completeness filter
    const compSelect = document.getElementById('filter-completeness');
    const currentComp = compSelect.value;
    compSelect.innerHTML = '<option value="">All</option>' +
      this.COMPLETENESS.map(c => `<option value="${c}" ${c === currentComp ? 'selected' : ''}>${c}</option>`).join('');
  },

  renderTable() {
    const collection = this.getFilteredSorted();
    const tbody = document.getElementById('collection-body');
    const emptyState = document.getElementById('empty-state');

    if (collection.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      document.getElementById('result-count').textContent = '';
      return;
    }

    emptyState.style.display = 'none';
    const viewSets = this._getViewSets();
    document.getElementById('result-count').textContent =
      collection.length === viewSets.length ? `${viewSets.length} sets` : `${collection.length} of ${viewSets.length} sets`;

    const isWL = this.isWishlistView();
    const isCL = this.isCustomListView();

    // Show/hide columns based on view
    document.querySelectorAll('.col-status, .col-complete, .col-box, .col-instr').forEach(el => {
      el.style.display = isWL ? 'none' : '';
    });
    document.querySelectorAll('.col-purchased').forEach(el => {
      el.style.display = isWL ? '' : 'none';
    });

    tbody.innerHTML = collection.map(s => {
      const extraAction = isWL
        ? `<button class="btn btn-purchased btn-sm" onclick="App.purchaseSet('${s.id}')">Purchased ✓</button>`
        : isCL
          ? `<button class="btn btn-secondary btn-sm" onclick="App.removeFromList('${s.id}')">Remove</button>`
          : '';
      return `
      <tr class="${this.selectedIds.has(s.id) ? 'row-selected' : ''}">
        <td><input type="checkbox" class="row-select" data-id="${s.id}" ${this.selectedIds.has(s.id) ? 'checked' : ''} onchange="App.toggleSelect('${s.id}', this.checked)"></td>
        <td>
          ${s.imageUrl
            ? `<img src="${s.imageUrl}" alt="${this.esc(s.name)}" class="set-thumb" loading="lazy">`
            : `<button class="set-thumb-refresh" onclick="App.refreshSet('${s.id}')" title="Look up missing data">↻</button>`}
        </td>
        <td><strong>${this.esc(s.setNumber)}</strong></td>
        <td>
          <a href="${API.getBrickLinkSetUrl(s.setNumber)}" target="_blank" rel="noopener" class="set-name-link">${this.esc(s.name) || this.esc(s.setNumber)}</a>
          <br><a href="${API.getBrickLinkPartsUrl(s.setNumber)}" target="_blank" rel="noopener" class="parts-link">Parts List</a>
        </td>
        <td>${this.esc(s.theme)}</td>
        <td>${s.year || '—'}</td>
        <td>${s.pieceCount ? s.pieceCount.toLocaleString() : '—'}</td>
        <td class="col-status" ${isWL ? 'style="display:none"' : ''}>
          <select class="inline-select" onchange="App.inlineUpdate('${s.id}', 'status', this.value)">
            <option value="" ${!s.status ? 'selected' : ''}>—</option>
            ${this.STATUSES.map(st => `<option value="${st}" ${s.status === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
        </td>
        <td class="col-complete" ${isWL ? 'style="display:none"' : ''}>
          <select class="inline-select inline-sm" onchange="App.inlineUpdate('${s.id}', 'completeness', this.value)">
            <option value="" ${!s.completeness ? 'selected' : ''}>—</option>
            ${this.COMPLETENESS.map(c => `<option value="${c}" ${s.completeness === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </td>
        <td class="col-box" ${isWL ? 'style="display:none"' : ''}><input type="checkbox" class="inline-checkbox" ${s.hasBox ? 'checked' : ''} onchange="App.inlineUpdate('${s.id}', 'hasBox', this.checked)"></td>
        <td class="col-instr" ${isWL ? 'style="display:none"' : ''}><input type="checkbox" class="inline-checkbox" ${s.hasInstructions ? 'checked' : ''} onchange="App.inlineUpdate('${s.id}', 'hasInstructions', this.checked)"></td>
        <td class="col-purchased" ${isWL ? '' : 'style="display:none"'}>${isWL ? `<button class="btn btn-purchased btn-sm" onclick="App.purchaseSet('${s.id}')">Purchased ✓</button>` : ''}</td>
        <td>${this.esc(s.location) || '—'}</td>
        <td><input type="number" class="inline-input inline-qty" value="${s.quantity || 1}" min="1" onchange="App.inlineUpdate('${s.id}', 'quantity', parseInt(this.value)||1)"></td>
        <td><input type="text" class="inline-input inline-notes" value="${this.esc(s.notes || '')}" placeholder="Add notes..." onchange="App.inlineUpdate('${s.id}', 'notes', this.value)"></td>
        <td>
          <div class="links-cell">
            <a href="${API.getBrickLinkForSaleUrl(s.setNumber)}" target="_blank" rel="noopener">For Sale (US)</a>
          </div>
        </td>
        <td>
          <div class="actions-cell">
            ${extraAction}
            <button class="btn btn-secondary btn-sm" onclick="App.openEditModal('${s.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="App.confirmDelete('${s.id}')">Del</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    // Update sort arrows
    document.querySelectorAll('.collection-table th[data-sort]').forEach(th => {
      const arrow = th.querySelector('.sort-arrow');
      if (th.dataset.sort === this.sortField) {
        arrow.classList.add('active');
        arrow.textContent = this.sortDir === 'asc' ? '▲' : '▼';
      } else {
        arrow.classList.remove('active');
        arrow.textContent = '▲';
      }
    });
  },

  purchaseSet(id) {
    Storage.updateSet(id, {
      listType: 'collection',
      completeness: 'Complete',
      hasBox: true,
      hasInstructions: true,
      status: '',
    });
    this.toast('Moved to Collection!', 'success');
    this.render();
  },

  removeFromList(setId) {
    if (!this.isCustomListView()) return;
    Storage.removeSetsFromList(this.currentView, [setId]);
    this.render();
    this.toast('Removed from list.', 'success');
  },

  getFilteredSorted() {
    let collection = this._getViewSets();

    // Search — comma-separated terms are OR'd together
    if (this.searchQuery) {
      const terms = this.searchQuery.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      if (terms.length) {
        collection = collection.filter(s => {
          const hay = [
            s.setNumber, s.name, s.theme, s.notes,
          ].map(v => (v || '').toLowerCase()).join(' ');
          return terms.some(t => hay.includes(t));
        });
      }
    }

    // Filters
    if (this.filterStatus) {
      collection = collection.filter(s => s.status === this.filterStatus);
    }
    if (this.filterCompleteness) {
      collection = collection.filter(s => s.completeness === this.filterCompleteness);
    }
    if (this.filterLocation) {
      collection = collection.filter(s => s.location === this.filterLocation);
    }

    // Sort
    collection.sort((a, b) => {
      let va = a[this.sortField];
      let vb = b[this.sortField];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return this.sortDir === 'asc' ? -1 : 1;
      if (va > vb) return this.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return collection;
  },

  sortBy(field) {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
    this.renderTable();
  },

  inlineUpdate(id, field, value) {
    const updates = { [field]: value };
    // Auto-defaults: Sealed → Complete + box + instructions
    if (field === 'status' && value === 'Sealed') {
      updates.completeness = 'Complete';
      updates.hasBox = true;
      updates.hasInstructions = true;
    }
    // Auto-defaults: Complete → box + instructions
    if (field === 'completeness' && value === 'Complete') {
      updates.hasBox = true;
      updates.hasInstructions = true;
    }
    Storage.updateSet(id, updates);
    this.renderDashboard();
    this.renderFilters();
    // Re-render table if auto-defaults kicked in
    if (Object.keys(updates).length > 1) this.renderTable();
  },

  // ── Bulk Select ───────────────────────────────────────────────────

  toggleSelect(id, checked) {
    if (checked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
    this.updateBulkBar();
    // Update row highlight without full re-render
    const row = document.querySelector(`input[data-id="${id}"]`)?.closest('tr');
    if (row) row.classList.toggle('row-selected', checked);
  },

  toggleSelectAll(checked) {
    const collection = this.getFilteredSorted();
    if (checked) {
      collection.forEach(s => this.selectedIds.add(s.id));
    } else {
      this.selectedIds.clear();
    }
    document.querySelectorAll('.row-select').forEach(cb => cb.checked = checked);
    document.querySelectorAll('.collection-table tbody tr').forEach(tr => tr.classList.toggle('row-selected', checked));
    this.updateBulkBar();
  },

  updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    const count = this.selectedIds.size;
    if (count === 0) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'flex';
    document.getElementById('bulk-count').textContent = `${count} set${count > 1 ? 's' : ''} selected`;
  },

  bulkApply() {
    const status = document.getElementById('bulk-status').value;
    const comp = document.getElementById('bulk-completeness').value;
    const boxVal = document.getElementById('bulk-hasbox').value;
    const instrVal = document.getElementById('bulk-hasinstructions').value;
    const loc = document.getElementById('bulk-location').value.trim();
    const listTarget = document.getElementById('bulk-addtolist')?.value || '';
    if (!status && !comp && !boxVal && !instrVal && !loc && !listTarget) { this.toast('Select a value to apply.', 'error'); return; }
    // Add to custom list
    if (listTarget) {
      const added = Storage.addSetsToList(listTarget, [...this.selectedIds]);
      this.toast(`Added ${added} set(s) to list.`, 'success');
    }
    const updates = {};
    if (status) {
      updates.status = status;
      if (status === 'Sealed') { updates.completeness = 'Complete'; updates.hasBox = true; updates.hasInstructions = true; }
    }
    if (comp) {
      updates.completeness = comp;
      if (comp === 'Complete') { updates.hasBox = true; updates.hasInstructions = true; }
    }
    if (boxVal) updates.hasBox = boxVal === 'yes';
    if (instrVal) updates.hasInstructions = instrVal === 'yes';
    if (loc) updates.location = loc;
    for (const id of this.selectedIds) {
      Storage.updateSet(id, updates);
    }
    const fields = [status && 'status', comp && 'completeness', boxVal && 'box', instrVal && 'instructions', loc && 'location'].filter(Boolean).join(', ');
    this.toast(`Updated ${fields} on ${this.selectedIds.size} sets.`, 'success');
    this.selectedIds.clear();
    this.render();
    this.updateBulkBar();
  },

  bulkClearSelection() {
    this.selectedIds.clear();
    document.querySelectorAll('.row-select').forEach(cb => cb.checked = false);
    document.querySelectorAll('.collection-table tbody tr').forEach(tr => tr.classList.remove('row-selected'));
    document.getElementById('select-all').checked = false;
    this.updateBulkBar();
  },

  // ── Add/Edit Modal ────────────────────────────────────────────────

  openAddModal() {
    this.editingId = null;
    document.getElementById('set-modal-title').textContent = 'Add Set';
    document.getElementById('set-form').reset();
    document.getElementById('set-preview').style.display = 'none';
    document.getElementById('lookup-status').style.display = 'none';
    document.getElementById('form-quantity').value = '1';
    // Defaults for new sets
    this.populateListDropdowns();
    const addTo = document.getElementById('form-addto');
    if (addTo) {
      if (this.isWishlistView()) addTo.value = 'wishlist';
      else if (this.isCustomListView()) addTo.value = this.currentView;
      else addTo.value = 'collection';
    }
    document.getElementById('form-completeness').value = 'Complete';
    document.getElementById('form-hasbox').checked = true;
    document.getElementById('form-hasinstructions').checked = true;
    this.populateLocationDatalist();
    document.getElementById('set-modal').classList.add('active');
    document.getElementById('form-set-number').focus();
  },

  openEditModal(id) {
    const set = Storage.getSetById(id);
    if (!set) return;

    this.editingId = id;
    document.getElementById('set-modal-title').textContent = 'Edit Set';

    document.getElementById('form-set-number').value = set.setNumber;
    document.getElementById('form-name').value = set.name;
    document.getElementById('form-theme').value = set.theme;
    document.getElementById('form-year').value = set.year || '';
    document.getElementById('form-pieces').value = set.pieceCount || '';
    this.populateListDropdowns();
    const addTo = document.getElementById('form-addto');
    if (addTo) addTo.value = set.listType || 'collection';
    document.getElementById('form-status').value = set.status || '';
    document.getElementById('form-completeness').value = set.completeness || '';
    document.getElementById('form-hasbox').checked = !!set.hasBox;
    document.getElementById('form-hasinstructions').checked = !!set.hasInstructions;
    document.getElementById('form-location').value = set.location;
    document.getElementById('form-quantity').value = set.quantity || 1;
    document.getElementById('form-notes').value = set.notes;

    if (set.imageUrl) {
      document.getElementById('set-preview').style.display = 'flex';
      document.getElementById('preview-img').src = set.imageUrl;
      document.getElementById('preview-name').textContent = set.name;
      document.getElementById('preview-info').textContent = `${set.theme} | ${set.year} | ${set.pieceCount || '?'} pcs`;
    } else {
      document.getElementById('set-preview').style.display = 'none';
    }

    document.getElementById('lookup-status').style.display = 'none';
    this.populateLocationDatalist();
    document.getElementById('set-modal').classList.add('active');
  },

  // Parse set number input — splits on spaces, commas, periods, and dashes.
  // Filters out short tokens (variant suffixes like "-1") keeping only 3+ char tokens.
  parseSetNumbers(input) {
    const tokens = input.split(/[\s,.\/\-]+/).filter(t => t.length >= 3);
    return [...new Set(tokens)];
  },

  async lookupSet() {
    const raw = document.getElementById('form-set-number').value.trim();
    if (!raw) {
      this.toast('Enter a set number first.', 'error');
      return;
    }

    const numbers = this.parseSetNumbers(raw);
    const statusEl = document.getElementById('lookup-status');
    statusEl.style.display = 'block';
    statusEl.className = 'lookup-status loading';

    if (numbers.length > 1) {
      // Multi-set: just validate the count, full lookup happens on save
      statusEl.className = 'lookup-status success';
      statusEl.textContent = `${numbers.length} set numbers detected — they will be looked up when you save.`;
      document.getElementById('set-preview').style.display = 'none';
      return;
    }

    // Single set — existing lookup behavior
    const setNumber = numbers[0];
    statusEl.textContent = 'Looking up set...';

    try {
      const data = await API.lookupSetFull(setNumber);

      document.getElementById('form-name').value = data.name;
      document.getElementById('form-theme').value = data.theme;
      document.getElementById('form-year').value = data.year || '';
      document.getElementById('form-pieces').value = data.pieceCount || '';

      if (data.imageUrl) {
        document.getElementById('set-preview').style.display = 'flex';
        document.getElementById('preview-img').src = data.imageUrl;
        document.getElementById('preview-name').textContent = data.name;
        document.getElementById('preview-info').textContent = `${data.theme} | ${data.year} | ${data.pieceCount || '?'} pcs`;
      }

      // Store imageUrl in a hidden field
      document.getElementById('form-image-url').value = data.imageUrl || '';

      statusEl.className = 'lookup-status success';
      statusEl.textContent = `Found: ${data.name}`;
    } catch (err) {
      statusEl.className = 'lookup-status error';
      statusEl.textContent = err.message;
    }
  },

  async saveSet() {
    const raw = document.getElementById('form-set-number').value.trim();
    if (!raw) {
      this.toast('Set number is required.', 'error');
      return;
    }

    const numbers = this.parseSetNumbers(raw);

    // Shared properties from the form
    const sharedProps = {
      listType: document.getElementById('form-addto')?.value || 'collection',
      status: document.getElementById('form-status').value,
      completeness: document.getElementById('form-completeness').value,
      hasBox: document.getElementById('form-hasbox').checked,
      hasInstructions: document.getElementById('form-hasinstructions').checked,
      location: document.getElementById('form-location').value.trim(),
      quantity: parseInt(document.getElementById('form-quantity').value) || 1,
      notes: document.getElementById('form-notes').value.trim(),
    };

    // Determine if target is a custom list (not collection/wishlist)
    const targetList = sharedProps.listType;
    const isCustomList = targetList !== 'collection' && targetList !== 'wishlist';
    // Sets on custom lists still belong to the collection for the main view
    if (isCustomList) sharedProps.listType = 'collection';

    if (this.editingId || numbers.length === 1) {
      // Single set — use form fields directly (may have been filled by lookup)
      const setData = {
        setNumber: numbers[0] || raw,
        name: document.getElementById('form-name').value.trim(),
        theme: document.getElementById('form-theme').value.trim(),
        year: parseInt(document.getElementById('form-year').value) || null,
        pieceCount: parseInt(document.getElementById('form-pieces').value) || null,
        imageUrl: document.getElementById('form-image-url').value,
        ...sharedProps,
      };

      if (this.editingId) {
        Storage.updateSet(this.editingId, setData);
        if (isCustomList) Storage.addSetsToList(targetList, [this.editingId]);
        this.toast('Set updated!', 'success');
      } else {
        const entry = Storage.addSet(setData);
        if (isCustomList) Storage.addSetsToList(targetList, [entry.id]);
        this.toast('Set added!', 'success');
      }

      document.getElementById('set-modal').classList.remove('active');
      this.render();
      return;
    }

    // Multi-set batch add
    document.getElementById('set-modal').classList.remove('active');
    this.toast(`Adding ${numbers.length} sets...`);

    let added = 0, failed = 0;
    const newIds = [];
    for (let i = 0; i < numbers.length; i++) {
      const num = numbers[i];
      this.toast(`Looking up ${num} (${i + 1}/${numbers.length})...`);
      try {
        const data = await API.lookupSetFull(num);
        const entry = Storage.addSet({
          setNumber: data.setNumber || num,
          name: data.name || '',
          theme: data.theme || '',
          year: data.year || null,
          pieceCount: data.pieceCount || null,
          imageUrl: data.imageUrl || '',
          ...sharedProps,
        });
        newIds.push(entry.id);
        added++;
      } catch {
        // Add with just the set number if lookup fails
        const entry = Storage.addSet({ setNumber: num, name: '', theme: '', year: null, pieceCount: null, imageUrl: '', ...sharedProps });
        newIds.push(entry.id);
        added++;
        failed++;
      }
      // Rate limit
      if (i < numbers.length - 1) await new Promise(r => setTimeout(r, 1200));
    }

    if (isCustomList && newIds.length) Storage.addSetsToList(targetList, newIds);

    this.render();
    const msg = failed ? `Added ${added} sets (${failed} without API data).` : `Added ${added} sets!`;
    this.toast(msg, 'success');
  },

  confirmDelete(id) {
    const set = Storage.getSetById(id);
    if (!set) return;
    if (confirm(`Delete "${set.name || set.setNumber}"?`)) {
      Storage.deleteSet(id);
      this.render();
      this.toast('Set deleted.', 'success');
    }
  },

  async refreshSet(id) {
    const set = Storage.getSetById(id);
    if (!set) return;
    this.toast(`Looking up ${set.setNumber}...`);
    try {
      const data = await API.lookupSetFull(set.setNumber);
      const updates = {};
      if (!set.name && data.name) updates.name = data.name;
      if (!set.theme && data.theme) updates.theme = data.theme;
      if (!set.year && data.year) updates.year = data.year;
      if (!set.pieceCount && data.pieceCount) updates.pieceCount = data.pieceCount;
      if (!set.imageUrl && data.imageUrl) updates.imageUrl = data.imageUrl;
      // Also fill if currently empty but data exists
      if (data.name) updates.name = data.name;
      if (data.theme) updates.theme = data.theme;
      if (data.year) updates.year = data.year;
      if (data.pieceCount) updates.pieceCount = data.pieceCount;
      if (data.imageUrl) updates.imageUrl = data.imageUrl;
      Storage.updateSet(id, updates);
      this.render();
      this.toast(`Updated: ${data.name}`, 'success');
    } catch (err) {
      this.toast(`Failed: ${err.message}`, 'error');
    }
  },

  async refreshAllMissing() {
    const collection = Storage.getCollection();
    const missing = collection.filter(s => !s.name || !s.theme || !s.pieceCount || !s.imageUrl);
    if (missing.length === 0) {
      this.toast('All sets have complete data!', 'success');
      return;
    }
    this.toast(`Refreshing ${missing.length} sets...`);
    const numbers = missing.map(s => s.setNumber);
    const results = await API.lookupSetsBatch(numbers, (done, total) => {
      this.toast(`Looking up ${done}/${total}...`);
    });
    let updated = 0;
    for (const result of results) {
      if (result.success) {
        const set = missing.find(s => s.setNumber === result.setNumber);
        if (set) {
          Storage.updateSet(set.id, {
            name: result.data.name || set.name,
            theme: result.data.theme || set.theme,
            year: result.data.year || set.year,
            pieceCount: result.data.pieceCount || set.pieceCount,
            imageUrl: result.data.imageUrl || set.imageUrl,
          });
          updated++;
        }
      }
    }
    this.render();
    this.toast(`Updated ${updated} of ${missing.length} sets.`, 'success');
  },

  populateLocationDatalist() {
    const collection = Storage.getCollection();
    const locations = [...new Set(collection.map(s => s.location).filter(Boolean))].sort();
    const datalist = document.getElementById('location-suggestions');
    datalist.innerHTML = locations.map(l => `<option value="${l}">`).join('');
  },

  populateListDropdowns() {
    const lists = Storage.getLists();
    const listOptions = lists.map(l => `<option value="${l.id}">${this.esc(l.name)}</option>`).join('');

    // Add/Edit modal "Add to" dropdown
    const addTo = document.getElementById('form-addto');
    if (addTo) {
      addTo.innerHTML = `<option value="collection">Collection</option><option value="wishlist">Wishlist</option>` + listOptions;
    }

    // Bulk bar "Add to List" dropdown
    const bulkList = document.getElementById('bulk-addtolist');
    if (bulkList) {
      bulkList.innerHTML = `<option value="">Add to List...</option>` + listOptions;
    }
  },

  // ── Settings Modal ────────────────────────────────────────────────

  openSettingsModal() {
    document.getElementById('settings-api-key').value = Storage.getApiKey();
    document.getElementById('settings-modal').classList.add('active');
  },

  saveSettings() {
    const apiKey = document.getElementById('settings-api-key').value.trim();
    Storage.setApiKey(apiKey);
    document.getElementById('settings-modal').classList.remove('active');
    this.toast('Settings saved!', 'success');
  },

  // ── Import ────────────────────────────────────────────────────────

  openImportFileDialog() {
    document.getElementById('import-file-input').click();
  },

  async handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = ''; // Reset so same file can be re-selected

    try {
      const text = await Import.readFile(file);

      if (file.name.endsWith('.json')) {
        const count = Import.importJSON(text, 'merge');
        this.render();
        this.toast(`Imported ${count} sets from JSON.`, 'success');
      } else {
        // CSV — show mapping modal
        const { headers, rows } = Import.parseCSV(text);
        Import.showMappingModal(headers, rows, (count) => {
          this.render();
          this.toast(`Imported ${count} sets.`, 'success');
        });
      }
    } catch (err) {
      this.toast('Import error: ' + err.message, 'error');
    }
  },

  // ── Export ────────────────────────────────────────────────────────

  exportCSV() {
    const collection = this._getViewSets();
    if (collection.length === 0) {
      this.toast('Nothing to export.', 'error');
      return;
    }
    Export.downloadCSV(collection);
    this.toast('CSV exported!', 'success');
  },

  exportJSON() {
    const collection = this._getViewSets();
    if (collection.length === 0) {
      this.toast('Nothing to export.', 'error');
      return;
    }
    Export.downloadJSON(collection);
    this.toast('JSON backup exported!', 'success');
  },

  // ── Helpers ───────────────────────────────────────────────────────


  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  truncate(str, len) {
    if (!str || str.length <= len) return str;
    return str.slice(0, len) + '…';
  },

  toast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.className = 'toast';
    }, 3000);
  },
};

// ── Initialize on DOM ready ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => App.init());
