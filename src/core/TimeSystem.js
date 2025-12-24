/**
 * Leviathan WebXR - Time System
 * 
 * Global temporal controller for the 30-year whale dataset.
 * Time is normalized to [0, 1] representing the full time span.
 * Provides smooth interpolation and shader uniforms.
 */

import { TIME_RANGE, TIME_DEFAULTS } from '../utils/Constants.js';
import { clamp, expSmooth } from '../utils/MathUtils.js';

export class TimeSystem {
  constructor() {
    // Target time (what gestures set)
    this.targetTime = TIME_DEFAULTS.initialTime;
    
    // Smoothed time (what renderers use)
    this.currentTime = TIME_DEFAULTS.initialTime;
    
    // Time window for visibility fade (how much time is "visible")
    this.timeWindow = TIME_DEFAULTS.timeWindow;
    
    // Smoothing factor for interpolation
    this.smoothingFactor = TIME_DEFAULTS.smoothingFactor;
    
    // Playback state (for optional auto-play)
    this.playing = false;
    this.playbackSpeed = 0.01; // Time units per second
    
    // Event callbacks
    this.onTimeChange = null;
    
    // Cached uniforms object for shader updates
    this._uniforms = {
      uTime: { value: this.currentTime },
      uTimeWindow: { value: this.timeWindow },
      uTimeRange: { value: [0.0, 1.0] }
    };
  }
  
  /**
   * Set the target time directly
   * @param {number} t - Normalized time [0, 1]
   */
  setTime(t) {
    this.targetTime = clamp(t, 0, 1);
  }
  
  /**
   * Adjust time by a delta value
   * @param {number} delta - Amount to add to current time
   */
  adjustTime(delta) {
    this.targetTime = clamp(this.targetTime + delta, 0, 1);
  }
  
  /**
   * Set the visible time window
   * @param {number} window - Time window radius [0, 0.5]
   */
  setTimeWindow(window) {
    this.timeWindow = clamp(window, 0.001, 0.5);
    this._uniforms.uTimeWindow.value = this.timeWindow;
  }
  
  /**
   * Reset to initial state
   */
  reset() {
    this.targetTime = TIME_DEFAULTS.initialTime;
    this.currentTime = TIME_DEFAULTS.initialTime;
    this.timeWindow = TIME_DEFAULTS.timeWindow;
    this.playing = false;
    this._updateUniforms();
  }
  
  /**
   * Start auto-playback
   * @param {number} speed - Playback speed (time units per second)
   */
  play(speed = 0.01) {
    this.playing = true;
    this.playbackSpeed = speed;
  }
  
  /**
   * Pause auto-playback
   */
  pause() {
    this.playing = false;
  }
  
  /**
   * Toggle playback state
   */
  togglePlay() {
    this.playing = !this.playing;
  }
  
  /**
   * Update the time system (call each frame)
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    // Handle auto-playback
    if (this.playing) {
      this.targetTime += this.playbackSpeed * deltaTime;
      
      // Loop back to start when reaching end
      if (this.targetTime > 1) {
        this.targetTime = 0;
      }
    }
    
    // Smooth interpolation toward target
    const previousTime = this.currentTime;
    this.currentTime = expSmooth(
      this.currentTime,
      this.targetTime,
      this.smoothingFactor,
      deltaTime
    );
    
    // Snap if very close
    if (Math.abs(this.currentTime - this.targetTime) < 0.0001) {
      this.currentTime = this.targetTime;
    }
    
    // Update uniforms
    this._updateUniforms();
    
    // Fire callback if time changed significantly
    if (Math.abs(this.currentTime - previousTime) > 0.0001 && this.onTimeChange) {
      this.onTimeChange(this.currentTime, this.getYear());
    }
  }
  
  /**
   * Update shader uniforms
   * @private
   */
  _updateUniforms() {
    this._uniforms.uTime.value = this.currentTime;
    this._uniforms.uTimeWindow.value = this.timeWindow;
  }
  
  /**
   * Get uniforms for shader material
   * @returns {Object} Uniforms object
   */
  getUniforms() {
    return this._uniforms;
  }
  
  /**
   * Get current normalized time
   * @returns {number}
   */
  getTime() {
    return this.currentTime;
  }
  
  /**
   * Get target normalized time
   * @returns {number}
   */
  getTargetTime() {
    return this.targetTime;
  }
  
  /**
   * Convert normalized time to year
   * @param {number} t - Normalized time (defaults to current)
   * @returns {number} Year
   */
  getYear(t = this.currentTime) {
    return TIME_RANGE.startYear + t * TIME_RANGE.spanYears;
  }
  
  /**
   * Convert year to normalized time
   * @param {number} year
   * @returns {number} Normalized time
   */
  yearToNormalized(year) {
    return (year - TIME_RANGE.startYear) / TIME_RANGE.spanYears;
  }
  
  /**
   * Get human-readable date string
   * @param {number} t - Normalized time (defaults to current)
   * @returns {string}
   */
  getDateString(t = this.currentTime) {
    const year = this.getYear(t);
    const yearInt = Math.floor(year);
    const monthFrac = (year - yearInt) * 12;
    const month = Math.floor(monthFrac) + 1;
    
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    return `${monthNames[month - 1]} ${yearInt}`;
  }
  
  /**
   * Check if a given time value is within the visible window
   * @param {number} t - Normalized time to check
   * @returns {boolean}
   */
  isTimeVisible(t) {
    const dist = Math.abs(t - this.currentTime);
    return dist <= this.timeWindow;
  }
  
  /**
   * Get visibility factor for a given time (for shader preview)
   * @param {number} t - Normalized time to check
   * @returns {number} Visibility [0, 1]
   */
  getTimeVisibility(t) {
    const dist = Math.abs(t - this.currentTime);
    if (dist > this.timeWindow) return 0;
    return 1 - (dist / this.timeWindow);
  }
}


