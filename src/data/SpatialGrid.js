/**
 * Leviathan WebXR - Spatial Grid
 * 
 * AUDIT FOLLOW-UP: Spatial Inspection
 * 
 * GPU-safe spatial indexing for bounded inspection queries.
 * Built once at load time, queried via region intersection.
 * 
 * WHY AGGREGATION, NOT POINT QUERIES:
 * - O(n) scans cause frame drops on Quest 2
 * - Individual point queries don't scale to 50k+ instances
 * - Aggregated cells provide scientifically honest summaries
 * - Grid intersection is O(cells) not O(points)
 * 
 * Each cell stores:
 * - Total observation count
 * - Species histogram (8 species)
 * - Time histogram (for temporal distribution)
 * - Cell bounds for intersection tests
 */

import { PACIFIC_BOUNDS, WORLD_SCALE } from '../utils/Constants.js';

export class SpatialGrid {
  /**
   * Create spatial grid for region queries
   * @param {number} cellSize - Cell size in world units (default ~50km = 0.5 units)
   */
  constructor(cellSize = 0.5) {
    // AUDIT FOLLOW-UP: Spatial Inspection - Grid configuration
    this.cellSize = cellSize;
    
    // Grid dimensions (will be set during build)
    this.gridMin = [0, 0, 0];
    this.gridMax = [0, 0, 0];
    this.gridDims = [0, 0, 0];
    
    // Cell storage - Map from cell key to cell data
    this.cells = new Map();
    
    // Statistics
    this.totalCells = 0;
    this.populatedCells = 0;
    this.totalPoints = 0;
    
    // Build state
    this.built = false;
  }
  
  /**
   * Build spatial grid from processed whale data
   * AUDIT FOLLOW-UP: Called once at load time, not per-frame
   * @param {Object} processedData - From DataProcessor
   */
  build(processedData) {
    const { positions, species, times, densities, count } = processedData;
    
    console.log(`AUDIT FOLLOW-UP: Building spatial grid for ${count} points...`);
    const startTime = performance.now();
    
    // Step 1: Find data bounds
    this._computeBounds(positions, count);
    
    // Step 2: Compute grid dimensions
    this._computeGridDimensions();
    
    // Step 3: Insert all points into cells
    this._insertPoints(positions, species, times, densities, count);
    
    // Step 4: Finalize cells (compute averages, etc.)
    this._finalizeCells();
    
    this.built = true;
    this.totalPoints = count;
    
    const buildTime = performance.now() - startTime;
    console.log(`AUDIT FOLLOW-UP: Spatial grid built in ${buildTime.toFixed(1)}ms`);
    console.log(`  Grid dimensions: ${this.gridDims.join(' x ')}`);
    console.log(`  Total cells: ${this.totalCells}`);
    console.log(`  Populated cells: ${this.populatedCells}`);
  }
  
  /**
   * Compute data bounds from positions
   * @private
   */
  _computeBounds(positions, count) {
    if (count === 0) {
      this.gridMin = [0, 0, 0];
      this.gridMax = [1, 1, 1];
      return;
    }
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
    
    // Add small padding
    const pad = this.cellSize * 0.5;
    this.gridMin = [minX - pad, minY - pad, minZ - pad];
    this.gridMax = [maxX + pad, maxY + pad, maxZ + pad];
  }
  
  /**
   * Compute grid dimensions based on bounds and cell size
   * @private
   */
  _computeGridDimensions() {
    const sizeX = this.gridMax[0] - this.gridMin[0];
    const sizeY = this.gridMax[1] - this.gridMin[1];
    const sizeZ = this.gridMax[2] - this.gridMin[2];
    
    this.gridDims = [
      Math.max(1, Math.ceil(sizeX / this.cellSize)),
      Math.max(1, Math.ceil(sizeY / this.cellSize)),
      Math.max(1, Math.ceil(sizeZ / this.cellSize))
    ];
    
    this.totalCells = this.gridDims[0] * this.gridDims[1] * this.gridDims[2];
  }
  
  /**
   * Insert all points into grid cells
   * @private
   */
  _insertPoints(positions, species, times, densities, count) {
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      
      // Compute cell indices
      const cellX = Math.floor((x - this.gridMin[0]) / this.cellSize);
      const cellY = Math.floor((y - this.gridMin[1]) / this.cellSize);
      const cellZ = Math.floor((z - this.gridMin[2]) / this.cellSize);
      
      // Clamp to grid bounds
      const cx = Math.max(0, Math.min(this.gridDims[0] - 1, cellX));
      const cy = Math.max(0, Math.min(this.gridDims[1] - 1, cellY));
      const cz = Math.max(0, Math.min(this.gridDims[2] - 1, cellZ));
      
      const key = this._cellKey(cx, cy, cz);
      
      // Get or create cell
      let cell = this.cells.get(key);
      if (!cell) {
        cell = this._createCell(cx, cy, cz);
        this.cells.set(key, cell);
      }
      
      // Add point data to cell
      cell.count++;
      cell.speciesHistogram[Math.floor(species[i])]++;
      
      // Time histogram (10 buckets across [0,1])
      const timeBucket = Math.min(9, Math.floor(times[i] * 10));
      cell.timeHistogram[timeBucket]++;
      
      // Accumulate for centroid
      cell.sumX += x;
      cell.sumY += y;
      cell.sumZ += z;
      cell.sumTime += times[i];
    }
  }
  
  /**
   * Create a new cell
   * @private
   */
  _createCell(cx, cy, cz) {
    return {
      // Grid position
      cx, cy, cz,
      
      // World bounds
      minX: this.gridMin[0] + cx * this.cellSize,
      minY: this.gridMin[1] + cy * this.cellSize,
      minZ: this.gridMin[2] + cz * this.cellSize,
      maxX: this.gridMin[0] + (cx + 1) * this.cellSize,
      maxY: this.gridMin[1] + (cy + 1) * this.cellSize,
      maxZ: this.gridMin[2] + (cz + 1) * this.cellSize,
      
      // Aggregated data
      count: 0,
      speciesHistogram: new Uint32Array(8),
      timeHistogram: new Uint32Array(10),
      
      // For centroid calculation
      sumX: 0, sumY: 0, sumZ: 0,
      sumTime: 0,
      
      // Computed after finalization
      centroid: null,
      avgTime: 0,
      dominantSpecies: 0
    };
  }
  
  /**
   * Finalize cells - compute centroids and dominant species
   * @private
   */
  _finalizeCells() {
    this.populatedCells = 0;
    
    for (const cell of this.cells.values()) {
      if (cell.count === 0) continue;
      
      this.populatedCells++;
      
      // Compute centroid
      cell.centroid = [
        cell.sumX / cell.count,
        cell.sumY / cell.count,
        cell.sumZ / cell.count
      ];
      
      // Compute average time
      cell.avgTime = cell.sumTime / cell.count;
      
      // Find dominant species
      let maxCount = 0;
      for (let s = 0; s < 8; s++) {
        if (cell.speciesHistogram[s] > maxCount) {
          maxCount = cell.speciesHistogram[s];
          cell.dominantSpecies = s;
        }
      }
      
      // Clear accumulation fields to save memory
      delete cell.sumX;
      delete cell.sumY;
      delete cell.sumZ;
      delete cell.sumTime;
    }
  }
  
  /**
   * Generate cell key from indices
   * @private
   */
  _cellKey(cx, cy, cz) {
    return `${cx},${cy},${cz}`;
  }
  
  /**
   * Query cells intersecting a sphere
   * AUDIT FOLLOW-UP: This is the safe query method - O(cells) not O(points)
   * @param {number[]} center - [x, y, z] sphere center
   * @param {number} radius - Sphere radius in world units
   * @returns {Object} Aggregated query result
   */
  querySphere(center, radius) {
    if (!this.built) {
      return this._emptyResult();
    }
    
    // Compute cell range to check
    const minCX = Math.floor((center[0] - radius - this.gridMin[0]) / this.cellSize);
    const maxCX = Math.ceil((center[0] + radius - this.gridMin[0]) / this.cellSize);
    const minCY = Math.floor((center[1] - radius - this.gridMin[1]) / this.cellSize);
    const maxCY = Math.ceil((center[1] + radius - this.gridMin[1]) / this.cellSize);
    const minCZ = Math.floor((center[2] - radius - this.gridMin[2]) / this.cellSize);
    const maxCZ = Math.ceil((center[2] + radius - this.gridMin[2]) / this.cellSize);
    
    // Clamp to grid bounds
    const startX = Math.max(0, minCX);
    const endX = Math.min(this.gridDims[0] - 1, maxCX);
    const startY = Math.max(0, minCY);
    const endY = Math.min(this.gridDims[1] - 1, maxCY);
    const startZ = Math.max(0, minCZ);
    const endZ = Math.min(this.gridDims[2] - 1, maxCZ);
    
    // Aggregate results from intersecting cells
    const result = {
      totalCount: 0,
      speciesHistogram: new Uint32Array(8),
      timeHistogram: new Uint32Array(10),
      cellsQueried: 0,
      minTime: 1.0,
      maxTime: 0.0
    };
    
    const radiusSq = radius * radius;
    
    for (let cx = startX; cx <= endX; cx++) {
      for (let cy = startY; cy <= endY; cy++) {
        for (let cz = startZ; cz <= endZ; cz++) {
          const key = this._cellKey(cx, cy, cz);
          const cell = this.cells.get(key);
          
          if (!cell || cell.count === 0) continue;
          
          // Check if cell intersects sphere (use centroid for simplicity)
          if (cell.centroid) {
            const dx = cell.centroid[0] - center[0];
            const dy = cell.centroid[1] - center[1];
            const dz = cell.centroid[2] - center[2];
            const distSq = dx * dx + dy * dy + dz * dz;
            
            // Include cell if centroid is within radius
            // (This is an approximation but avoids complex box-sphere intersection)
            if (distSq <= radiusSq) {
              result.cellsQueried++;
              result.totalCount += cell.count;
              
              for (let s = 0; s < 8; s++) {
                result.speciesHistogram[s] += cell.speciesHistogram[s];
              }
              
              for (let t = 0; t < 10; t++) {
                result.timeHistogram[t] += cell.timeHistogram[t];
              }
              
              result.minTime = Math.min(result.minTime, cell.avgTime);
              result.maxTime = Math.max(result.maxTime, cell.avgTime);
            }
          }
        }
      }
    }
    
    // Compute derived values
    result.dominantSpecies = this._findDominantSpecies(result.speciesHistogram);
    result.timeSpan = result.totalCount > 0 ? [result.minTime, result.maxTime] : [0, 0];
    
    return result;
  }
  
  /**
   * Find dominant species from histogram
   * @private
   */
  _findDominantSpecies(histogram) {
    let maxCount = 0;
    let dominant = 0;
    for (let s = 0; s < 8; s++) {
      if (histogram[s] > maxCount) {
        maxCount = histogram[s];
        dominant = s;
      }
    }
    return dominant;
  }
  
  /**
   * Create empty result
   * @private
   */
  _emptyResult() {
    return {
      totalCount: 0,
      speciesHistogram: new Uint32Array(8),
      timeHistogram: new Uint32Array(10),
      cellsQueried: 0,
      dominantSpecies: 0,
      timeSpan: [0, 0]
    };
  }
  
  /**
   * Get grid statistics
   * @returns {Object}
   */
  getStats() {
    return {
      cellSize: this.cellSize,
      gridDims: [...this.gridDims],
      totalCells: this.totalCells,
      populatedCells: this.populatedCells,
      totalPoints: this.totalPoints,
      memoryEstimate: this.populatedCells * 100 // ~100 bytes per cell
    };
  }
  
  /**
   * Check if grid has been built
   * @returns {boolean}
   */
  isBuilt() {
    return this.built;
  }
}


