// storage.js — localStorage CRUD for LEGO collection data

const STORAGE_KEYS = {
  COLLECTION: 'lego_collection',
  API_KEY: 'rebrickable_api_key',
  SETTINGS: 'lego_app_settings',
};

const Storage = {
  // ── Collection CRUD ──────────────────────────────────────────────

  getCollection() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COLLECTION);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load collection:', e);
      return [];
    }
  },

  saveCollection(collection) {
    try {
      localStorage.setItem(STORAGE_KEYS.COLLECTION, JSON.stringify(collection));
      return true;
    } catch (e) {
      console.error('Failed to save collection:', e);
      if (e.name === 'QuotaExceededError') {
        alert('Storage is full. Please export your data as JSON and clear some entries.');
      }
      return false;
    }
  },

  addSet(setData) {
    const collection = this.getCollection();
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      setNumber: setData.setNumber || '',
      name: setData.name || '',
      theme: setData.theme || '',
      year: setData.year || null,
      pieceCount: setData.pieceCount || null,
      imageUrl: setData.imageUrl || '',
      status: setData.status || '',
      completeness: setData.completeness || 'Complete',
      hasBox: setData.hasBox != null ? setData.hasBox : true,
      hasInstructions: setData.hasInstructions != null ? setData.hasInstructions : true,
      location: setData.location || '',
      quantity: setData.quantity || 1,
      notes: setData.notes || '',
      dateAdded: new Date().toISOString(),
    };
    collection.push(entry);
    this.saveCollection(collection);
    return entry;
  },

  updateSet(id, updates) {
    const collection = this.getCollection();
    const index = collection.findIndex(s => s.id === id);
    if (index === -1) return null;
    collection[index] = { ...collection[index], ...updates };
    this.saveCollection(collection);
    return collection[index];
  },

  deleteSet(id) {
    const collection = this.getCollection();
    const filtered = collection.filter(s => s.id !== id);
    if (filtered.length === collection.length) return false;
    this.saveCollection(filtered);
    return true;
  },

  getSetById(id) {
    return this.getCollection().find(s => s.id === id) || null;
  },

  // ── Bulk operations ──────────────────────────────────────────────

  importSets(sets, mode = 'merge') {
    if (mode === 'replace') {
      this.saveCollection(sets);
      return sets.length;
    }
    // Merge: add sets, skip duplicates by setNumber if they already exist
    const collection = this.getCollection();
    const existingNumbers = new Set(collection.map(s => s.setNumber));
    let added = 0;
    for (const setData of sets) {
      if (!existingNumbers.has(setData.setNumber)) {
        collection.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          setNumber: setData.setNumber || '',
          name: setData.name || '',
          theme: setData.theme || '',
          year: setData.year || null,
          pieceCount: setData.pieceCount || null,
          imageUrl: setData.imageUrl || '',
          status: setData.status || '',
          completeness: setData.completeness || 'Complete',
          hasBox: setData.hasBox != null ? setData.hasBox : true,
          hasInstructions: setData.hasInstructions != null ? setData.hasInstructions : true,
          location: setData.location || '',
          quantity: setData.quantity || 1,
          notes: setData.notes || '',
          dateAdded: setData.dateAdded || new Date().toISOString(),
        });
        existingNumbers.add(setData.setNumber);
        added++;
      }
    }
    this.saveCollection(collection);
    return added;
  },

  clearCollection() {
    localStorage.removeItem(STORAGE_KEYS.COLLECTION);
  },

  // ── API Key ──────────────────────────────────────────────────────

  getApiKey() {
    return localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
  },

  setApiKey(key) {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
  },

  // ── Stats ────────────────────────────────────────────────────────

  getStats() {
    const collection = this.getCollection();
    const totalSets = collection.reduce((sum, s) => sum + (s.quantity || 1), 0);
    const totalPieces = collection.reduce((sum, s) => sum + ((s.pieceCount || 0) * (s.quantity || 1)), 0);

    const byStatus = {};
    const byLocation = {};

    for (const s of collection) {
      const st = s.status || 'Unset';
      byStatus[st] = (byStatus[st] || 0) + (s.quantity || 1);

      const loc = s.location || 'Unspecified';
      byLocation[loc] = (byLocation[loc] || 0) + (s.quantity || 1);
    }

    return {
      uniqueSets: collection.length,
      totalSets,
      totalPieces,
      byStatus,
      byLocation,
      incomplete: collection.filter(s => s.completeness === 'Incomplete').length,
      noBox: collection.filter(s => !s.hasBox).length,
    };
  },

  // ── Data migration ──────────────────────────────────────────────

  migrate() {
    const collection = this.getCollection();
    let changed = false;
    for (const s of collection) {
      // Migrate hasBox from string to boolean
      if (typeof s.hasBox === 'string') {
        s.hasBox = s.hasBox === 'Has Box';
        changed = true;
      }
      // Add hasInstructions if missing
      if (s.hasInstructions == null) {
        s.hasInstructions = true;
        changed = true;
      }
      // Default completeness if empty
      if (!s.completeness) {
        s.completeness = 'Complete';
        changed = true;
      }
      // Migrate old status names
      if (s.status === 'Built - In Storage') {
        s.status = 'In Storage';
        changed = true;
      }
      if (s.status === 'Disassembled') {
        s.status = 'In Storage';
        changed = true;
      }
      // Migrate old condition values to new status field
      if (s.condition && !s.status) {
        if (s.condition === 'New/Sealed') { s.status = 'Sealed'; s.completeness = 'Complete'; s.hasBox = true; }
        else if (s.condition === 'Complete In Box') { s.status = ''; s.completeness = 'Complete'; s.hasBox = true; }
        else if (s.condition === 'Incomplete') { s.status = ''; s.completeness = 'Incomplete'; }
        else if (s.condition === 'Built - On Display') { s.status = 'Built - On Display'; }
        delete s.condition;
        changed = true;
      }
    }
    if (changed) this.saveCollection(collection);
  },
};
