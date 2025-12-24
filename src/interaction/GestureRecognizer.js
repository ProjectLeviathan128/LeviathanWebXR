/**
 * Leviathan WebXR - Gesture Recognizer
 * 
 * State machine for recognizing hand gestures.
 * Coordinates between individual gesture detectors and manages
 * exclusive gesture states.
 * 
 * Gestures:
 * - TimeScrub: Left palm open, horizontal movement
 * - Inspect: Right pinch
 * - Reset: Both palms open and still
 */

import { GESTURE } from '../utils/Constants.js';

// Gesture states
export const GestureState = {
  IDLE: 'idle',
  TIME_SCRUB: 'time_scrub',
  INSPECT: 'inspect',
  RESET_PENDING: 'reset_pending',
  RESET_ACTIVE: 'reset_active'
};

export class GestureRecognizer {
  /**
   * Create gesture recognizer
   * @param {HandTracker} handTracker
   */
  constructor(handTracker) {
    this.handTracker = handTracker;
    
    // Current state
    this.state = GestureState.IDLE;
    
    // State timers
    this.stateTimer = 0;
    
    // Reset gesture tracking
    this.resetHoldTime = 0;
    this.resetStartPosition = null;
    
    // Callbacks
    this.onTimeScrub = null;      // (deltaX: number) => void
    this.onInspect = null;        // (position: Vector3, active: boolean) => void
    this.onReset = null;          // () => void
    
    // Last positions for delta calculation
    this.lastLeftX = 0;
    
    // AUDIT FOLLOW-UP: Spatial Inspection - Re-enable inspect with safe grid queries
    // Previously disabled due to O(n) CPU scan; now uses SpatialGrid
    this.inspectEnabled = true;
    
    // FIX: Audit Issue - Disable reset gesture effects on floating origin
    // Reset only affects time, not spatial state
    this.resetEnabled = true;  // Still enabled but limited to time-only reset
  }
  
  /**
   * Update gesture recognition
   * FIX: Audit Issue - Disable broken/misleading interactions
   * @param {number} deltaTime - Time since last frame
   */
  update(deltaTime) {
    const left = this.handTracker.getLeftHand();
    const right = this.handTracker.getRightHand();
    
    // Check for reset gesture first (highest priority)
    // FIX: Audit Issue - Reset is enabled but only affects time (see ResetGesture)
    if (this.resetEnabled && this._checkResetGesture(left, right, deltaTime)) {
      return;
    }
    
    // Check for time scrub gesture - PRIMARY INTERACTION
    if (this._checkTimeScrubGesture(left, deltaTime)) {
      return;
    }
    
    // FIX: Audit Issue - Inspect gesture disabled to prevent O(n) CPU scan
    // Code path remains but is unreachable when inspectEnabled = false
    if (this.inspectEnabled && this._checkInspectGesture(right, deltaTime)) {
      return;
    }
    
    // No gesture active
    if (this.state !== GestureState.IDLE) {
      this._transitionTo(GestureState.IDLE);
    }
  }
  
  /**
   * Check for reset gesture (both palms open and still)
   * @private
   */
  _checkResetGesture(left, right, deltaTime) {
    const bothVisible = left.visible && right.visible;
    const bothOpen = left.palmOpenness > 0.7 && right.palmOpenness > 0.7;
    
    if (!bothVisible || !bothOpen) {
      this.resetHoldTime = 0;
      if (this.state === GestureState.RESET_PENDING) {
        this._transitionTo(GestureState.IDLE);
      }
      return false;
    }
    
    // Check if hands are relatively still
    const leftVel = this.handTracker.getLeftVelocity();
    const rightVel = this.handTracker.getRightVelocity();
    const leftSpeed = leftVel.length();
    const rightSpeed = rightVel.length();
    
    const areStill = leftSpeed < GESTURE.reset.movementThreshold && 
                     rightSpeed < GESTURE.reset.movementThreshold;
    
    if (!areStill) {
      this.resetHoldTime = 0;
      if (this.state === GestureState.RESET_PENDING) {
        this._transitionTo(GestureState.IDLE);
      }
      return false;
    }
    
    // Accumulate hold time
    this.resetHoldTime += deltaTime;
    
    if (this.state !== GestureState.RESET_PENDING) {
      this._transitionTo(GestureState.RESET_PENDING);
    }
    
    // Check if hold duration reached
    if (this.resetHoldTime >= GESTURE.reset.holdDuration) {
      this._transitionTo(GestureState.RESET_ACTIVE);
      
      // Fire reset callback
      if (this.onReset) {
        this.onReset();
      }
      
      // Reset hold time (prevent repeated triggers)
      this.resetHoldTime = 0;
      
      return true;
    }
    
    return true; // Still in reset gesture
  }
  
  /**
   * Check for time scrub gesture (left palm open, horizontal movement)
   * @private
   */
  _checkTimeScrubGesture(left, deltaTime) {
    if (!left.visible) {
      if (this.state === GestureState.TIME_SCRUB) {
        this._transitionTo(GestureState.IDLE);
      }
      return false;
    }
    
    // Check if palm is open
    const isPalmOpen = left.palmOpenness > GESTURE.timeScrub.palmOpenThreshold;
    
    if (!isPalmOpen) {
      if (this.state === GestureState.TIME_SCRUB) {
        this._transitionTo(GestureState.IDLE);
      }
      this.lastLeftX = left.palmPosition.x;
      return false;
    }
    
    // Palm is open - we're in time scrub mode
    if (this.state !== GestureState.TIME_SCRUB) {
      this._transitionTo(GestureState.TIME_SCRUB);
      this.lastLeftX = left.palmPosition.x;
      return true;
    }
    
    // Calculate horizontal delta
    const deltaX = left.palmPosition.x - this.lastLeftX;
    this.lastLeftX = left.palmPosition.x;
    
    // Apply dead zone
    if (Math.abs(deltaX) > GESTURE.timeScrub.deadZone) {
      const adjustedDelta = deltaX * GESTURE.timeScrub.sensitivity;
      
      // Fire callback
      if (this.onTimeScrub) {
        this.onTimeScrub(adjustedDelta);
      }
    }
    
    return true;
  }
  
  /**
   * Check for inspect gesture (right pinch)
   * @private
   */
  _checkInspectGesture(right, deltaTime) {
    if (!right.visible) {
      if (this.state === GestureState.INSPECT) {
        // End inspect
        if (this.onInspect) {
          this.onInspect(null, false);
        }
        this._transitionTo(GestureState.IDLE);
      }
      return false;
    }
    
    // Check pinch distance
    const isPinching = right.pinchDistance < GESTURE.inspect.pinchThreshold;
    
    if (!isPinching) {
      if (this.state === GestureState.INSPECT) {
        // End inspect
        if (this.onInspect) {
          this.onInspect(null, false);
        }
        this._transitionTo(GestureState.IDLE);
      }
      return false;
    }
    
    // Pinching - get pinch point
    const pinchPoint = this.handTracker.getPinchPoint('right');
    
    if (this.state !== GestureState.INSPECT) {
      this._transitionTo(GestureState.INSPECT);
    }
    
    // Fire callback with position
    if (this.onInspect && pinchPoint) {
      this.onInspect(pinchPoint, true);
    }
    
    return true;
  }
  
  /**
   * Transition to a new state
   * @private
   */
  _transitionTo(newState) {
    if (this.state === newState) return;
    
    console.log(`Gesture: ${this.state} → ${newState}`);
    this.state = newState;
    this.stateTimer = 0;
  }
  
  /**
   * Get current gesture state
   * @returns {string}
   */
  getState() {
    return this.state;
  }
  
  /**
   * Check if a specific gesture is active
   * @param {string} gestureState
   * @returns {boolean}
   */
  isActive(gestureState) {
    return this.state === gestureState;
  }
  
  /**
   * Get reset progress (0-1)
   * @returns {number}
   */
  getResetProgress() {
    if (this.state !== GestureState.RESET_PENDING) return 0;
    return this.resetHoldTime / GESTURE.reset.holdDuration;
  }
}

