/**
 * Leviathan WebXR - Density Aggregator
 * 
 * Creates multiple LOD (Level of Detail) representations of whale data.
 * At large scales, individual points are aggregated into density clusters.
 * 
 * LOD Levels:
 * - Fine: Individual points (for close inspection)
 * - Medium: Clustered by small cells
 * - Coarse: Density volumes for overview
 */

import { LOD_DISTANCES } from '../utils/Constants.js';

export class DensityAggregator {
  /**
   * Create density aggregator
   * @param {Object} options - Aggregation options
   */
  constructor(options = {}) {
    // Cell sizes for each LOD level (in world units)
    this.cellSizes = options.cellSizes || {
      fine: 0.01,    // ~1km cells
      medium: 0.05,  // ~5km cells
      coarse: 0.2    // ~20km cells
    };
    
    // LOD data
    this.levels = {
      fine: null,
      medium: null,
      coarse: null
    };
    
    // Original data reference
    this.sourceData = null;
  }
  
  /**
   * Process raw data into LOD levels
   * UNCERTAINTY: Each LOD level now includes lodLevel for confidence calculation
   * @param {Object} processedData - From DataProcessor
   */
  process(processedData) {
    this.sourceData = processedData;
    
    // Fine level is just the original data
    // UNCERTAINTY: lodLevel 0 = full detail, highest spatial confidence
    this.levels.fine = { ...processedData, lodLevel: 0 };
    
    // Build aggregated levels
    // UNCERTAINTY: lodLevel 1 = medium aggregation, reduced spatial confidence
    this.levels.medium = this._aggregateLevel(processedData, this.cellSizes.medium, 1);
    // UNCERTAINTY: lodLevel 2 = coarse aggregation, lowest spatial confidence
    this.levels.coarse = this._aggregateLevel(processedData, this.cellSizes.coarse, 2);
    
    console.log('UNCERTAINTY: Density aggregation complete with LOD levels:');
    console.log(`  Fine (LOD 0): ${this.levels.fine.count} points`);
    console.log(`  Medium (LOD 1): ${this.levels.medium.count} clusters`);
    console.log(`  Coarse (LOD 2): ${this.levels.coarse.count} cells`);
  }
  
  /**
   * Aggregate data into cells of given size
   * UNCERTAINTY: Now includes lodLevel for confidence calculation
   * @private
   * @param {Object} data - Source data
   * @param {number} cellSize - Cell size in world units
   * @param {number} lodLevel - LOD level (0=fine, 1=medium, 2=coarse)
   * @returns {Object} Aggregated data with lodLevel
   */
  _aggregateLevel(data, cellSize, lodLevel = 0) {
    const { positions, times, species, densities, count } = data;
    
    // Use spatial hashing for efficient aggregation
    const cells = new Map();
    
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const t = times[i];
      const s = species[i];
      const d = densities ? densities[i] : 1;
      
      // Create spatial-temporal cell key
      // Include time bucket for temporal grouping (by ~1 year)
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      const cellZ = Math.floor(z / cellSize);
      const cellT = Math.floor(t * 30); // 30 time buckets (1 per year)
      
      const key = `${cellX},${cellY},${cellZ},${cellT}`;
      
      if (!cells.has(key)) {
        cells.set(key, {
          sumX: 0, sumY: 0, sumZ: 0,
          sumT: 0, sumD: 0,
          count: 0,
          speciesCounts: new Uint32Array(8)
        });
      }
      
      const cell = cells.get(key);
      cell.sumX += x;
      cell.sumY += y;
      cell.sumZ += z;
      cell.sumT += t;
      cell.sumD += d;
      cell.count++;
      cell.speciesCounts[s]++;
    }
    
    // Convert cells to arrays
    const cellCount = cells.size;
    const outPositions = new Float32Array(cellCount * 3);
    const outTimes = new Float32Array(cellCount);
    const outSpecies = new Float32Array(cellCount);
    const outDensities = new Float32Array(cellCount);
    
    let i = 0;
    for (const cell of cells.values()) {
      // Average position
      outPositions[i * 3] = cell.sumX / cell.count;
      outPositions[i * 3 + 1] = cell.sumY / cell.count;
      outPositions[i * 3 + 2] = cell.sumZ / cell.count;
      
      // Average time
      outTimes[i] = cell.sumT / cell.count;
      
      // Dominant species
      let maxSpecies = 0;
      let maxCount = 0;
      for (let s = 0; s < 8; s++) {
        if (cell.speciesCounts[s] > maxCount) {
          maxCount = cell.speciesCounts[s];
          maxSpecies = s;
        }
      }
      outSpecies[i] = maxSpecies;
      
      // Density is normalized count
      // Log scale works well for large count ranges
      outDensities[i] = Math.min(1.0, Math.log10(cell.count + 1) / 3);
      
      i++;
    }
    
    return {
      positions: outPositions,
      times: outTimes,
      species: outSpecies,
      densities: outDensities,
      count: cellCount,
      lodLevel // UNCERTAINTY: Include LOD level for confidence calculation
    };
  }
  
  /**
   * Get appropriate LOD level based on camera distance
   * @param {number} distance - Distance from camera to data centroid
   * @returns {Object} LOD level data
   */
  getLevelForDistance(distance) {
    if (distance < LOD_DISTANCES.detail) {
      return this.levels.fine;
    } else if (distance < LOD_DISTANCES.medium) {
      return this.levels.medium;
    } else {
      return this.levels.coarse;
    }
  }
  
  /**
   * Get a specific LOD level
   * @param {'fine'|'medium'|'coarse'} levelName
   * @returns {Object}
   */
  getLevel(levelName) {
    return this.levels[levelName];
  }
  
  /**
   * Get all levels
   * @returns {Object}
   */
  getAllLevels() {
    return this.levels;
  }
  
  /**
   * Get statistics about the aggregation
   * @returns {Object}
   */
  getStats() {
    return {
      fine: this.levels.fine?.count || 0,
      medium: this.levels.medium?.count || 0,
      coarse: this.levels.coarse?.count || 0,
      compressionRatio: {
        medium: this.levels.fine?.count / (this.levels.medium?.count || 1),
        coarse: this.levels.fine?.count / (this.levels.coarse?.count || 1)
      }
    };
  }
}

