# Leviathan WebXR

**Historical Ocean Intelligence — 30 Years of Whale Presence in Immersive XR**

Leviathan WebXR is a production-grade WebXR application for visualizing historical whale observation data as an immersive, hand-tracked, headset-only experience. Stand inside a volumetric ocean, scrub through three decades of whale data with physical gestures, and viscerally perceive presence, density, recurrence, and migration patterns.

## Features

- **Immersive Spatiotemporal Visualization**: 30 years of whale data rendered as a 3D volumetric point cloud
- **Hand Tracking Only**: No controllers required — interact using natural hand gestures
- **GPU-Accelerated**: Single draw call for hundreds of thousands of data points
- **Time Scrubbing**: Move your left hand to navigate through time
- **Species Differentiation**: Color-coded whale species with density-based sizing
- **Performance Optimized**: Adaptive quality scaling for stable 72fps on Quest 2
- **Pacific Ocean Focus**: ENU projection centered on whale migration corridors

## Requirements

- **Hardware**: Meta Quest 2 (or compatible WebXR headset with hand tracking)
- **Browser**: Chromium-based browser with WebXR support (Quest Browser, Chrome)
- **Network**: Only needed for initial load (all processing happens locally)

## Quick Start

### 1. Serve the Files

```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8080
```

### 2. Access on Headset

1. Open Quest Browser on your headset
2. Navigate to `http://your-computer-ip:8080`
3. Click "Enter Leviathan"
4. Grant hand tracking permission when prompted

### 3. Interact

| Gesture | Action |
|---------|--------|
| **Left palm open + horizontal movement** | Scrub through time |
| **Right pinch** | Inspect region (aggregated data) |
| **Both palms open + hold still** | Reset time |

## Why Inspection Uses Aggregation, Not Point Queries

The inspection system displays **aggregated regional summaries** rather than individual whale sightings. This is a deliberate design decision:

### Technical Reason
- Individual point queries require O(n) CPU scans (n = dataset size)
- With 50,000+ points, this causes frame drops on Quest 2
- Aggregated grid queries are O(cells), typically checking only 10-50 cells

### Scientific Reason
- Individual points suggest false precision
- A single sighting doesn't tell you much; regional patterns matter
- Aggregation naturally communicates observation density and uncertainty
- Species histograms show community composition, not outliers

### How It Works
1. At load time, data is inserted into a 3D spatial grid (~50km cells)
2. Each cell stores: total count, species histogram, time distribution
3. On pinch, the inspection sphere queries intersecting grid cells
4. Results are aggregated and displayed as summary statistics

This approach is **Quest 2 safe** (no frame drops) and **scientifically honest** (no misleading precision).

## How Leviathan Visualizes Uncertainty

Leviathan uses visual encoding to communicate the **confidence level** of each data point. This is a critical feature for scientific integrity.

### What Uncertainty Means Here

Uncertainty visualization communicates **how much you should trust the spatial precision** of what you're seeing:

| Visual Cue | Meaning |
|------------|---------|
| **Crisp, small, bright point** | Higher confidence — more observations, lower aggregation |
| **Fuzzy, larger, muted point** | Lower confidence — single sighting, or highly aggregated |
| **Noisy, diffuse edges** | Very uncertain position — treat as "somewhere in this area" |

### What Uncertainty Does NOT Mean

- **NOT** probability of whale presence
- **NOT** species identification accuracy  
- **NOT** scientific confidence intervals
- **NOT** data quality or source reliability

We derive confidence purely from **visualization-level signals**:
1. **Observation density**: Multiple overlapping sightings = more confidence in that location
2. **LOD aggregation level**: Coarser LOD = lower spatial precision (more uncertainty)
3. **Single vs. aggregated**: A lone point is less certain than a cluster

### Why This Matters Scientifically

Traditional point visualizations imply false precision:
- A point rendered at exact coordinates suggests "a whale was precisely HERE"
- In reality, observation data has inherent uncertainty (GPS error, observer position, timing)
- Aggregated data represents areas, not points

By making uncertain data **look uncertain**, we:
- Prevent users from over-interpreting individual points
- Communicate honestly that aggregates represent regions, not exact locations
- Follow best practices for scientific visualization

### Toggle Behavior

Uncertainty visualization is **ON by default** (scientific mode). When disabled:
- All points render with uniform crispness
- Useful for demos or when visual clarity is more important than precision communication
- Does not change the underlying data or confidence values

## Project Structure

```
/LeviathanWebXR
├── index.html              # Entry point
├── style.css               # Minimal UI styling
├── src/
│   ├── main.js            # Application orchestration
│   ├── core/
│   │   ├── Scene.js       # Three.js scene setup
│   │   ├── XRSession.js   # WebXR management
│   │   ├── TimeSystem.js  # Temporal control
│   │   └── PerformanceMonitor.js
│   ├── geo/
│   │   ├── Projection.js  # ENU coordinate projection
│   │   ├── FloatingOrigin.js
│   │   ├── OceanVolume.js
│   │   └── CoastlineRenderer.js
│   ├── rendering/
│   │   ├── WhaleInstanceRenderer.js
│   │   ├── DensityAggregator.js
│   │   └── shaders/
│   ├── interaction/
│   │   ├── HandTracker.js
│   │   ├── GestureRecognizer.js
│   │   └── ...
│   └── data/
│       ├── DataLoader.js
│       ├── DataProcessor.js
│       └── SyntheticDataGenerator.js
├── data/
│   └── whales/            # Place real data here
└── docs/
    └── DATA_FORMAT.md     # Data specification
```

## Using Real Data

The application ships with synthetic data for development. To use real whale observation data:

1. Prepare your data in the expected JSON format (see `docs/DATA_FORMAT.md`)
2. Place the file in `data/whales/`
3. Modify `src/main.js` to load your data:

```javascript
// Replace this:
const rawData = SyntheticDataGenerator.generate(100000);

// With this:
const rawData = await this.dataLoader.loadJSON('data/whales/your-data.json');
```

## Technical Architecture

### Rendering Pipeline

```
Raw JSON → DataProcessor → TypedArrays → GPU Buffers → Instanced Rendering
                ↓
          TimeChunker (temporal indexing)
                ↓
          DensityAggregator (LOD levels)
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Projection | ENU (Local Tangent Plane) | Minimal distortion at Pacific regional scale |
| Rendering | InstancedBufferGeometry | Single draw call for all points |
| Time Filtering | GPU shader | No CPU iteration per frame |
| Hand Detection | WebXR Hand Input API | Native Quest support |

### Performance Targets

- **Target FPS**: 72 (Quest 2 native)
- **Max Visible Instances**: 50,000
- **Max Draw Calls**: 10
- **Quality Range**: 30% - 100% (adaptive)

## Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/LeviathanWebXR.git
cd LeviathanWebXR

# Serve with live reload (optional)
npx browser-sync start --server --files "**/*"
```

### Testing on Quest

For HTTPS requirement on Quest:
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Serve with HTTPS
npx http-server -S -C cert.pem -K key.pem
```

### Code Style

- ES6 modules throughout
- JSDoc comments on all public methods
- Inline documentation for performance-critical code
- No build step required (native ES modules)

## Data Sources

Recommended sources for real whale observation data:

- [Happywhale](https://happywhale.com/) - Citizen science whale sightings
- [OBIS-SEAMAP](https://seamap.env.duke.edu/) - Ocean biogeographic data
- [NOAA Fisheries](https://www.fisheries.noaa.gov/) - Official surveys
- [Cascadia Research](https://www.cascadiaresearch.org/) - West coast data

## Roadmap

### v1.0 (Current)
- [x] Core WebXR foundation
- [x] GPU instanced rendering
- [x] Hand tracking gestures
- [x] Time scrubbing
- [x] Pacific coastline reference
- [x] Synthetic data generator
- [x] Spatial inspection with aggregation (SpatialGrid)
- [x] Uncertainty visualization (confidence-based rendering)

### v1.1 (Planned)
- [ ] Real coastline GeoJSON loading
- [ ] Binary data format support
- [ ] Bimanual scale gestures
- [ ] Species filtering
- [ ] Seasonal animation mode

### v2.0 (Future)
- [ ] Space-Time cube view
- [ ] Risk overlay (shipping lanes)
- [ ] Acoustic data integration
- [ ] Multi-user collaboration

## License

MIT License - See LICENSE file for details.

## Acknowledgments

- Three.js for WebGL abstraction
- WebXR Hand Input API specification
- The whale research community for decades of observation data

