# Whale Data Directory

Place your whale observation data files here.

## Expected Format

Data files should be JSON with the following structure:

```json
{
  "records": [
    {
      "lat": 36.62,
      "lon": -121.89,
      "depth": 45.0,
      "time": 0.73,
      "species": 2,
      "count": 3
    }
  ],
  "meta": {
    "timeRange": ["1994-01-01", "2024-01-01"],
    "speciesMap": {
      "0": "Blue Whale",
      "1": "Humpback Whale",
      "2": "Gray Whale",
      "3": "Fin Whale",
      "4": "Sperm Whale",
      "5": "Orca",
      "6": "Minke Whale",
      "7": "Right Whale"
    }
  }
}
```

## Field Descriptions

### Record Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `lat` | number | Yes | Latitude in degrees (-90 to 90) |
| `lon` | number | Yes | Longitude in degrees (-180 to 180) |
| `depth` | number | No | Depth in meters (0 = surface, positive = below) |
| `time` | number or string | No | Normalized time [0-1] or ISO date string |
| `species` | number | No | Species ID (0-7), defaults to 0 |
| `count` | number | No | Observation count, defaults to 1 |

### Time Field

The `time` field can be:
- **Normalized float [0-1]**: 0 = start of dataset, 1 = end
- **ISO date string**: e.g., "2015-06-15" - will be normalized automatically
- **Year number**: e.g., 2015 - will be normalized based on timeRange

### Depth Field

- 0 = surface
- Positive values = depth below surface in meters
- Typical range: 0-4000m for deep-diving species

## Chunked Loading

For large datasets, split into multiple files:

```
data/whales/
├── manifest.json
├── chunk-1994-1999.json
├── chunk-2000-2004.json
├── chunk-2005-2009.json
├── chunk-2010-2014.json
├── chunk-2015-2019.json
└── chunk-2020-2024.json
```

The manifest.json should list all chunks:

```json
{
  "chunks": [
    "chunk-1994-1999.json",
    "chunk-2000-2004.json",
    ...
  ],
  "meta": {
    "timeRange": ["1994-01-01", "2024-01-01"],
    "totalRecords": 500000
  }
}
```

## Data Sources

Recommended sources for real whale observation data:

- [Happywhale](https://happywhale.com/) - Citizen science whale sightings
- [OBIS-SEAMAP](https://seamap.env.duke.edu/) - Ocean biogeographic data
- [NOAA Fisheries](https://www.fisheries.noaa.gov/) - Official surveys
- [Cascadia Research](https://www.cascadiaresearch.org/) - West coast data


