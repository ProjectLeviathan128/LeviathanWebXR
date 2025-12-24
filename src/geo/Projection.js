/**
 * Leviathan WebXR - ENU Projection System
 * 
 * Local Tangent Plane (East-North-Up) projection for converting
 * geographic coordinates to a local Cartesian coordinate system.
 * 
 * Origin: Monterey Bay, California (36.6°N, 121.9°W)
 * 
 * This projection minimizes distortion for regional-scale visualization
 * (~1000km radius) while providing direct meter outputs.
 * 
 * COORDINATE SYSTEM (Leviathan World Coordinate System - LWCS):
 *   X → East (positive) / West (negative)
 *   Y → Up (positive) / Down/Depth (negative)
 *   Z → North (positive) / South (negative)
 */

import { PROJECTION_ORIGIN, DEG_TO_RAD, EARTH_RADIUS, WORLD_SCALE } from '../utils/Constants.js';

export class Projection {
  /**
   * Create ENU projection with specified origin
   * @param {number} originLat - Origin latitude in degrees
   * @param {number} originLon - Origin longitude in degrees
   * @param {number} scale - World scale factor (meters to world units)
   */
  constructor(
    originLat = PROJECTION_ORIGIN.lat,
    originLon = PROJECTION_ORIGIN.lon,
    scale = WORLD_SCALE
  ) {
    // Store origin in radians
    this.originLat = originLat * DEG_TO_RAD;
    this.originLon = originLon * DEG_TO_RAD;
    
    // Store origin in degrees for reference
    this.originLatDeg = originLat;
    this.originLonDeg = originLon;
    
    // World scale factor
    this.scale = scale;
    
    // Precompute trigonometric values for origin
    this.sinOriginLat = Math.sin(this.originLat);
    this.cosOriginLat = Math.cos(this.originLat);
    
    // Precompute meters per degree at origin latitude
    // More accurate than assuming spherical Earth
    this.metersPerDegLat = 111132.92 
      - 559.82 * Math.cos(2 * this.originLat) 
      + 1.175 * Math.cos(4 * this.originLat);
    
    this.metersPerDegLon = 111412.84 * Math.cos(this.originLat)
      - 93.5 * Math.cos(3 * this.originLat);
    
    console.log(`Projection initialized at (${originLat.toFixed(2)}°, ${originLon.toFixed(2)}°)`);
    console.log(`  Meters/deg lat: ${this.metersPerDegLat.toFixed(1)}`);
    console.log(`  Meters/deg lon: ${this.metersPerDegLon.toFixed(1)}`);
  }
  
  /**
   * Project geographic coordinates to local ENU (meters)
   * @param {number} lat - Latitude in degrees
   * @param {number} lon - Longitude in degrees
   * @returns {[number, number]} [eastMeters, northMeters]
   */
  projectToMeters(lat, lon) {
    const deltaLat = lat - this.originLatDeg;
    const deltaLon = lon - this.originLonDeg;
    
    // Handle longitude wrapping across antimeridian
    let adjustedDeltaLon = deltaLon;
    if (adjustedDeltaLon > 180) adjustedDeltaLon -= 360;
    if (adjustedDeltaLon < -180) adjustedDeltaLon += 360;
    
    const eastMeters = adjustedDeltaLon * this.metersPerDegLon;
    const northMeters = deltaLat * this.metersPerDegLat;
    
    return [eastMeters, northMeters];
  }
  
  /**
   * Project geographic coordinates to world space (scaled)
   * @param {number} lat - Latitude in degrees
   * @param {number} lon - Longitude in degrees
   * @param {number} depth - Depth in meters (positive = below surface)
   * @returns {[number, number, number]} [x, y, z] in world units
   */
  project(lat, lon, depth = 0) {
    const [eastMeters, northMeters] = this.projectToMeters(lat, lon);
    
    // Apply world scale and convert to LWCS
    const x = eastMeters * this.scale;   // East → +X
    const y = -depth * this.scale;        // Depth → -Y (below surface)
    const z = northMeters * this.scale;   // North → +Z
    
    return [x, y, z];
  }
  
  /**
   * Inverse projection: world space to geographic coordinates
   * @param {number} x - World X (east)
   * @param {number} y - World Y (up/down)
   * @param {number} z - World Z (north)
   * @returns {{lat: number, lon: number, depth: number}}
   */
  unproject(x, y, z) {
    // Reverse scale
    const eastMeters = x / this.scale;
    const northMeters = z / this.scale;
    const depth = -y / this.scale;
    
    // Convert to degrees
    const deltaLon = eastMeters / this.metersPerDegLon;
    const deltaLat = northMeters / this.metersPerDegLat;
    
    return {
      lat: this.originLatDeg + deltaLat,
      lon: this.originLonDeg + deltaLon,
      depth: depth
    };
  }
  
  /**
   * Project an array of records efficiently
   * @param {Array} records - Array of {lat, lon, depth} objects
   * @returns {Float32Array} Flat array of [x, y, z, x, y, z, ...]
   */
  projectBatch(records) {
    const positions = new Float32Array(records.length * 3);
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const [x, y, z] = this.project(
        record.lat,
        record.lon,
        record.depth || 0
      );
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    
    return positions;
  }
  
  /**
   * Get world-space bounds for a geographic region
   * @param {number} latMin
   * @param {number} latMax
   * @param {number} lonMin
   * @param {number} lonMax
   * @param {number} depthMax
   * @returns {{min: [number, number, number], max: [number, number, number]}}
   */
  getWorldBounds(latMin, latMax, lonMin, lonMax, depthMax = 4000) {
    const [xMin, , zMin] = this.project(latMin, lonMin, 0);
    const [xMax, , zMax] = this.project(latMax, lonMax, 0);
    const yMin = -depthMax * this.scale;
    const yMax = 0;
    
    return {
      min: [Math.min(xMin, xMax), yMin, Math.min(zMin, zMax)],
      max: [Math.max(xMin, xMax), yMax, Math.max(zMin, zMax)],
      center: [
        (xMin + xMax) / 2,
        (yMin + yMax) / 2,
        (zMin + zMax) / 2
      ],
      size: [
        Math.abs(xMax - xMin),
        Math.abs(yMax - yMin),
        Math.abs(zMax - zMin)
      ]
    };
  }
  
  /**
   * Calculate distance in meters between two world-space points
   * @param {[number, number, number]} a
   * @param {[number, number, number]} b
   * @returns {number} Distance in meters
   */
  worldDistanceToMeters(a, b) {
    const dx = (b[0] - a[0]) / this.scale;
    const dy = (b[1] - a[1]) / this.scale;
    const dz = (b[2] - a[2]) / this.scale;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Get the projection origin
   * @returns {{lat: number, lon: number}}
   */
  getOrigin() {
    return {
      lat: this.originLatDeg,
      lon: this.originLonDeg
    };
  }
  
  /**
   * Get the world scale factor
   * @returns {number}
   */
  getScale() {
    return this.scale;
  }
}


