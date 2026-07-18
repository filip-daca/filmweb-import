/**
 * IMDB to Filmweb ID Lookup Script
 * 
 * Purpose: Takes IMDB CSV data and finds corresponding Filmweb IDs
 * Usage: Paste this script in Chrome console on filmweb.pl while logged in
 * 
 * Input: IMDB CSV with columns:
 *   Const, Your Rating, Date Rated, Title, Original Title, URL, Title Type, 
 *   IMDb Rating, Runtime (mins), Year, Genres, Num Votes, Release Date, Directors
 * 
 * Output: Array of movies with IMDB and Filmweb IDs
 */

// Configuration
const FILMWEB_API_URL = 'https://www.filmweb.pl/api/v1/live/search';
const SEARCH_DELAY = 300; // ms between requests to avoid rate limiting

// Parse CSV string to array of objects
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    // Remove quotes from values
    return {
      imdbId: values[0].replace(/"/g, ''),
      yourRating: values[1],
      dateRated: values[2],
      title: values[3].replace(/"/g, ''),
      originalTitle: values[4].replace(/"/g, ''),
      url: values[5],
      titleType: values[6],
      imdbRating: values[7],
      runtime: values[8],
      year: values[9],
      genres: values[10],
      numVotes: values[11],
      releaseDate: values[12],
      directors: values[13] ? values[13].replace(/"/g, '') : ''
    };
  }).filter(entry => entry.imdbId); // Remove empty rows
}

// Search for movie on Filmweb API using original title and year
async function searchFilmwebMovie(originalTitle, year) {
  try {
    const query = `${originalTitle} ${year}`;
    const searchParams = new URLSearchParams({
      query: query,
      pageSize: '12'
    });
    
    const response = await fetch(`${FILMWEB_API_URL}?${searchParams}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.warn(`API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.searchHits || data.searchHits.length === 0) {
      return null;
    }
    
    // Find the best match - look for exact or very close title match
    const hits = data.searchHits.filter(hit => hit.type === 'film');
    
    if (hits.length === 0) {
      return null;
    }
    
    // Get first result (should be closest match)
    const bestMatch = hits[0];
    
    return {
      filmwebId: bestMatch.id,
      filmwebUrl: `https://www.filmweb.pl/film/${bestMatch.id}`,
      matchedTitle: bestMatch.matchedTitle,
      matchedLang: bestMatch.matchedLang,
      filmMainCast: bestMatch.filmMainCast || []
    };
    
  } catch (error) {
    console.error(`Error searching for "${originalTitle} ${year}":`, error);
    return null;
  }
}

// Main function
async function importIMDBtoFilmweb() {
  console.log('=== IMDB to Filmweb Lookup ===');
  console.log('Paste your IMDB CSV data when prompted...\n');
  
  // Get CSV data from user
  const csvData = prompt('Paste your IMDB CSV data (including headers):');
  
  if (!csvData) {
    console.log('Import cancelled');
    return;
  }
  
  try {
    // Parse CSV
    const movies = parseCSV(csvData);
    console.log(`Found ${movies.length} movies to process\n`);
    
    const results = [];
    
    // Process each movie
    for (let i = 0; i < movies.length; i++) {
      const movie = movies[i];
      console.log(`[${i + 1}/${movies.length}] Searching: "${movie.originalTitle}" (${movie.year})`);
      
      // Search on Filmweb using original title and year
      const filmwebResult = await searchFilmwebMovie(movie.originalTitle, movie.year);
      
      const result = {
        imdbId: movie.imdbId,
        imdbTitle: movie.title,
        originalTitle: movie.originalTitle,
        year: movie.year,
        yourRating: parseInt(movie.yourRating),
        imdbRating: parseFloat(movie.imdbRating),
        filmwebId: filmwebResult?.filmwebId || null,
        filmwebUrl: filmwebResult?.filmwebUrl || null,
        filmwebTitle: filmwebResult?.matchedTitle || null,
        filmwebLang: filmwebResult?.matchedLang || null,
        cast: filmwebResult?.filmMainCast || [],
        status: filmwebResult ? 'found' : 'not_found'
      };
      
      results.push(result);
      
      if (filmwebResult) {
        const castList = filmwebResult.filmMainCast
          .map(actor => actor.name)
          .join(', ');
        console.log(`  ✓ Found: "${filmwebResult.matchedTitle}" (ID: ${filmwebResult.filmwebId})`);
        if (castList) {
          console.log(`    Cast: ${castList}`);
        }
      } else {
        console.log(`  ✗ Not found on Filmweb`);
      }
      
      // Delay between requests
      if (i < movies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, SEARCH_DELAY));
      }
    }
    
    // Summary
    const found = results.filter(r => r.status === 'found').length;
    const notFound = results.filter(r => r.status === 'not_found').length;
    
    console.log(`\n${'='.repeat(40)}`);
    console.log(`Summary:`);
    console.log(`  Total: ${results.length}`);
    console.log(`  Found: ${found} (${Math.round(found/results.length*100)}%)`);
    console.log(`  Not found: ${notFound}`);
    console.log(`${'='.repeat(40)}\n`);
    
    // Save results to window for access
    window.filmwebImportResults = results;
    
    console.log('Results saved to: window.filmwebImportResults');
    console.log('Export as JSON: copy(JSON.stringify(window.filmwebImportResults, null, 2))');
    console.log('\nMovies not found on Filmweb:');
    results
      .filter(r => r.status === 'not_found')
      .forEach(r => {
        console.log(`  - ${r.originalTitle} (${r.year}) [${r.imdbId}]`);
      });
    
    return results;
    
  } catch (error) {
    console.error('Error during import:', error);
  }
}

// Start the process
console.log('Starting IMDB to Filmweb import...\n');
importIMDBtoFilmweb();
