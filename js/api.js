// api.js — Rebrickable API integration & BrickLink URL construction

const API = {
  BASE_URL: 'https://rebrickable.com/api/v3',

  // ── Rebrickable API ──────────────────────────────────────────────

  async lookupSet(setNumber) {
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      throw new Error('No Rebrickable API key configured. Go to Settings to add one.');
    }

    // Rebrickable expects set numbers in format "75192-1"
    const formattedNum = setNumber.includes('-') ? setNumber : `${setNumber}-1`;

    const response = await fetch(`${this.BASE_URL}/lego/sets/${formattedNum}/?key=${apiKey}`);

    if (response.status === 404) {
      throw new Error(`Set "${setNumber}" not found on Rebrickable.`);
    }
    if (response.status === 401) {
      throw new Error('Invalid Rebrickable API key. Check your key in Settings.');
    }
    if (response.status === 429) {
      // Retry once after a delay
      await new Promise(r => setTimeout(r, 2000));
      const retry = await fetch(`${this.BASE_URL}/lego/sets/${formattedNum}/?key=${apiKey}`);
      if (retry.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      if (!retry.ok) {
        throw new Error(`Rebrickable API error: ${retry.status}`);
      }
      return this._parseSetResponse(retry, setNumber);
    }
    if (!response.ok) {
      throw new Error(`Rebrickable API error: ${response.status}`);
    }

    return this._parseSetResponse(response, setNumber);
  },

  async _parseSetResponse(response, setNumber) {
    const data = await response.json();
    return {
      setNumber: data.set_num ? data.set_num.replace(/-\d+$/, '') : setNumber,
      name: data.name || '',
      year: data.year || null,
      pieceCount: data.num_parts || null,
      imageUrl: data.set_img_url || '',
      theme: '',
      rebrickableUrl: data.set_url || '',
      themeId: data.theme_id || null,
    };
  },

  async getThemeName(themeId) {
    if (!themeId) return '';
    const apiKey = Storage.getApiKey();
    if (!apiKey) return '';

    try {
      const response = await fetch(`${this.BASE_URL}/lego/themes/${themeId}/?key=${apiKey}`);
      if (!response.ok) return '';
      const data = await response.json();
      return data.name || '';
    } catch {
      return '';
    }
  },

  async lookupSetFull(setNumber) {
    const setData = await this.lookupSet(setNumber);
    if (setData.themeId) {
      setData.theme = await this.getThemeName(setData.themeId);
    }
    return setData;
  },

  // ── Batch lookup (for CSV import) ────────────────────────────────

  async lookupSetsBatch(setNumbers, onProgress) {
    const results = [];
    for (let i = 0; i < setNumbers.length; i++) {
      try {
        const data = await this.lookupSetFull(setNumbers[i]);
        results.push({ success: true, setNumber: setNumbers[i], data });
      } catch (e) {
        results.push({ success: false, setNumber: setNumbers[i], error: e.message });
      }
      if (onProgress) onProgress(i + 1, setNumbers.length);
      // Respect rate limit: ~1 req/sec, we make 2 per set (set + theme)
      if (i < setNumbers.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    return results;
  },

  // ── BrickLink URL Construction ───────────────────────────────────

  getBrickLinkSetUrl(setNumber) {
    const num = setNumber.includes('-') ? setNumber : `${setNumber}-1`;
    return `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${num}`;
  },

  getBrickLinkPartsUrl(setNumber) {
    const num = setNumber.includes('-') ? setNumber : `${setNumber}-1`;
    return `https://www.bricklink.com/catalogItemInv.asp?S=${num}`;
  },

  getBrickLinkPriceUrl(setNumber) {
    const num = setNumber.includes('-') ? setNumber : `${setNumber}-1`;
    return `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${num}#T=P`;
  },

  getBrickLinkForSaleUrl(setNumber) {
    const num = setNumber.includes('-') ? setNumber : `${setNumber}-1`;
    return `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${num}#T=S&O={%22ii%22:0,%22loc%22:%22US%22,%22iconly%22:0}`;
  },
};
