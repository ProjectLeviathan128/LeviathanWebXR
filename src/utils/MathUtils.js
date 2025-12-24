/**
 * Leviathan WebXR - Math Utilities
 * 
 * Vector operations, interpolation, and geometric helpers.
 * Optimized for minimal garbage collection.
 */

import { DEG_TO_RAD } from './Constants.js';

// =============================================================================
// INTERPOLATION
// =============================================================================

/**
 * Linear interpolation between two values
 * @param {number} a - Start value
 * @param {number} b - End value  
 * @param {number} t - Interpolation factor [0, 1]
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Smooth interpolation with ease-in-out curve
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor [0, 1]
 * @returns {number}
 */
export function smoothLerp(a, b, t) {
  const smooth = t * t * (3 - 2 * t);
  return a + (b - a) * smooth;
}

/**
 * Exponential smoothing for continuous updates
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @param {number} smoothing - Smoothing factor (0 = instant, 1 = no change)
 * @param {number} dt - Delta time in seconds
 * @returns {number}
 */
export function expSmooth(current, target, smoothing, dt) {
  const factor = 1 - Math.pow(smoothing, dt * 60);
  return current + (target - current) * factor;
}

/**
 * Clamp value between min and max
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Remap value from one range to another
 * @param {number} value - Input value
 * @param {number} inMin - Input range minimum
 * @param {number} inMax - Input range maximum
 * @param {number} outMin - Output range minimum
 * @param {number} outMax - Output range maximum
 * @returns {number}
 */
export function remap(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

// =============================================================================
// VECTOR OPERATIONS (using arrays to avoid Three.js dependency)
// =============================================================================

/**
 * Calculate distance between two 3D points
 * @param {number[]} a - [x, y, z]
 * @param {number[]} b - [x, y, z]
 * @returns {number}
 */
export function distance3D(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate squared distance (faster, use when comparing distances)
 * @param {number[]} a - [x, y, z]
 * @param {number[]} b - [x, y, z]
 * @returns {number}
 */
export function distanceSq3D(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Normalize a 3D vector in place
 * @param {number[]} v - [x, y, z] - modified in place
 * @returns {number[]} Same array, normalized
 */
export function normalize3D(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len > 0.00001) {
    v[0] /= len;
    v[1] /= len;
    v[2] /= len;
  }
  return v;
}

/**
 * Dot product of two 3D vectors
 * @param {number[]} a - [x, y, z]
 * @param {number[]} b - [x, y, z]
 * @returns {number}
 */
export function dot3D(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// =============================================================================
// GEOMETRIC UTILITIES
// =============================================================================

/**
 * Apply dead zone to a value
 * Returns 0 if absolute value is below threshold
 * @param {number} value
 * @param {number} threshold
 * @returns {number}
 */
export function applyDeadZone(value, threshold) {
  if (Math.abs(value) < threshold) return 0;
  const sign = value > 0 ? 1 : -1;
  return (Math.abs(value) - threshold) * sign;
}

/**
 * Calculate palm openness based on finger positions
 * Uses simplified heuristic: average distance from palm center to fingertips
 * @param {Object} hand - Hand joint data
 * @returns {number} Openness value [0, 1]
 */
export function calculatePalmOpenness(hand) {
  if (!hand || !hand.joints) return 0;
  
  const palm = hand.joints['wrist'];
  const tips = [
    hand.joints['index-finger-tip'],
    hand.joints['middle-finger-tip'],
    hand.joints['ring-finger-tip'],
    hand.joints['pinky-finger-tip']
  ];
  
  if (!palm) return 0;
  
  let totalDist = 0;
  let count = 0;
  
  for (const tip of tips) {
    if (tip) {
      totalDist += distance3D(
        [palm.position.x, palm.position.y, palm.position.z],
        [tip.position.x, tip.position.y, tip.position.z]
      );
      count++;
    }
  }
  
  if (count === 0) return 0;
  
  // Normalize: ~0.15m = fully open, ~0.05m = closed
  const avgDist = totalDist / count;
  return clamp((avgDist - 0.05) / 0.1, 0, 1);
}

/**
 * Calculate pinch distance between thumb and index finger
 * @param {Object} hand - Hand joint data
 * @returns {number} Distance in meters
 */
export function calculatePinchDistance(hand) {
  if (!hand || !hand.joints) return Infinity;
  
  const thumb = hand.joints['thumb-tip'];
  const index = hand.joints['index-finger-tip'];
  
  if (!thumb || !index) return Infinity;
  
  return distance3D(
    [thumb.position.x, thumb.position.y, thumb.position.z],
    [index.position.x, index.position.y, index.position.z]
  );
}

// =============================================================================
// NUMERIC UTILITIES
// =============================================================================

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number}
 */
export function toRadians(degrees) {
  return degrees * DEG_TO_RAD;
}

/**
 * Smooth step function
 * @param {number} edge0 - Lower edge
 * @param {number} edge1 - Upper edge
 * @param {number} x - Input value
 * @returns {number} Smoothed value [0, 1]
 */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}


