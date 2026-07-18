/**
 * Filmweb Import Watchlist Script (fixed isImportLog detection)
 *
 * Purpose: Takes JSON output from imdb-ratings-to-filmweb-json.js or 
 *          imdb-watchlist-to-filmweb-json.js (or a previous import log) and
 *          adds movies to the user's Filmweb "want to see" list.
 *
 * Usage: Paste this script in Chrome console on filmweb.pl while logged in
 *
 * Input: JSON array with filmwebId (from previous lookup scripts) or a previous
 *        import log array (will retry only failed entries)
 *
 * API: POST https://www.filmweb.pl/api/v1/want2see
 * Payload: { entity: <filmwebId>, level: 3, entityName: 'film' }
 */

// Configuration
const FILMWEB_WANT2SEE_URL = 'https://www.filmweb.pl/api/v1/want2see';
const IMPORT_DELAY = 700; // ms between requests
const WANT2SEE_LEVEL = 3; // default desired level

// Helper: read cookie value by name
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Safely parse response body (handles empty bodies and non-json)
 */
async function safeParseResponse(response) {
  if (!response) return null;
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch (e) {
        // fallback to text
        try {
          const text = await response.text();
          return text && text.length > 0 ? text : null;
        } catch (e2) {
          return null;
        }
      }
    } else {
      try {
        const text = await response.text();
        return text && text.length > 0 ? text : null;
      } catch (e) {
        return null;
      }
    }
  } catch (e) {
    return null;
  }
}

/**
 * Submit a want2see request to Filmweb for a film
 */
async function submitWant2See(filmwebId, level = WANT2SEE_LEVEL) {
  try {
    const payload = {
      entity: filmwebId,
      level: level,
      entityName: 'film'
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // XSRF token handling
    const xsrf = getCookie('XSRF-TOKEN');
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf;
    else {
      // fallback prompt if cookie not readable
      const manual = prompt('XSRF-TOKEN cookie not found.\nIf you have the token value, paste it now, otherwise leave empty to continue (may fail):');
      if (manual) headers['X-XSRF-TOKEN'] = manual;
    }

    try { headers['Referer'] = window.location.href; } catch (e) {}

    const response = await fetch(FILMWEB_WANT2SEE_URL, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let details = '';
      try { details = await response.text(); } catch (e) {}
      return { filmwebId, level, status: 'error', error: `HTTP ${response.status}`, details };
    }

    const data = await safeParseResponse(response);
    return { filmwebId, level, status: 'success', data };

  } catch (error) {
    return { filmwebId, level, status: 'error', error: error.message };
  }
}

/**
 * Improved detection for import-log vs original lookup results.
 *
 * Original lookup results (from imdb-*-to-filmweb-json.js) include fields like:
 *   filmwebId, originalTitle/imdbTitle, yourRating, year, status: 'found'
 *
 * Import logs (previous run) include fields like:
 *   status ("success"/"error"), error, data, rating/level, etc.
 *
 * To avoid misclassifying original results (which also have a `status` field),
 * we require import-log entries to have `status` AND at least one of
 * the typical log-specific fields: rating, rate, level, error, data, details.
 */
function isImportLog(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.every(item => {
    if (typeof item !== 'object' || item === null || !('status' in item)) return false;
    const hasLogField = ('rating' in item) || ('rate' in item) || ('level' in item) || ('error' in item) || ('data' in item) || ('details' in item);
    return Boolean(hasLogField);
  });
}

async function importWatchlistToFilmweb() {
  console.log('=== Filmweb Import Watchlist ===\n');

  const windowData = window.filmwebImportResults || window.filmwebWatchlistResults || window.filmwebImportLog;
  let data;

  if (!windowData) {
    const jsonInput = prompt('Paste your JSON data (original movie data OR previous import log), or press Cancel to exit:');
    if (!jsonInput) { console.log('Import cancelled'); return; }
    try { data = JSON.parse(jsonInput); } catch (e) { console.error('Invalid JSON:', e); return; }
  } else {
    data = windowData;
  }

  let itemsToProcess = [];
  if (isImportLog(data)) {
    console.log('Detected import log data. Will retry only failed entries (status === "error").');
    itemsToProcess = data.filter(entry => entry.status === 'error' && entry.filmwebId).map(entry => ({
      filmwebId: entry.filmwebId,
      level: entry.level || WANT2SEE_LEVEL,
      title: entry.title || entry.originalTitle || entry.imdbTitle,
      year: entry.year,
      imdbId: entry.imdbId
    }));
  } else if (Array.isArray(data)) {
    itemsToProcess = data.filter(movie => movie.status === 'found' && movie.filmwebId).map(movie => ({
      filmwebId: movie.filmwebId,
      level: WANT2SEE_LEVEL,
      title: movie.originalTitle || movie.imdbTitle,
      year: movie.year,
      imdbId: movie.imdbId
    }));
  } else {
    console.error('Unsupported data format. Expected an array of movie objects.');
    return;
  }

  if (itemsToProcess.length === 0) { console.log('No movies to add to watchlist.'); return; }

  console.log(`Will add ${itemsToProcess.length} movies to your Filmweb "want to see" list.`);
  const preview = itemsToProcess.slice(0, 6).map((m, i) => `  ${i+1}. ${m.title || 'Unknown'} (${m.year || 'n/a'}) [${m.filmwebId}]`).join('\n');
  if (!confirm(`Ready to add ${itemsToProcess.length} movies to watchlist. First few:\n\n${preview}\n\nContinue?`)) { console.log('Import cancelled'); return; }

  const results = [];
  for (let i = 0; i < itemsToProcess.length; i++) {
    const it = itemsToProcess[i];
    console.log(`[${i+1}/${itemsToProcess.length}] Adding: ${it.title || it.imdbId} (filmId: ${it.filmwebId})`);
    const res = await submitWant2See(it.filmwebId, it.level);
    res.title = it.title; res.year = it.year; res.imdbId = it.imdbId; 

    if (res.status === 'success') console.log('  ✓ Added to watchlist'); else console.log(`  ✗ Error: ${res.error || res.details || ''}`);
    results.push(res);

    if (i < itemsToProcess.length - 1) await new Promise(r => setTimeout(r, IMPORT_DELAY));
  }

  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  console.log(`\n${'='.repeat(50)}`);
  console.log('Import Complete!');
  console.log(`  Total processed: ${results.length}`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Failed: ${failed}`);
  console.log(`${'='.repeat(50)}\n`);

  // Save results to window.filmwebWatchlistLog (append if present)
  window.filmwebWatchlistLog = Array.isArray(window.filmwebWatchlistLog) ? window.filmwebWatchlistLog.concat(results) : results;
  console.log('Results saved to: window.filmwebWatchlistLog');
  console.log('Export as JSON (copy to clipboard): copy(JSON.stringify(window.filmwebWatchlistLog, null, 2))');

  return results;
}

// Run automatically
console.log('Starting Filmweb watchlist import...');
importWatchlistToFilmweb();
