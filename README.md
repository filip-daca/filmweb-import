# IMDB to Filmweb Import Scripts

A collection of JavaScript scripts that run in the Chrome console to import movie lists from IMDB CSV exports to Filmweb.pl.

## Overview

These scripts allow you to:
1. Parse IMDB CSV exports
2. Look up Filmweb IDs for each IMDB entry
3. Import ratings and reviews to your Filmweb account

> **Note:** Scripts require you to be logged in to filmweb.pl in your Chrome browser.

## Scripts

### 1. `imdb-ratings-to-filmweb-json.js` - IMDB to Filmweb ID Lookup

**Purpose:** Takes a CSV export from IMDB and finds the corresponding Filmweb ID for each movie.

**Usage:**
1. Export your IMDB watchlist or ratings as CSV
2. Open Filmweb.pl in Chrome
3. Open Chrome DevTools (F12 or Cmd+Option+I on Mac)
4. Go to Console tab
5. Paste the contents of `imdb-ratings-to-filmweb-json.js`
6. When prompted, paste your CSV data

**Input:** IMDB CSV format
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
    "year": "2008",
    "yourRating": 7,
    "imdbRating": 7.3,
    "filmwebId": 419862,
    "filmwebUrl": "https://www.filmweb.pl/film/419862",
    "filmwebTitle": "Revolutionary Road",
    "status": "found"
  }
]
```

## Requirements

- Chrome browser with console access
- Active login session on Filmweb.pl
- IMDB CSV export file

## How It Works

1. Parses CSV data from your IMDB export
2. Extracts IMDB IDs and movie information
3. For each movie, searches Filmweb API using original title and year
4. Returns Filmweb ID for each match found
5. Generates JSON output with all data combined

## Safety

- These scripts only READ from Filmweb (no data is modified)
- They simulate user interactions (searches, clicks)
- All operations are visible in the browser
- You can review results before proceeding with imports

## Future Scripts

- `imdb-import.js` - Import ratings from IMDB to Filmweb
- `imdb-sync.js` - Sync entire watchlist including reviews

## License

MIT
