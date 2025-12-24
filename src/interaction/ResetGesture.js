/**
 * Leviathan WebXR - Reset Gesture Handler
 * 
 * Handles the two-hand reset gesture.
 * Provides visual progress feedback during hold.
 */

import * as THREE from 'three';
import { GESTURE, TIME_DEFAULTS } from '../utils/Constants.js';

export class ResetGesture {
  /**
   * Create reset gesture handler
   * @param {TimeSystem} timeSystem
   * @param {Scene} scene
   */
  constructor(timeSystem, scene) {
    this.timeSystem = timeSystem;
    this.scene = scene;
    
    // Progress (0-1)
    this.progress = 0;
    
    // Visual feedback
    this.progressRing = null;
    
    // Callbacks
    this.onReset = null;
    
    this._createVisuals();
  }
  
  /**
   * Create progress ring visual
   * @private
   */
  _createVisuals() {
    // Create a ring that fills as user holds gesture
    const geometry = new THREE.RingGeometry(0.08, 0.1, 32, 1, 0, 0);
    const material = new THREE.MeshBasicMaterial({
      color: 0x4aff9f,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    this.progressRing = new THREE.Mesh(geometry, material);
    this.progressRing.visible = false;
    this.progressRing.name = 'ResetProgressRing';
    
    this.scene.addToUI(this.progressRing);
  }
  
  /**
   * Update progress
   * @param {number} progress - [0, 1]
   * @param {THREE.Vector3} leftPalm - Left palm position
   * @param {THREE.Vector3} rightPalm - Right palm position
   */
  updateProgress(progress, leftPalm, rightPalm) {
    this.progress = progress;
    
    if (progress <= 0) {
      this.progressRing.visible = false;
      return;
    }
    
    // Position ring between the two palms
    if (leftPalm && rightPalm) {
      this.progressRing.position.lerpVectors(leftPalm, rightPalm, 0.5);
      
      // Orient toward camera (billboarding would need camera reference)
      this.progressRing.rotation.x = -Math.PI / 4;
    }
    
    // Update ring geometry to show progress
    this._updateRingProgress(progress);
    
    this.progressRing.visible = true;
  }
  
  /**
   * Update ring geometry for progress
   * @private
   */
  _updateRingProgress(progress) {
    // Recreate geometry with correct arc
    // This is slightly expensive but only happens during gesture
    const theta = progress * Math.PI * 2;
    
    this.progressRing.geometry.dispose();
    this.progressRing.geometry = new THREE.RingGeometry(
      0.08, 0.1, 32, 1, 
      -Math.PI / 2,  // Start at top
      theta          // Arc length based on progress
    );
  }
  
  /**
   * Execute reset
   */
  execute() {
    // Reset time system
    this.timeSystem.reset();
    
    // Hide progress ring
    this.progress = 0;
    this.progressRing.visible = false;
    
    // Fire callback
    if (this.onReset) {
      this.onReset();
    }
    
    console.log('Reset executed');
  }
  
  /**
   * Get current progress
   * @returns {number}
   */
  getProgress() {
    return this.progress;
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    if (this.progressRing) {
      this.progressRing.geometry.dispose();
      this.progressRing.material.dispose();
    }
  }
}


