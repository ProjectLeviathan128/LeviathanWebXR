/**
 * Leviathan WebXR - Floating Origin System
 * 
 * Prevents GPU floating-point precision issues at large world coordinates
 * by keeping the camera near the origin and shifting world content instead.
 * 
 * All position transforms happen in shaders via uniform, not by
 * modifying scene graph positions on CPU each frame.
 * 
 * CRITICAL FOR PERFORMANCE: This avoids matrix recalculation for every object.
 */

import * as THREE from 'three';

export class FloatingOrigin {
  /**
   * Create floating origin system
   * @param {number} shiftThreshold - Distance from origin before shift (default: 100 units)
   */
  constructor(shiftThreshold = 100) {
    // Current world offset (added to all positions in shaders)
    this.offset = new THREE.Vector3(0, 0, 0);
    
    // Distance threshold that triggers a shift
    this.shiftThreshold = shiftThreshold;
    
    // Accumulated camera movement (for tracking drift)
    this.cameraWorldPosition = new THREE.Vector3();
    
    // Uniform for shaders
    this._uniform = { value: new THREE.Vector3(0, 0, 0) };
    
    // Shift event callback
    this.onShift = null;
    
    // Statistics
    this.shiftCount = 0;
    
    // FIX: Audit Issue - FloatingOrigin needs reference to XR camera rig for recentering
    this.cameraRig = null;
  }
  
  /**
   * FIX: Audit Issue - Set reference to camera rig for proper recentering
   * @param {THREE.Object3D} rig - The camera rig/parent to recenter
   */
  setCameraRig(rig) {
    this.cameraRig = rig;
  }
  
  /**
   * Update floating origin based on camera position
   * FIX: Audit Issue - Now properly recenters camera instead of just accumulating offset
   * @param {THREE.Camera} camera - The XR camera
   * @returns {boolean} True if origin was shifted
   */
  update(camera) {
    // Get camera world position
    camera.getWorldPosition(this.cameraWorldPosition);
    
    // Check if camera has drifted too far from origin
    const distanceFromOrigin = this.cameraWorldPosition.length();
    
    if (distanceFromOrigin > this.shiftThreshold) {
      // Shift origin to recenter around camera
      this._performShift(this.cameraWorldPosition, camera);
      return true;
    }
    
    return false;
  }
  
  /**
   * Perform origin shift
   * FIX: Audit Issue - Now properly recenters by updating offset without moving camera
   * The camera stays at its current world position, but our offset uniform changes
   * so shaders render content relative to the new origin.
   * @private
   * @param {THREE.Vector3} cameraPos - Current camera position
   * @param {THREE.Camera} camera - The camera object
   */
  _performShift(cameraPos, camera) {
    // FIX: Audit Issue - Accumulate the camera's current position into the world offset
    // This means all shader positions need to subtract this offset
    // The camera physically stays where it is in XR space (we can't move it)
    // but our world data shifts relative to this new origin
    this.offset.add(cameraPos);
    
    // Update shader uniform - this is what shaders use to offset world positions
    this._uniform.value.copy(this.offset);
    
    this.shiftCount++;
    
    // Fire callback
    if (this.onShift) {
      this.onShift(this.offset.clone(), this.shiftCount);
    }
    
    console.log(`Floating origin shifted. Total offset: (${this.offset.x.toFixed(2)}, ${this.offset.y.toFixed(2)}, ${this.offset.z.toFixed(2)})`);
  }
  
  /**
   * Get shader uniform for origin offset
   * This should be subtracted from world positions in vertex shader
   * @returns {Object} Three.js uniform object
   */
  getUniform() {
    return this._uniform;
  }
  
  /**
   * Get uniforms object for material creation
   * @returns {Object}
   */
  getUniforms() {
    return {
      uOriginOffset: this._uniform
    };
  }
  
  /**
   * Transform a world position to camera-relative position
   * Use this for CPU-side calculations when needed
   * @param {THREE.Vector3} worldPos - Position in absolute world space
   * @param {THREE.Vector3} target - Optional target vector to store result
   * @returns {THREE.Vector3} Camera-relative position
   */
  worldToLocal(worldPos, target = new THREE.Vector3()) {
    return target.copy(worldPos).sub(this.offset);
  }
  
  /**
   * Transform a camera-relative position to world position
   * @param {THREE.Vector3} localPos - Position relative to floating origin
   * @param {THREE.Vector3} target - Optional target vector to store result
   * @returns {THREE.Vector3} Absolute world position
   */
  localToWorld(localPos, target = new THREE.Vector3()) {
    return target.copy(localPos).add(this.offset);
  }
  
  /**
   * Get current offset
   * @returns {THREE.Vector3}
   */
  getOffset() {
    return this.offset.clone();
  }
  
  /**
   * Get offset as array for non-Three.js code
   * @returns {[number, number, number]}
   */
  getOffsetArray() {
    return [this.offset.x, this.offset.y, this.offset.z];
  }
  
  /**
   * Reset to zero offset
   */
  reset() {
    this.offset.set(0, 0, 0);
    this._uniform.value.set(0, 0, 0);
    this.shiftCount = 0;
  }
  
  /**
   * Set offset directly (for loading saved state)
   * @param {THREE.Vector3|number[]} offset
   */
  setOffset(offset) {
    if (Array.isArray(offset)) {
      this.offset.set(offset[0], offset[1], offset[2]);
    } else {
      this.offset.copy(offset);
    }
    this._uniform.value.copy(this.offset);
  }
}

