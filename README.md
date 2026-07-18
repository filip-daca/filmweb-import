# IMDB to Filmweb Import Scripts

A collection of JavaScript scripts that run in the Chrome console to import movie lists from IMDB CSV exports to Filmweb.pl.

## Overview

These scripts allow you to:
1. Parse IMDB CSV exports (ratings and watchlist)
2. Look up Filmweb IDs for each IMDB entry
3. Import ratings and reviews to your Filmweb account

> **Note:** Scripts require you to be logged in to filmweb.pl in your Chrome browser.

## Scripts

### 1. `imdb-ratings-to-filmweb-json.js` - IMDB Ratings to Filmweb ID Lookup

**Purpose:** Takes a CSV export of your IMDB ratings and finds the corresponding Filmweb ID for each movie.

**Input Format:**
```
Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors
tt0959337,7,2026-07-14,"Droga do szczęścia","Revolutionary Road",https://www.imdb.com/title/tt0959337,Movie,7.3,119,2008,"Drama, Romance",237294,"2009-01-30","Sam Mendes"
```

**Output:** JSON array with IMDB IDs and matched Filmweb IDs
```json
[
  {
    "imdbId": "tt0959337",
    "originalTitle": "Revolutionary Road",
    "year": 2008,
    "yourRating": 7,
    "imdbRating": 7.3,
    "filmwebId": 419862,
    "filmwebUrl": "https://www.filmweb.pl/film/419862",
    "filmwebTitle": "Revolutionary Road",
    "status": "found"
  }
]
```

**Usage:**
1. Export your IMDB ratings as CSV
2. Open Filmweb.pl in Chrome
3. Open Chrome DevTools (F12 or Cmd+Option+I on Mac)
4. Go to Console tab
5. Paste the contents of `imdb-ratings-to-filmweb-json.js`
6. When prompted, paste your CSV data

### 2. `imdb-watchlist-to-filmweb-json.js` - IMDB Watchlist to Filmweb ID Lookup

**Purpose:** Takes a CSV export of your IMDB watchlist and finds the corresponding Filmweb ID for each movie.

**Input Format:**
```
Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated
1,tt1954315,2020-11-15,2020-11-15,,"Borgman","Borgman",https://www.imdb.com/title/tt1954315/,Movie,6.7,113,2013,"Drama, Mystery, Thriller",19927,2014-02-28,"Alex van Warmerdam",,
```

**Output:** JSON array with IMDB IDs and matched Filmweb IDs
```json
[
  {
    "position": 1,
    "imdbId": "tt1954315",
    "originalTitle": "Borgman",
    "year": 2013,
    "imdbRating": 6.7,
    "yourRating": null,
    "dateAdded": "2020-11-15",
    "filmwebId": 123456,
    "filmwebUrl": "https://www.filmweb.pl/film/123456",
    "filmwebTitle": "Borgman",
    "status": "found"
  }
]
```

**Usage:**
1. Export your IMDB watchlist as CSV
2. Open Filmweb.pl in Chrome
3. Open Chrome DevTools (F12 or Cmd+Option+I on Mac)
4. Go to Console tab
5. Paste the contents of `imdb-watchlist-to-filmweb-json.js`
6. When prompted, paste your CSV data

## Requirements

- Chrome browser with console access
- Active login session on Filmweb.pl
- IMDB CSV export file (ratings or watchlist)

## How It Works

Both scripts follow the same process:

1. Parses CSV data from your IMDB export
2. Extracts IMDB IDs and movie information
3. For each movie, searches Filmweb API using original title and year
4. Matches the first (best) result returned from Filmweb
5. Generates JSON output with all data combined
6. Saves results to `window.filmwebImportResults` or `window.filmwebWatchlistResults` for easy export

## Safety

- These scripts only READ from Filmweb (no data is modified)
- They simulate user interactions (searches)
- All operations are visible in the browser
- You can review results before proceeding with imports

## Exporting Results

After a script completes, results are available in the console:

```javascript
// For ratings script
JSON.stringify(window.filmwebImportResults, null, 2)

// For watchlist script  
JSON.stringify(window.filmwebWatchlistResults, null, 2)

// Copy to clipboard (in Chrome console)
copy(JSON.stringify(window.filmwebWatchlistResults, null, 2))
```

## Future Scripts

- `imdb-import.js` - Import ratings from matched JSON to Filmweb
- `imdb-sync.js` - Sync entire watchlist including reviews

## License

MIT
