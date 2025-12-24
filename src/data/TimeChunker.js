/**
 * Leviathan WebXR - Time Chunker
 * 
 * Indexes processed data by time for efficient range queries.
 * Enables fast lookup of data visible at any given time.
 */

export class TimeChunker {
  /**
   * Create time chunker
   * @param {number} chunkCount - Number of time buckets (default: 30 for years)
   */
  constructor(chunkCount = 30) {
    this.chunkCount = chunkCount;
    
    // Index structure: array of {startIndex, endIndex} per chunk
    this.chunks = [];
    
    // Sorted indices for time-ordered access
    this.sortedIndices = null;
    
    // Source data reference
    this.data = null;
  }
  
  /**
   * Build time index from processed data
   * @param {Object} processedData - From DataProcessor
   */
  build(processedData) {
    this.data = processedData;
    const { times, count } = processedData;
    
    // Create array of {index, time} pairs
    const indexed = new Array(count);
    for (let i = 0; i < count; i++) {
      indexed[i] = { index: i, time: times[i] };
    }
    
    // Sort by time
    indexed.sort((a, b) => a.time - b.time);
    
    // Store sorted indices
    this.sortedIndices = new Uint32Array(count);
    for (let i = 0; i < count; i++) {
      this.sortedIndices[i] = indexed[i].index;
    }
    
    // Build chunk boundaries
    this.chunks = new Array(this.chunkCount);
    const chunkSize = 1.0 / this.chunkCount;
    
    let currentChunk = 0;
    let chunkStart = 0;
    
    for (let i = 0; i < count; i++) {
      const time = indexed[i].time;
      const targetChunk = Math.min(Math.floor(time / chunkSize), this.chunkCount - 1);
      
      // Fill any empty chunks
      while (currentChunk < targetChunk) {
        this.chunks[currentChunk] = {
          startIndex: chunkStart,
          endIndex: i,
          timeStart: currentChunk * chunkSize,
          timeEnd: (currentChunk + 1) * chunkSize
        };
        currentChunk++;
        chunkStart = i;
      }
    }
    
    // Fill remaining chunks
    while (currentChunk < this.chunkCount) {
      this.chunks[currentChunk] = {
        startIndex: chunkStart,
        endIndex: count,
        timeStart: currentChunk * chunkSize,
        timeEnd: (currentChunk + 1) * chunkSize
      };
      currentChunk++;
    }
    
    console.log(`Built time index: ${this.chunkCount} chunks for ${count} records`);
  }
  
  /**
   * Get indices of records visible at given time
   * @param {number} currentTime - Normalized time [0, 1]
   * @param {number} window - Time window radius
   * @returns {{startIndex: number, endIndex: number}} Range in sorted array
   */
  getVisibleRange(currentTime, window) {
    if (!this.sortedIndices) {
      return { startIndex: 0, endIndex: 0 };
    }
    
    const minTime = currentTime - window;
    const maxTime = currentTime + window;
    
    // Binary search for start
    const startIndex = this._binarySearchLower(minTime);
    
    // Binary search for end
    const endIndex = this._binarySearchUpper(maxTime);
    
    return { startIndex, endIndex };
  }
  
  /**
   * Get chunk indices that overlap with time range
   * @param {number} minTime
   * @param {number} maxTime
   * @returns {number[]} Chunk indices
   */
  getOverlappingChunks(minTime, maxTime) {
    const chunkSize = 1.0 / this.chunkCount;
    const startChunk = Math.max(0, Math.floor(minTime / chunkSize));
    const endChunk = Math.min(this.chunkCount - 1, Math.floor(maxTime / chunkSize));
    
    const chunks = [];
    for (let i = startChunk; i <= endChunk; i++) {
      chunks.push(i);
    }
    
    return chunks;
  }
  
  /**
   * Binary search for lower bound
   * @private
   */
  _binarySearchLower(targetTime) {
    if (!this.data) return 0;
    
    const times = this.data.times;
    let low = 0;
    let high = this.sortedIndices.length;
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const time = times[this.sortedIndices[mid]];
      
      if (time < targetTime) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    
    return low;
  }
  
  /**
   * Binary search for upper bound
   * @private
   */
  _binarySearchUpper(targetTime) {
    if (!this.data) return 0;
    
    const times = this.data.times;
    let low = 0;
    let high = this.sortedIndices.length;
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const time = times[this.sortedIndices[mid]];
      
      if (time <= targetTime) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    
    return low;
  }
  
  /**
   * Get records for a specific year
   * @param {number} year - Year number (e.g., 2015)
   * @param {number} startYear - Dataset start year
   * @param {number} endYear - Dataset end year
   * @returns {{startIndex: number, endIndex: number}}
   */
  getYearRange(year, startYear = 1994, endYear = 2024) {
    const normalizedStart = (year - startYear) / (endYear - startYear);
    const normalizedEnd = (year + 1 - startYear) / (endYear - startYear);
    
    return this.getVisibleRange(
      (normalizedStart + normalizedEnd) / 2,
      (normalizedEnd - normalizedStart) / 2
    );
  }
  
  /**
   * Get statistics about the time distribution
   * @returns {Object}
   */
  getStats() {
    if (!this.chunks.length) return null;
    
    const chunkSizes = this.chunks.map(c => c.endIndex - c.startIndex);
    const total = chunkSizes.reduce((a, b) => a + b, 0);
    const avg = total / chunkSizes.length;
    const max = Math.max(...chunkSizes);
    const min = Math.min(...chunkSizes);
    
    return {
      chunkCount: this.chunkCount,
      totalRecords: total,
      avgPerChunk: avg,
      maxPerChunk: max,
      minPerChunk: min
    };
  }
}


