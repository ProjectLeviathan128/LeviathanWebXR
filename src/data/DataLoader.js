/**
 * Leviathan WebXR - Data Loader
 * 
 * Fetches and validates whale observation data.
 * Supports both JSON and binary formats.
 */

export class DataLoader {
  constructor() {
    // Loading state
    this.isLoading = false;
    this.loadProgress = 0;
    
    // Callbacks
    this.onProgress = null;
    this.onError = null;
  }
  
  /**
   * Load whale data from JSON URL
   * @param {string} url - Data source URL
   * @returns {Promise<Object>} Raw whale data
   */
  async loadJSON(url) {
    this.isLoading = true;
    this.loadProgress = 0;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
      }
      
      // Get content length for progress
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      if (total > 0) {
        // Stream response for progress tracking
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          received += value.length;
          
          this.loadProgress = received / total;
          if (this.onProgress) {
            this.onProgress(this.loadProgress);
          }
        }
        
        // Combine chunks and decode
        const allChunks = new Uint8Array(received);
        let position = 0;
        for (const chunk of chunks) {
          allChunks.set(chunk, position);
          position += chunk.length;
        }
        
        const text = new TextDecoder().decode(allChunks);
        const data = JSON.parse(text);
        
        this.isLoading = false;
        return this._validate(data);
        
      } else {
        // No content length - load directly
        const data = await response.json();
        this.loadProgress = 1;
        this.isLoading = false;
        return this._validate(data);
      }
      
    } catch (error) {
      this.isLoading = false;
      
      if (this.onError) {
        this.onError(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Load multiple chunks in sequence
   * @param {string[]} urls - Array of chunk URLs
   * @returns {Promise<Object>} Merged data
   */
  async loadChunks(urls) {
    const allRecords = [];
    let meta = null;
    
    for (let i = 0; i < urls.length; i++) {
      const chunkData = await this.loadJSON(urls[i]);
      
      if (chunkData.records) {
        allRecords.push(...chunkData.records);
      }
      
      if (chunkData.meta && !meta) {
        meta = chunkData.meta;
      }
      
      // Update overall progress
      this.loadProgress = (i + 1) / urls.length;
      if (this.onProgress) {
        this.onProgress(this.loadProgress);
      }
    }
    
    return {
      records: allRecords,
      meta: meta || {}
    };
  }
  
  /**
   * Validate data structure
   * @private
   * @param {Object} data - Raw data
   * @returns {Object} Validated data
   */
  _validate(data) {
    if (!data) {
      throw new Error('Data is empty');
    }
    
    // Check for records array
    if (!data.records && !Array.isArray(data)) {
      throw new Error('Data must contain records array');
    }
    
    // Normalize structure
    const records = data.records || data;
    
    if (records.length === 0) {
      console.warn('Data contains no records');
    }
    
    // Validate first record structure
    if (records.length > 0) {
      const sample = records[0];
      
      if (typeof sample.lat !== 'number' || typeof sample.lon !== 'number') {
        throw new Error('Records must contain lat and lon fields');
      }
    }
    
    return {
      records,
      meta: data.meta || {}
    };
  }
  
  /**
   * Get loading progress
   * @returns {number} [0, 1]
   */
  getProgress() {
    return this.loadProgress;
  }
  
  /**
   * Check if currently loading
   * @returns {boolean}
   */
  getIsLoading() {
    return this.isLoading;
  }
}


