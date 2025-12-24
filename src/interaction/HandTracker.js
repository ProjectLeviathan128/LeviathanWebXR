/**
 * Leviathan WebXR - Hand Tracker
 * 
 * Wraps WebXR Hand Input API for consistent hand data access.
 * Extracts joint positions each frame and computes derived values
 * (palm position, finger spread, pinch distance).
 */

import * as THREE from 'three';
import { calculatePalmOpenness, calculatePinchDistance } from '../utils/MathUtils.js';

// Joint names from WebXR Hand Input API
const JOINT_NAMES = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'
];

export class HandTracker {
  constructor() {
    // Cached hand data
    this.leftHand = this._createHandData();
    this.rightHand = this._createHandData();
    
    // Previous frame data for velocity calculation
    this.prevLeftPalm = new THREE.Vector3();
    this.prevRightPalm = new THREE.Vector3();
    
    // Velocity (change per frame)
    this.leftVelocity = new THREE.Vector3();
    this.rightVelocity = new THREE.Vector3();
    
    // Tracking state
    this.leftTracked = false;
    this.rightTracked = false;
    
    // Delta time for velocity calculation
    this.lastUpdateTime = 0;
  }
  
  /**
   * Create empty hand data structure
   * @private
   */
  _createHandData() {
    return {
      joints: {},
      palmPosition: new THREE.Vector3(),
      palmNormal: new THREE.Vector3(0, 1, 0),
      palmOpenness: 0,
      pinchDistance: Infinity,
      visible: false
    };
  }
  
  /**
   * Update hand tracking from XR frame
   * @param {Object} handData - Hand data from XRSession
   * @param {number} time - Current time in seconds
   */
  update(handData, time) {
    const dt = time - this.lastUpdateTime;
    this.lastUpdateTime = time;
    
    // Update left hand
    if (handData.left && handData.left.visible) {
      this._updateHand(this.leftHand, handData.left, this.prevLeftPalm, this.leftVelocity, dt);
      this.leftTracked = true;
    } else {
      this.leftHand.visible = false;
      this.leftTracked = false;
    }
    
    // Update right hand
    if (handData.right && handData.right.visible) {
      this._updateHand(this.rightHand, handData.right, this.prevRightPalm, this.rightVelocity, dt);
      this.rightTracked = true;
    } else {
      this.rightHand.visible = false;
      this.rightTracked = false;
    }
  }
  
  /**
   * Update a single hand's data
   * @private
   */
  _updateHand(hand, rawData, prevPalm, velocity, dt) {
    hand.joints = rawData.joints;
    hand.visible = true;
    
    // Extract palm position from wrist joint
    const wrist = rawData.joints['wrist'];
    if (wrist) {
      // Store previous position
      prevPalm.copy(hand.palmPosition);
      
      // Update current position
      hand.palmPosition.set(
        wrist.position.x,
        wrist.position.y,
        wrist.position.z
      );
      
      // Calculate velocity
      if (dt > 0) {
        velocity.copy(hand.palmPosition).sub(prevPalm).divideScalar(dt);
      }
    }
    
    // Calculate palm normal from wrist orientation
    const wristOri = wrist?.orientation;
    if (wristOri) {
      // Rotate (0, 1, 0) by wrist orientation to get palm normal
      const q = new THREE.Quaternion(wristOri.x, wristOri.y, wristOri.z, wristOri.w);
      hand.palmNormal.set(0, 1, 0).applyQuaternion(q);
    }
    
    // Calculate derived values
    hand.palmOpenness = calculatePalmOpenness(hand);
    hand.pinchDistance = calculatePinchDistance(hand);
  }
  
  /**
   * Get left hand data
   * @returns {Object}
   */
  getLeftHand() {
    return this.leftHand;
  }
  
  /**
   * Get right hand data
   * @returns {Object}
   */
  getRightHand() {
    return this.rightHand;
  }
  
  /**
   * Get left hand velocity
   * @returns {THREE.Vector3}
   */
  getLeftVelocity() {
    return this.leftVelocity;
  }
  
  /**
   * Get right hand velocity
   * @returns {THREE.Vector3}
   */
  getRightVelocity() {
    return this.rightVelocity;
  }
  
  /**
   * Check if left hand is being tracked
   * @returns {boolean}
   */
  isLeftTracked() {
    return this.leftTracked;
  }
  
  /**
   * Check if right hand is being tracked
   * @returns {boolean}
   */
  isRightTracked() {
    return this.rightTracked;
  }
  
  /**
   * Check if both hands are being tracked
   * @returns {boolean}
   */
  areBothTracked() {
    return this.leftTracked && this.rightTracked;
  }
  
  /**
   * Get a specific joint position
   * @param {'left'|'right'} handedness
   * @param {string} jointName - From JOINT_NAMES
   * @returns {THREE.Vector3|null}
   */
  getJointPosition(handedness, jointName) {
    const hand = handedness === 'left' ? this.leftHand : this.rightHand;
    const joint = hand.joints[jointName];
    
    if (!joint) return null;
    
    return new THREE.Vector3(
      joint.position.x,
      joint.position.y,
      joint.position.z
    );
  }
  
  /**
   * Get the pinch point (midpoint between thumb and index tips)
   * @param {'left'|'right'} handedness
   * @returns {THREE.Vector3|null}
   */
  getPinchPoint(handedness) {
    const hand = handedness === 'left' ? this.leftHand : this.rightHand;
    
    const thumbTip = hand.joints['thumb-tip'];
    const indexTip = hand.joints['index-finger-tip'];
    
    if (!thumbTip || !indexTip) return null;
    
    return new THREE.Vector3(
      (thumbTip.position.x + indexTip.position.x) / 2,
      (thumbTip.position.y + indexTip.position.y) / 2,
      (thumbTip.position.z + indexTip.position.z) / 2
    );
  }
  
  /**
   * Get distance between the two palms
   * @returns {number}
   */
  getPalmDistance() {
    if (!this.leftTracked || !this.rightTracked) return Infinity;
    return this.leftHand.palmPosition.distanceTo(this.rightHand.palmPosition);
  }
}


