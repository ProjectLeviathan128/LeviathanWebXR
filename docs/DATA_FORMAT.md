# Leviathan WebXR - Data Format Specification

## Overview

Leviathan WebXR ingests historical whale observation data and renders it as an immersive spatiotemporal visualization. This document specifies the expected data formats and processing pipeline.

## Input Formats

### JSON Format (Primary)

The primary input format is JSON, optimized for human readability and ease of data preparation.

```json
{
  "records": [
    {
      "lat": 36.62,
      "lon": -121.89,
      "depth": 45.0,
      "time": "2015-06-15T14:30:00Z",
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
    },
    "source": "Dataset source description",
    "license": "Data license"
  }
}
```

### Binary Format (Future)

For datasets exceeding 1 million records, a binary format will be supported:

```
Header (32 bytes):
  - Magic: "LWXR" (4 bytes)
  - Version: uint16
  - Record count: uint32
  - Flags: uint16
  - Reserved: 20 bytes

Record (20 bytes each):
  - lat: float32
  - lon: float32
  - depth: float32
  - time: float32 (normalized)
  - species: uint8
  - count: uint8
  - reserved: uint16
```

## Field Specifications

### Latitude (`lat`)

- **Type**: float
- **Range**: -90.0 to 90.0
- **Units**: Degrees
- **Required**: Yes

### Longitude (`lon`)

- **Type**: float
- **Range**: -180.0 to 180.0
- **Units**: Degrees
- **Required**: Yes
- **Note**: Pacific Ocean focus typically uses -180 to -100

### Depth (`depth`)

- **Type**: float
- **Range**: 0 to 11000
- **Units**: Meters below surface
- **Default**: 0 (surface)
- **Required**: No

### Time (`time`)

- **Type**: float, string, or integer
- **Formats Accepted**:
  - Normalized float [0.0, 1.0]: Direct mapping to 30-year span
  - ISO 8601 string: "2015-06-15T14:30:00Z"
  - Year integer: 2015
- **Required**: No (will be assigned random time if missing)

### Species (`species`)

- **Type**: integer
- **Range**: 0-7
- **Default**: 0
- **Required**: No

Default species mapping:
| ID | Species |
|----|---------|
| 0 | Blue Whale |
| 1 | Humpback Whale |
| 2 | Gray Whale |
| 3 | Fin Whale |
| 4 | Sperm Whale |
| 5 | Orca |
| 6 | Minke Whale |
| 7 | Right Whale |

### Count (`count`)

- **Type**: integer
- **Range**: 1 to 1000
- **Default**: 1
- **Required**: No
- **Purpose**: Number of individuals observed at this point

## Processing Pipeline

### Stage 1: Loading

```javascript
const loader = new DataLoader();
const rawData = await loader.loadJSON('data/whales.json');
```

### Stage 2: Processing

Converts raw JSON to GPU-ready TypedArrays:

```javascript
const processor = new DataProcessor(projection);
const processed = processor.process(rawData);

// Output structure:
{
  positions: Float32Array,  // [x, y, z, x, y, z, ...]
  times: Float32Array,      // Normalized [0, 1]
  species: Float32Array,    // Species IDs
  densities: Float32Array,  // Normalized observation weights
  count: number,
  meta: Object
}
```

### Stage 3: Time Indexing

Builds binary search index for efficient time-based queries:

```javascript
const chunker = new TimeChunker();
chunker.build(processed);

// Query visible range
const range = chunker.getVisibleRange(currentTime, window);
```

### Stage 4: LOD Generation

Creates multi-resolution representations:

```javascript
const aggregator = new DensityAggregator();
aggregator.process(processed);

// Get appropriate level for distance
const level = aggregator.getLevelForDistance(cameraDistance);
```

## Coordinate System

### Geographic (Input)

- Latitude: Degrees north (positive) / south (negative)
- Longitude: Degrees east (positive) / west (negative)
- Depth: Meters below surface (positive)

### World Space (Internal)

Leviathan World Coordinate System (LWCS):
- X: East (positive) / West (negative)
- Y: Up (positive) / Down/Depth (negative)
- Z: North (positive) / South (negative)

### Projection

ENU (East-North-Up) projection centered on Monterey Bay:
- Origin: 36.6°N, 121.9°W
- Scale: 1:100,000 (1 world unit = 100km)

## Performance Considerations

### Dataset Size Recommendations

| Records | Memory | Load Time | Notes |
|---------|--------|-----------|-------|
| < 100k | ~50MB | < 1s | Instant loading |
| 100k-500k | ~250MB | 1-5s | Recommended range |
| 500k-1M | ~500MB | 5-15s | Consider chunking |
| > 1M | > 500MB | > 15s | Requires chunking |

### Chunking Strategy

For large datasets, split by time:

```
chunk-1994-1999.json  (~5 years)
chunk-2000-2004.json
chunk-2005-2009.json
chunk-2010-2014.json
chunk-2015-2019.json
chunk-2020-2024.json
```

### Data Preprocessing

Pre-process data before loading:

1. Remove duplicate records
2. Validate coordinate ranges
3. Normalize time values
4. Simplify species IDs to integers
5. Aggregate nearby points if density is too high

## Validation

The DataLoader validates incoming data:

```javascript
// Required checks:
- records array exists
- each record has lat and lon
- lat in range [-90, 90]
- lon in range [-180, 180]

// Optional checks:
- depth >= 0
- time in range [0, 1] or valid date
- species in range [0, 7]
- count >= 1
```

## Example Data

Minimal valid record:
```json
{"lat": 36.6, "lon": -121.9}
```

Complete record:
```json
{
  "lat": 36.62,
  "lon": -121.89,
  "depth": 45.0,
  "time": 0.73,
  "species": 2,
  "count": 3
}
```

## Data Privacy

If working with sensitive observation data:

1. Aggregate to reduce spatial precision
2. Remove observer identification
3. Randomize exact timestamps
4. Follow data sharing agreements


