/**
 * Leviathan WebXR - Shared Constants
 * 
 * Central configuration for the entire application.
 * Organized by subsystem for clarity.
 */

// =============================================================================
// GEOGRAPHIC CONSTANTS
// =============================================================================

/**
 * Pacific Ocean bounds for visualization
 * Focused on whale migration corridors from Alaska to Baja California
 */
export const PACIFIC_BOUNDS = {
  latMin: 15.0,    // Southern extent (Baja/Hawaii)
  latMax: 65.0,    // Northern extent (Alaska)
  lonMin: -180.0,  // Western extent
  lonMax: -115.0,  // Eastern extent (coast)
  depthMin: 0,     // Surface
  depthMax: 4000   // Deepest relevant depth in meters
};

/**
 * ENU Projection origin - Monterey Bay, California
 * Central to Pacific whale migration routes
 */
export const PROJECTION_ORIGIN = {
  lat: 36.6,
  lon: -121.9
};

/**
 * Scale factor: meters in world space per real-world meter
 * 1:100000 means 1 unit = 100km for manageable XR scale
 */
export const WORLD_SCALE = 0.00001; // 1 unit = 100km

// =============================================================================
// TIME CONSTANTS
// =============================================================================

/**
 * Time range represented by normalized [0, 1]
 */
export const TIME_RANGE = {
  startYear: 1994,
  endYear: 2024,
  spanYears: 30
};

/**
 * Time system defaults
 */
export const TIME_DEFAULTS = {
  initialTime: 0.5,       // Start in middle of dataset
  timeWindow: 0.033,      // ~1 year visible at once
  smoothingFactor: 0.12,  // Interpolation speed
  scrubSensitivity: 0.4   // Time units per meter of hand movement
};

// =============================================================================
// SPECIES DATA
// =============================================================================

/**
 * Whale species identifiers and display properties
 * Colors chosen for maximum distinguishability
 */
export const SPECIES = {
  0: { name: 'Blue Whale',      color: [0.2, 0.4, 0.9] },
  1: { name: 'Humpback Whale',  color: [0.3, 0.8, 0.5] },
  2: { name: 'Gray Whale',      color: [0.6, 0.6, 0.7] },
  3: { name: 'Fin Whale',       color: [0.9, 0.5, 0.2] },
  4: { name: 'Sperm Whale',     color: [0.8, 0.3, 0.6] },
  5: { name: 'Orca',            color: [0.1, 0.1, 0.1] },
  6: { name: 'Minke Whale',     color: [0.7, 0.8, 0.4] },
  7: { name: 'Right Whale',     color: [0.9, 0.2, 0.3] }
};

/**
 * Species colors as flat array for shader uniform
 */
export const SPECIES_COLORS_FLAT = Object.values(SPECIES)
  .flatMap(s => s.color);

// =============================================================================
// RENDERING CONSTANTS
// =============================================================================

/**
 * Instance rendering budgets for Quest 2 performance
 * FIX: Audit Issue - Verified draw call budget < 15
 */
export const RENDER_BUDGET = {
  maxInstances: 500000,       // Absolute maximum in buffers (unused now)
  maxVisibleInstances: 50000, // Per-frame visibility cap - ACTUAL LIMIT USED
  maxDrawCalls: 15,           // FIX: Audit Issue - Safety budget for draw calls
  maxTriangles: 500000
};

/**
 * LOD distance thresholds in world units
 */
export const LOD_DISTANCES = {
  detail: 0.5,    // Show individual points
  medium: 2.0,    // Show clustered points
  coarse: 10.0    // Show density volumes only
};

/**
 * Whale point visual properties
 */
export const WHALE_VISUAL = {
  baseSize: 0.015,
  minSize: 0.005,
  maxSize: 0.04,
  baseOpacity: 0.85
};

// =============================================================================
// OCEAN VOLUME CONSTANTS
// =============================================================================

export const OCEAN_VISUAL = {
  volumeSize: [6, 2, 4],     // Width, height (depth), length in world units
  gridDivisions: 10,
  wireframeOpacity: 0.15,
  depthMarkers: [0, 100, 500, 1000, 2000, 4000],
  colorDeep: [0.05, 0.12, 0.2],
  colorShallow: [0.1, 0.25, 0.4]
};

// =============================================================================
// GESTURE CONSTANTS
// =============================================================================

export const GESTURE = {
  // Time scrub gesture
  timeScrub: {
    deadZone: 0.015,          // Meters - ignore movement below this
    sensitivity: 0.5,         // Time change per meter
    smoothing: 0.15,
    palmOpenThreshold: 0.06   // Finger spread threshold
  },
  
  // Inspect gesture
  inspect: {
    pinchThreshold: 0.025,    // Thumb-index distance for pinch
    highlightRadius: 0.3,     // Meters around pinch point
    holdTime: 0.2             // Seconds before activation
  },
  
  // Reset gesture
  reset: {
    holdDuration: 1.5,        // Seconds both palms must be still
    movementThreshold: 0.02,  // Max movement during hold
    palmSpacing: 0.3          // Expected distance between palms
  }
};

// =============================================================================
// PERFORMANCE CONSTANTS
// =============================================================================

export const PERFORMANCE = {
  targetFPS: 72,
  minQuality: 0.3,
  maxQuality: 1.0,
  qualityStep: 0.05,
  sampleWindow: 30  // Frames to average for FPS calculation
};

// =============================================================================
// MATH CONSTANTS
// =============================================================================

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
export const EARTH_RADIUS = 6378137; // WGS84 equatorial radius in meters

