/**
 * Leviathan WebXR - Performance Monitor
 * 
 * Tracks frame rate and adjusts quality settings to maintain
 * stable 72fps on Quest 2. Implements adaptive quality scaling.
 */

import { PERFORMANCE, RENDER_BUDGET } from '../utils/Constants.js';

export class PerformanceMonitor {
  constructor() {
    // Target framerate
    this.targetFPS = PERFORMANCE.targetFPS;
    
    // Quality level [0.3 - 1.0]
    this.qualityLevel = PERFORMANCE.maxQuality;
    
    // Frame timing
    this.frameTimes = new Float32Array(PERFORMANCE.sampleWindow);
    this.frameIndex = 0;
    this.frameCount = 0;
    
    // Statistics
    this.currentFPS = this.targetFPS;
    this.averageFPS = this.targetFPS;
    this.minFPS = this.targetFPS;
    
    // Draw call tracking
    this.drawCalls = 0;
    this.triangles = 0;
    this.instances = 0;
    
    // Last frame timestamp
    this.lastTime = 0;
    
    // Quality change cooldown (prevent rapid oscillation)
    this.cooldownTime = 0;
    this.cooldownDuration = 0.5; // seconds
    
    // Callbacks
    this.onQualityChange = null;
  }
  
  /**
   * Update performance metrics (call each frame)
   * @param {number} time - Current time in seconds
   */
  update(time) {
    // Calculate delta time
    const deltaTime = this.lastTime > 0 ? time - this.lastTime : 1 / this.targetFPS;
    this.lastTime = time;
    
    // Store frame time
    this.frameTimes[this.frameIndex] = deltaTime;
    this.frameIndex = (this.frameIndex + 1) % PERFORMANCE.sampleWindow;
    this.frameCount = Math.min(this.frameCount + 1, PERFORMANCE.sampleWindow);
    
    // Calculate current FPS
    this.currentFPS = 1 / deltaTime;
    
    // Calculate average FPS
    if (this.frameCount > 0) {
      let sum = 0;
      let min = Infinity;
      
      for (let i = 0; i < this.frameCount; i++) {
        sum += this.frameTimes[i];
        if (this.frameTimes[i] > 0) {
          min = Math.min(min, 1 / this.frameTimes[i]);
        }
      }
      
      this.averageFPS = this.frameCount / sum;
      this.minFPS = min === Infinity ? this.targetFPS : min;
    }
    
    // Update cooldown
    if (this.cooldownTime > 0) {
      this.cooldownTime -= deltaTime;
    }
    
    // Adjust quality based on performance
    this._adjustQuality(deltaTime);
  }
  
  /**
   * Adjust quality level based on frame rate
   * @private
   * @param {number} deltaTime
   */
  _adjustQuality(deltaTime) {
    if (this.cooldownTime > 0) return;
    
    const previousQuality = this.qualityLevel;
    
    // If we're below 90% of target, reduce quality
    if (this.averageFPS < this.targetFPS * 0.9) {
      this.qualityLevel = Math.max(
        PERFORMANCE.minQuality,
        this.qualityLevel - PERFORMANCE.qualityStep
      );
    }
    // If we're above target and have headroom, increase quality
    else if (this.averageFPS > this.targetFPS * 1.1 && this.minFPS > this.targetFPS * 0.95) {
      this.qualityLevel = Math.min(
        PERFORMANCE.maxQuality,
        this.qualityLevel + PERFORMANCE.qualityStep * 0.5 // Slower to increase
      );
    }
    
    // Fire callback if quality changed
    if (this.qualityLevel !== previousQuality) {
      this.cooldownTime = this.cooldownDuration;
      
      if (this.onQualityChange) {
        this.onQualityChange(this.qualityLevel);
      }
    }
  }
  
  /**
   * Record draw call statistics
   * FIX: Audit Issue - Verify draw calls remain under budget
   * @param {number} drawCalls
   * @param {number} triangles
   * @param {number} instances
   */
  recordDrawStats(drawCalls, triangles, instances) {
    this.drawCalls = drawCalls;
    this.triangles = triangles;
    this.instances = instances;
    
    // FIX: Audit Issue - Warn if draw call budget exceeded
    if (drawCalls > RENDER_BUDGET.maxDrawCalls) {
      console.warn(`FIX: Draw calls (${drawCalls}) exceed budget (${RENDER_BUDGET.maxDrawCalls})`);
    }
  }
  
  /**
   * Get maximum visible instances based on quality
   * @returns {number}
   */
  getMaxVisibleInstances() {
    return Math.floor(RENDER_BUDGET.maxVisibleInstances * this.qualityLevel);
  }
  
  /**
   * Get current quality level
   * @returns {number} Quality [0.3 - 1.0]
   */
  getQuality() {
    return this.qualityLevel;
  }
  
  /**
   * Force a specific quality level
   * @param {number} quality
   */
  setQuality(quality) {
    this.qualityLevel = Math.max(
      PERFORMANCE.minQuality,
      Math.min(PERFORMANCE.maxQuality, quality)
    );
  }
  
  /**
   * Check if we're meeting target framerate
   * @returns {boolean}
   */
  isMeetingTarget() {
    return this.averageFPS >= this.targetFPS * 0.95;
  }
  
  /**
   * Get performance summary for debugging
   * @returns {Object}
   */
  getStats() {
    return {
      fps: Math.round(this.currentFPS),
      avgFps: Math.round(this.averageFPS),
      minFps: Math.round(this.minFPS),
      quality: Math.round(this.qualityLevel * 100),
      drawCalls: this.drawCalls,
      triangles: this.triangles,
      instances: this.instances
    };
  }
  
  /**
   * Reset all statistics
   */
  reset() {
    this.frameTimes.fill(0);
    this.frameIndex = 0;
    this.frameCount = 0;
    this.qualityLevel = PERFORMANCE.maxQuality;
    this.lastTime = 0;
    this.cooldownTime = 0;
  }
}

