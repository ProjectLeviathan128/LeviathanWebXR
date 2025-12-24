/**
 * Leviathan WebXR - Synthetic Data Generator
 * 
 * Generates realistic whale observation data for development and testing.
 * Models Pacific Ocean whale migration patterns and seasonal behavior.
 * 
 * This is NOT production data - use real datasets for deployment.
 */

import { PACIFIC_BOUNDS, TIME_RANGE, SPECIES } from '../utils/Constants.js';

export class SyntheticDataGenerator {
  /**
   * Generate synthetic whale observation data
   * @param {number} count - Number of observations to generate
   * @param {Object} options - Generation options
   * @returns {Object} Raw data in expected format
   */
  static generate(count = 50000, options = {}) {
    const {
      startYear = TIME_RANGE.startYear,
      endYear = TIME_RANGE.endYear,
      includeSeasonality = true,
      includeMigration = true
    } = options;
    
    console.log(`Generating ${count} synthetic whale observations...`);
    
    const records = [];
    const timeSpan = endYear - startYear;
    
    // Define migration corridors for different species
    const corridors = {
      // Gray whales: Alaska to Baja California migration
      2: {
        summer: { latCenter: 58, latSpread: 8, lonCenter: -160, lonSpread: 15 },
        winter: { latCenter: 25, latSpread: 5, lonCenter: -115, lonSpread: 8 }
      },
      // Humpback: Alaska to Hawaii
      1: {
        summer: { latCenter: 55, latSpread: 10, lonCenter: -145, lonSpread: 20 },
        winter: { latCenter: 20, latSpread: 3, lonCenter: -157, lonSpread: 5 }
      },
      // Blue whales: California coast year-round with seasonal movement
      0: {
        summer: { latCenter: 42, latSpread: 8, lonCenter: -128, lonSpread: 10 },
        winter: { latCenter: 30, latSpread: 6, lonCenter: -120, lonSpread: 8 }
      }
    };
    
    // Species distribution (weighted)
    const speciesWeights = [
      { species: 0, weight: 0.15 },  // Blue
      { species: 1, weight: 0.25 },  // Humpback
      { species: 2, weight: 0.30 },  // Gray
      { species: 3, weight: 0.10 },  // Fin
      { species: 4, weight: 0.08 },  // Sperm
      { species: 5, weight: 0.05 },  // Orca
      { species: 6, weight: 0.05 },  // Minke
      { species: 7, weight: 0.02 }   // Right
    ];
    
    for (let i = 0; i < count; i++) {
      // Random time
      const normalizedTime = Math.random();
      const year = startYear + normalizedTime * timeSpan;
      const month = (year % 1) * 12;
      
      // Select species based on weights
      const speciesRoll = Math.random();
      let cumWeight = 0;
      let species = 0;
      for (const { species: s, weight } of speciesWeights) {
        cumWeight += weight;
        if (speciesRoll <= cumWeight) {
          species = s;
          break;
        }
      }
      
      // Get migration parameters
      const corridor = corridors[species] || {
        summer: { latCenter: 40, latSpread: 15, lonCenter: -135, lonSpread: 20 },
        winter: { latCenter: 40, latSpread: 15, lonCenter: -135, lonSpread: 20 }
      };
      
      // Calculate seasonal position (summer = months 5-9, winter = months 11-3)
      let seasonFactor = 0.5;
      if (includeSeasonality) {
        // Smooth seasonal oscillation
        seasonFactor = (Math.sin((month / 12) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      }
      
      // Interpolate between summer and winter positions
      const params = {
        latCenter: this._lerp(corridor.winter.latCenter, corridor.summer.latCenter, seasonFactor),
        latSpread: this._lerp(corridor.winter.latSpread, corridor.summer.latSpread, seasonFactor),
        lonCenter: this._lerp(corridor.winter.lonCenter, corridor.summer.lonCenter, seasonFactor),
        lonSpread: this._lerp(corridor.winter.lonSpread, corridor.summer.lonSpread, seasonFactor)
      };
      
      // Generate position with Gaussian distribution
      const lat = this._gaussianRandom(params.latCenter, params.latSpread);
      const lon = this._gaussianRandom(params.lonCenter, params.lonSpread);
      
      // Clamp to Pacific bounds
      const clampedLat = Math.max(PACIFIC_BOUNDS.latMin, Math.min(PACIFIC_BOUNDS.latMax, lat));
      const clampedLon = Math.max(PACIFIC_BOUNDS.lonMin, Math.min(PACIFIC_BOUNDS.lonMax, lon));
      
      // Depth (species-dependent)
      const depthRanges = {
        0: [0, 200],    // Blue - surface feeders
        1: [0, 150],    // Humpback - surface
        2: [0, 100],    // Gray - shallow
        3: [0, 300],    // Fin - moderate
        4: [200, 2000], // Sperm - deep divers
        5: [0, 300],    // Orca - variable
        6: [0, 150],    // Minke - surface
        7: [0, 100]     // Right - surface
      };
      
      const [depthMin, depthMax] = depthRanges[species] || [0, 500];
      const depth = depthMin + Math.random() * (depthMax - depthMin);
      
      // Observation count (clustering effect)
      const count = Math.max(1, Math.round(this._exponentialRandom(3)));
      
      records.push({
        lat: clampedLat,
        lon: clampedLon,
        depth,
        time: normalizedTime,
        species,
        count
      });
    }
    
    console.log(`Generated ${records.length} synthetic records`);
    
    return {
      records,
      meta: {
        synthetic: true,
        timeRange: [new Date(startYear, 0, 1).toISOString(), new Date(endYear, 0, 1).toISOString()],
        speciesMap: Object.fromEntries(
          Object.entries(SPECIES).map(([id, data]) => [id, data.name])
        ),
        generatedAt: new Date().toISOString()
      }
    };
  }
  
  /**
   * Linear interpolation
   * @private
   */
  static _lerp(a, b, t) {
    return a + (b - a) * t;
  }
  
  /**
   * Gaussian random number
   * @private
   */
  static _gaussianRandom(mean, stdDev) {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }
  
  /**
   * Exponential random number
   * @private
   */
  static _exponentialRandom(lambda) {
    return -Math.log(1 - Math.random()) / lambda;
  }
  
  /**
   * Generate hotspots (high-density observation clusters)
   * @param {number} hotspotCount - Number of hotspots
   * @param {number} pointsPerHotspot - Points per hotspot
   * @returns {Object} Raw data
   */
  static generateHotspots(hotspotCount = 20, pointsPerHotspot = 1000) {
    const records = [];
    
    // Known whale hotspot locations
    const hotspotLocations = [
      { lat: 36.6, lon: -122.0, name: 'Monterey Bay' },
      { lat: 33.5, lon: -118.5, name: 'Channel Islands' },
      { lat: 21.0, lon: -157.0, name: 'Maui' },
      { lat: 58.0, lon: -136.0, name: 'Glacier Bay' },
      { lat: 48.5, lon: -123.5, name: 'Salish Sea' },
      { lat: 27.0, lon: -114.5, name: 'Baja Lagoons' },
      { lat: 42.0, lon: -125.0, name: 'Oregon Coast' },
      { lat: 60.0, lon: -148.0, name: 'Kenai Fjords' }
    ];
    
    for (let h = 0; h < hotspotCount; h++) {
      // Select base location
      const base = hotspotLocations[h % hotspotLocations.length];
      
      // Add some variation
      const centerLat = base.lat + (Math.random() - 0.5) * 5;
      const centerLon = base.lon + (Math.random() - 0.5) * 5;
      
      // Random species for this hotspot
      const species = Math.floor(Math.random() * 8);
      
      // Random time center
      const timeCenter = Math.random();
      const timeSpread = 0.05 + Math.random() * 0.1;
      
      for (let i = 0; i < pointsPerHotspot; i++) {
        records.push({
          lat: this._gaussianRandom(centerLat, 0.5),
          lon: this._gaussianRandom(centerLon, 0.5),
          depth: Math.random() * 200,
          time: Math.max(0, Math.min(1, this._gaussianRandom(timeCenter, timeSpread))),
          species,
          count: Math.ceil(Math.random() * 5)
        });
      }
    }
    
    return {
      records,
      meta: {
        synthetic: true,
        hotspots: true,
        hotspotCount,
        pointsPerHotspot
      }
    };
  }
}


