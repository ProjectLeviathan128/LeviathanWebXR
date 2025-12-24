/**
 * Leviathan WebXR - Data Processor
 * 
 * Converts raw whale observation data to GPU-friendly TypedArrays.
 * Handles coordinate projection and time normalization.
 */

import { TIME_RANGE } from '../utils/Constants.js';

export class DataProcessor {
  /**
   * Create data processor
   * @param {Projection} projection - Geographic projection system
   */
  constructor(projection) {
    this.projection = projection;
    
    // Processing stats
    this.lastProcessTime = 0;
    this.lastRecordCount = 0;
  }
  
  /**
   * Process raw whale records into GPU-ready format
   * @param {Object} rawData - From DataLoader
   * @returns {Object} Processed data with TypedArrays
   */
  process(rawData) {
    const startTime = performance.now();
    const { records, meta } = rawData;
    const count = records.length;
    
    // Allocate typed arrays
    const positions = new Float32Array(count * 3);
    const times = new Float32Array(count);
    const species = new Float32Array(count);  // Float for shader compatibility
    const densities = new Float32Array(count);
    
    // Determine time range from meta or calculate from data
    let timeStart = meta.timeRange?.[0] ? new Date(meta.timeRange[0]).getFullYear() : TIME_RANGE.startYear;
    let timeEnd = meta.timeRange?.[1] ? new Date(meta.timeRange[1]).getFullYear() : TIME_RANGE.endYear;
    const timeSpan = timeEnd - timeStart;
    
    // Find max count for density normalization
    let maxCount = 1;
    for (const record of records) {
      if (record.count && record.count > maxCount) {
        maxCount = record.count;
      }
    }
    
    // Process each record
    for (let i = 0; i < count; i++) {
      const record = records[i];
      
      // Project geographic coordinates
      const [x, y, z] = this.projection.project(
        record.lat,
        record.lon,
        record.depth || 0
      );
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      // Normalize time
      if (typeof record.time === 'number') {
        // Already normalized [0, 1]
        times[i] = record.time;
      } else if (record.time) {
        // Parse date string
        const date = new Date(record.time);
        const year = date.getFullYear() + date.getMonth() / 12;
        times[i] = (year - timeStart) / timeSpan;
      } else if (record.year) {
        // Use year field
        times[i] = (record.year - timeStart) / timeSpan;
      } else {
        // Random time as fallback
        times[i] = Math.random();
      }
      
      // Clamp time to [0, 1]
      times[i] = Math.max(0, Math.min(1, times[i]));
      
      // Species (default to 0 if not specified)
      species[i] = record.species ?? record.speciesId ?? 0;
      
      // Density (normalized count)
      const rawCount = record.count ?? record.density ?? 1;
      densities[i] = Math.log10(rawCount + 1) / Math.log10(maxCount + 1);
    }
    
    const processingTime = performance.now() - startTime;
    this.lastProcessTime = processingTime;
    this.lastRecordCount = count;
    
    console.log(`Processed ${count} records in ${processingTime.toFixed(1)}ms`);
    
    return {
      positions,
      times,
      species,
      densities,
      count,
      meta: {
        ...meta,
        timeRange: [timeStart, timeEnd],
        maxCount,
        processingTime
      }
    };
  }
  
  /**
   * Process data in chunks for large datasets (prevents UI blocking)
   * @param {Object} rawData
   * @param {number} chunkSize - Records per chunk
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>}
   */
  async processAsync(rawData, chunkSize = 10000, onProgress = null) {
    const { records, meta } = rawData;
    const count = records.length;
    
    // Allocate typed arrays
    const positions = new Float32Array(count * 3);
    const times = new Float32Array(count);
    const species = new Float32Array(count);
    const densities = new Float32Array(count);
    
    // Time range
    let timeStart = meta.timeRange?.[0] ? new Date(meta.timeRange[0]).getFullYear() : TIME_RANGE.startYear;
    let timeEnd = meta.timeRange?.[1] ? new Date(meta.timeRange[1]).getFullYear() : TIME_RANGE.endYear;
    const timeSpan = timeEnd - timeStart;
    
    // Max count for density
    let maxCount = 1;
    for (const record of records) {
      if (record.count && record.count > maxCount) {
        maxCount = record.count;
      }
    }
    
    // Process in chunks
    for (let start = 0; start < count; start += chunkSize) {
      const end = Math.min(start + chunkSize, count);
      
      for (let i = start; i < end; i++) {
        const record = records[i];
        
        const [x, y, z] = this.projection.project(
          record.lat,
          record.lon,
          record.depth || 0
        );
        
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        
        if (typeof record.time === 'number') {
          times[i] = record.time;
        } else if (record.time) {
          const date = new Date(record.time);
          const year = date.getFullYear() + date.getMonth() / 12;
          times[i] = (year - timeStart) / timeSpan;
        } else if (record.year) {
          times[i] = (record.year - timeStart) / timeSpan;
        } else {
          times[i] = Math.random();
        }
        
        times[i] = Math.max(0, Math.min(1, times[i]));
        species[i] = record.species ?? record.speciesId ?? 0;
        
        const rawCount = record.count ?? record.density ?? 1;
        densities[i] = Math.log10(rawCount + 1) / Math.log10(maxCount + 1);
      }
      
      // Report progress and yield
      if (onProgress) {
        onProgress(end / count);
      }
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return {
      positions,
      times,
      species,
      densities,
      count,
      meta: {
        ...meta,
        timeRange: [timeStart, timeEnd],
        maxCount
      }
    };
  }
  
  /**
   * Get processing statistics
   * @returns {Object}
   */
  getStats() {
    return {
      lastProcessTime: this.lastProcessTime,
      lastRecordCount: this.lastRecordCount,
      recordsPerSecond: this.lastRecordCount / (this.lastProcessTime / 1000)
    };
  }
}


