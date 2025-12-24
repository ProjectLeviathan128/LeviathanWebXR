/**
 * Leviathan WebXR - Inspect Gesture Handler
 * 
 * AUDIT FOLLOW-UP: Spatial Inspection
 * 
 * Handles right-hand pinch gesture for inspecting whale data regions.
 * Now uses SpatialGrid for O(cells) queries instead of O(n) point scans.
 * 
 * WHY REGION QUERIES, NOT POINT QUERIES:
 * - Individual point iteration causes frame drops
 * - Aggregated regions provide honest summaries
 * - Grid intersection scales to any dataset size
 */

import * as THREE from 'three';
import { GESTURE, SPECIES } from '../utils/Constants.js';

export class InspectGesture {
  /**
   * Create inspect gesture handler
   * AUDIT FOLLOW-UP: Now uses SpatialGrid for safe queries
   * @param {Scene} scene - For adding inspection visuals
   */
  constructor(scene) {
    this.scene = scene;
    
    // Inspection state
    this.isActive = false;
    this.inspectPosition = new THREE.Vector3();
    this.inspectRadius = 0.5; // World units (~50km)
    
    // AUDIT FOLLOW-UP: SpatialGrid reference (set via setSpatialGrid)
    this.spatialGrid = null;
    
    // Query result cache
    this.lastResult = null;
    this.lastQueryTime = 0;
    this.queryInterval = 100; // AUDIT FOLLOW-UP: Limit query rate to ~10Hz
    
    // Visual feedback
    this.inspectSphere = null;
    this.resultPanel = null;
    this.speciesBars = [];
    
    this._createVisuals();
  }
  
  /**
   * AUDIT FOLLOW-UP: Set spatial grid reference for safe queries
   * @param {SpatialGrid} grid
   */
  setSpatialGrid(grid) {
    this.spatialGrid = grid;
  }
  
  /**
   * Create visual feedback elements
   * AUDIT FOLLOW-UP: Enhanced visuals for inspection results
   * @private
   */
  _createVisuals() {
    // Inspection sphere (translucent volume indicator)
    const sphereGeom = new THREE.SphereGeometry(this.inspectRadius, 24, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x4a9eff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.BackSide
    });
    
    this.inspectSphere = new THREE.Mesh(sphereGeom, sphereMat);
    this.inspectSphere.visible = false;
    this.inspectSphere.name = 'InspectSphere';
    this.scene.addToUI(this.inspectSphere);
    
    // Wireframe outline for sphere
    const wireGeom = new THREE.SphereGeometry(this.inspectRadius, 16, 12);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x4a9eff,
      transparent: true,
      opacity: 0.4,
      wireframe: true,
      depthWrite: false
    });
    this.inspectWireframe = new THREE.Mesh(wireGeom, wireMat);
    this.inspectSphere.add(this.inspectWireframe);
    
    // Result panel group (positioned relative to sphere)
    this.resultPanel = new THREE.Group();
    this.resultPanel.name = 'InspectResultPanel';
    this.resultPanel.visible = false;
    this.scene.addToUI(this.resultPanel);
    
    // Create result display components
    this._createResultDisplay();
  }
  
  /**
   * Create result display panel with species bars
   * @private
   */
  _createResultDisplay() {
    // Background panel
    const panelGeom = new THREE.PlaneGeometry(0.25, 0.15);
    const panelMat = new THREE.MeshBasicMaterial({
      color: 0x0a1428,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const panel = new THREE.Mesh(panelGeom, panelMat);
    this.resultPanel.add(panel);
    
    // Create species bars (8 species)
    const barWidth = 0.02;
    const barSpacing = 0.025;
    const startX = -0.09;
    const barY = -0.02;
    
    const speciesColors = [
      0x3366ee, // Blue whale
      0x55cc88, // Humpback
      0x999999, // Gray
      0xee8833, // Fin
      0xcc5599, // Sperm
      0x333333, // Orca
      0xbbcc66, // Minke
      0xee3355  // Right
    ];
    
    for (let i = 0; i < 8; i++) {
      const barGeom = new THREE.PlaneGeometry(barWidth, 0.001);
      const barMat = new THREE.MeshBasicMaterial({
        color: speciesColors[i],
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const bar = new THREE.Mesh(barGeom, barMat);
      bar.position.set(startX + i * barSpacing, barY, 0.001);
      this.resultPanel.add(bar);
      this.speciesBars.push(bar);
    }
    
    // Text canvas for count display
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 256;
    this.textCanvas.height = 128;
    
    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    this.textTexture.minFilter = THREE.LinearFilter;
    
    const textMat = new THREE.MeshBasicMaterial({
      map: this.textTexture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const textPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.1),
      textMat
    );
    textPlane.position.set(0, 0.03, 0.002);
    this.resultPanel.add(textPlane);
    this.textPlane = textPlane;
  }
  
  /**
   * Activate inspection at position
   * @param {THREE.Vector3} position - World position of pinch
   */
  activate(position) {
    this.isActive = true;
    this.inspectPosition.copy(position);
    
    // Update visual
    this.inspectSphere.position.copy(position);
    this.inspectSphere.visible = true;
    
    // Position result panel above and to the side
    this.resultPanel.position.copy(position);
    this.resultPanel.position.y += this.inspectRadius + 0.1;
    this.resultPanel.visible = true;
    
    // Force immediate query
    this.lastQueryTime = 0;
  }
  
  /**
   * Deactivate inspection
   */
  deactivate() {
    this.isActive = false;
    this.inspectSphere.visible = false;
    this.resultPanel.visible = false;
    this.lastResult = null;
  }
  
  /**
   * Update inspection (call each frame when active)
   * AUDIT FOLLOW-UP: Rate-limited grid queries, no O(n) scanning
   * @param {THREE.Vector3} position - Current pinch position
   * @param {THREE.Camera} camera - For billboarding result panel
   */
  update(position, camera) {
    if (!this.isActive) return;
    
    // Update position
    this.inspectPosition.copy(position);
    this.inspectSphere.position.copy(position);
    
    // Position result panel
    this.resultPanel.position.copy(position);
    this.resultPanel.position.y += this.inspectRadius + 0.12;
    
    // Billboard result panel to face camera
    if (camera) {
      this.resultPanel.lookAt(camera.position);
    }
    
    // AUDIT FOLLOW-UP: Rate-limited query (10Hz max)
    const now = performance.now();
    if (now - this.lastQueryTime >= this.queryInterval) {
      this.lastQueryTime = now;
      this._performQuery();
    }
  }
  
  /**
   * Perform spatial grid query
   * AUDIT FOLLOW-UP: This is the safe query path - O(cells) not O(n)
   * @private
   */
  _performQuery() {
    if (!this.spatialGrid || !this.spatialGrid.isBuilt()) {
      return;
    }
    
    // Query spatial grid with sphere
    const center = [
      this.inspectPosition.x,
      this.inspectPosition.y,
      this.inspectPosition.z
    ];
    
    this.lastResult = this.spatialGrid.querySphere(center, this.inspectRadius);
    
    // Update visualization
    this._updateResultDisplay();
  }
  
  /**
   * Update result display based on query result
   * @private
   */
  _updateResultDisplay() {
    if (!this.lastResult) return;
    
    const result = this.lastResult;
    
    // Update species bars
    const maxCount = Math.max(1, ...result.speciesHistogram);
    const maxBarHeight = 0.06;
    
    for (let i = 0; i < 8; i++) {
      const count = result.speciesHistogram[i];
      const height = (count / maxCount) * maxBarHeight;
      
      // Update bar scale and position
      this.speciesBars[i].scale.y = Math.max(1, height * 1000);
      this.speciesBars[i].position.y = -0.02 + height / 2;
    }
    
    // Update text
    this._updateTextDisplay(result);
  }
  
  /**
   * Update text display on canvas
   * @private
   */
  _updateTextDisplay(result) {
    const ctx = this.textCanvas.getContext('2d');
    const w = this.textCanvas.width;
    const h = this.textCanvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Total count
    ctx.fillStyle = '#c5d4e0';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${result.totalCount} sightings`, w/2, 40);
    
    // Dominant species
    const speciesName = SPECIES[result.dominantSpecies]?.name || 'Unknown';
    ctx.font = '20px monospace';
    ctx.fillStyle = '#8899aa';
    ctx.fillText(speciesName, w/2, 70);
    
    // Time span
    if (result.totalCount > 0) {
      const startYear = Math.floor(1994 + result.timeSpan[0] * 30);
      const endYear = Math.floor(1994 + result.timeSpan[1] * 30);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#667788';
      ctx.fillText(`${startYear} - ${endYear}`, w/2, 100);
    }
    
    this.textTexture.needsUpdate = true;
  }
  
  /**
   * Get inspection state
   * @returns {boolean}
   */
  getIsActive() {
    return this.isActive;
  }
  
  /**
   * Get inspect position
   * @returns {THREE.Vector3}
   */
  getPosition() {
    return this.inspectPosition;
  }
  
  /**
   * Get last query result
   * @returns {Object|null}
   */
  getLastResult() {
    return this.lastResult;
  }
  
  /**
   * Set inspection radius
   * @param {number} radius - World units
   */
  setRadius(radius) {
    this.inspectRadius = radius;
    this.inspectSphere.scale.setScalar(radius / 0.5); // 0.5 is original geometry radius
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    if (this.inspectSphere) {
      this.inspectSphere.geometry.dispose();
      this.inspectSphere.material.dispose();
    }
    if (this.textTexture) {
      this.textTexture.dispose();
    }
  }
}
