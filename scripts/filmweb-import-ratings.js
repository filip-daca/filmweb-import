/**
 * Filmweb Import Ratings Script (updated)
 *
 * - Reads XSRF token from XSRF-TOKEN cookie and sets X-XSRF-TOKEN header
 * - Default import delay increased to 700ms
 * - If given an "import log" JSON (previous run results), it will retry only failed entries
 *
 * Usage: Paste this script in Chrome console on filmweb.pl while logged in
 */

// Configuration
const FILMWEB_VOTE_URL = 'https://www.filmweb.pl/api/v1/vote';
const IMPORT_DELAY = 700; // ms between imports to avoid rate limiting (updated)

// Helper: read cookie value by name
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Submit a rating for a movie on Filmweb
 * @param {number} filmwebId - The Filmweb film ID
 * @param {number} rating - Rating from 1-10
 * @returns {Promise<Object>} Result object with status and details
 */
async function submitRating(filmwebId, rating) {
  try {
    // Validate rating
    if (rating < 1 || rating > 10 || !Number.isInteger(rating)) {
      return {
        filmwebId,
        rating,
        status: 'error',
        error: 'Rating must be an integer between 1 and 10'
      };
    }

    const payload = {
      entity: filmwebId,
      rate: rating,
      entityName: 'film'
    };

    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Try to read XSRF token from cookie named 'XSRF-TOKEN' and add header 'X-XSRF-TOKEN'
    const xsrf = getCookie('XSRF-TOKEN');
    if (xsrf) {
      headers['X-XSRF-TOKEN'] = xsrf;
    } else {
      // Prompt fallback: allow user to paste token if cookie isn't visible (HttpOnly or absent)
      console.warn('XSRF-TOKEN cookie not found. Voting may fail due to missing CSRF token.');
      const manual = prompt('XSRF-TOKEN cookie not found or not readable.\nIf you have the token value, paste it now, otherwise leave empty to continue (may fail):');
      if (manual) {
        headers['X-XSRF-TOKEN'] = manual;
      }
    }

    // Some endpoints check Referer or Origin; include Referer to be safe
    try {
      headers['Referer'] = window.location.href;
    } catch (e) {}

    const response = await fetch(FILMWEB_VOTE_URL, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn(`API error for film ${filmwebId}: ${response.status}`);
      let errorDetail = '';
      try {
        errorDetail = await response.text();
      } catch (e) {}
      
      return {
        filmwebId,
        rating,
        status: 'error',
        error: `HTTP ${response.status}`,
        details: errorDetail
      };
    }

    const data = await response.json();
    
    return {
      filmwebId,
      rating,
      status: 'success',
      data: data
    };

  } catch (error) {
    console.error(`Error submitting rating for ${filmwebId}:`, error);
    return {
      filmwebId,
      rating,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Detect if provided array looks like a previous import log (results) or original movie data
 */
function isImportLog(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  // import log entries typically have a "status" field and may contain "error" or "data"
  return arr.every(item => typeof item === 'object' && item !== null && 'status' in item);
}

/**
 * Main import function
 */
async function importRatingsToFilmweb() {
  console.log('=== Filmweb Import Ratings ===\n');
  
  // Try to find data in window
  const windowData = window.filmwebImportResults || window.filmwebWatchlistResults || window.filmwebImportLog;
  let data;

  if (!windowData) {
    console.log('No import data found in window.');
    const jsonInput = prompt('Paste your JSON data (original movie data OR previous import log), or press Cancel to exit:');
    if (!jsonInput) {
      console.log('Import cancelled');
      return;
    }
    try {
      data = JSON.parse(jsonInput);
    } catch (error) {
      console.error('Invalid JSON:', error);
      return;
    }
  } else {
    data = windowData;
  }

  // If the provided data is an import log (previous run), pick only failed entries
  let itemsToProcess = [];
  if (isImportLog(data)) {
    console.log('Detected import log data. Will retry only failed entries (status === "error").');
    itemsToProcess = data.filter(entry => entry.status === 'error' && entry.filmwebId && entry.rating != null).map(entry => ({
      filmwebId: entry.filmwebId,
      yourRating: entry.rating || entry.yourRating || entry.rate || null,
      title: entry.title || entry.originalTitle || entry.imdbTitle,
      year: entry.year,
      imdbId: entry.imdbId
    }));
  } else if (Array.isArray(data)) {
    // Original movie data: filter as before
    itemsToProcess = data.filter(movie => 
      movie.status === 'found' && movie.filmwebId && (movie.yourRating !== null && movie.yourRating !== undefined && movie.yourRating > 0)
    ).map(movie => ({
      filmwebId: movie.filmwebId,
      yourRating: movie.yourRating,
      title: movie.originalTitle || movie.imdbTitle,
      year: movie.year,
      imdbId: movie.imdbId
    }));
  } else {
    console.error('Unsupported data format. Expected an array of movie objects.');
    return;
  }

  if (itemsToProcess.length === 0) {
    console.log('No movies to import or retry.');
    return;
  }

  console.log(`Will import/retry ${itemsToProcess.length} ratings.`);

  // Ask for confirmation showing a few entries
  const preview = itemsToProcess.slice(0, 6).map((m, idx) => `  ${idx + 1}. ${m.title || 'Unknown'} (${m.year || 'n/a'}): ${m.yourRating}/10 [${m.filmwebId}]`).join('\n');
  if (!confirm(`Ready to import ${itemsToProcess.length} ratings. First few:\n\n${preview}\n\nContinue?`)) {
    console.log('Import cancelled');
    return;
  }

  const results = [];
  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i];
    const rating = Number(item.yourRating);
    console.log(`[${i + 1}/${itemsToProcess.length}] Importing: ${item.title || item.imdbId} - ${rating}/10 (filmId: ${item.filmwebId})`);

    const res = await submitRating(item.filmwebId, rating);
    // attach context
    res.title = item.title;
    res.year = item.year;
    res.imdbId = item.imdbId;

    if (res.status === 'success') {
      console.log('  ✓ Rating submitted successfully');
    } else {
      console.log(`  ✗ Error: ${res.error}`);
    }

    results.push(res);

    if (i < itemsToProcess.length - 1) await new Promise(r => setTimeout(r, IMPORT_DELAY));
  }

  // Summary
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  console.log(`\n${'='.repeat(50)}`);
  console.log('Import Complete!');
  console.log(`  Total processed: ${results.length}`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Failed: ${failed}`);
  console.log(`${'='.repeat(50)}\n`);

  // Save into window.filmwebImportLog (append to existing log if present)
  window.filmwebImportLog = Array.isArray(window.filmwebImportLog) ? window.filmwebImportLog.concat(results) : results;
  console.log('Results saved to: window.filmwebImportLog');
  console.log('Export as JSON (copy to clipboard): copy(JSON.stringify(window.filmwebImportLog, null, 2))');

  return results;
}

// Start automatically
console.log('Starting Filmweb rating import...');
importRatingsToFilmweb();
