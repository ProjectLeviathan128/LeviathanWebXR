/**
 * Leviathan WebXR - Time Scrub Gesture Handler
 * 
 * Dedicated handler for time scrubbing with left hand.
 * Provides visual feedback and smooth time control.
 */

import * as THREE from 'three';
import { TIME_DEFAULTS, GESTURE } from '../utils/Constants.js';
import { clamp, expSmooth } from '../utils/MathUtils.js';

export class TimeScrubGesture {
  /**
   * Create time scrub gesture handler
   * @param {TimeSystem} timeSystem - Time controller
   */
  constructor(timeSystem) {
    this.timeSystem = timeSystem;
    
    // Gesture configuration
    this.sensitivity = GESTURE.timeScrub.sensitivity;
    this.deadZone = GESTURE.timeScrub.deadZone;
    this.smoothing = GESTURE.timeScrub.smoothing;
    
    // State
    this.isActive = false;
    this.accumulatedDelta = 0;
    this.smoothedDelta = 0;
    
    // Visual feedback
    this.feedbackIntensity = 0;
  }
  
  /**
   * Handle time scrub input
   * @param {number} deltaX - Horizontal movement in meters
   */
  onInput(deltaX) {
    // Accumulate delta
    this.accumulatedDelta += deltaX;
    this.isActive = true;
  }
  
  /**
   * Update (call each frame)
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (!this.isActive) {
      // Fade out feedback
      this.feedbackIntensity = expSmooth(this.feedbackIntensity, 0, 0.1, deltaTime);
      return;
    }
    
    // Smooth the accumulated delta
    this.smoothedDelta = expSmooth(this.smoothedDelta, this.accumulatedDelta, this.smoothing, deltaTime);
    
    // Apply to time system
    if (Math.abs(this.smoothedDelta) > 0.0001) {
      this.timeSystem.adjustTime(this.smoothedDelta);
      
      // Update feedback intensity based on movement speed
      this.feedbackIntensity = clamp(Math.abs(this.smoothedDelta) * 10, 0, 1);
    }
    
    // Reset for next frame
    this.accumulatedDelta = 0;
    this.isActive = false;
  }
  
  /**
   * Reset gesture state
   */
  reset() {
    this.isActive = false;
    this.accumulatedDelta = 0;
    this.smoothedDelta = 0;
    this.feedbackIntensity = 0;
  }
  
  /**
   * Get visual feedback intensity (for environment color shift)
   * @returns {number} [0, 1]
   */
  getFeedbackIntensity() {
    return this.feedbackIntensity;
  }
  
  /**
   * Get current direction (-1 = past, 0 = none, 1 = future)
   * @returns {number}
   */
  getDirection() {
    if (Math.abs(this.smoothedDelta) < 0.001) return 0;
    return this.smoothedDelta > 0 ? 1 : -1;
  }
}


