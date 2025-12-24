/**
 * Leviathan WebXR - Whale Instance Renderer
 * 
 * GPU-instanced rendering of whale presence data.
 * Single draw call for entire dataset using InstancedBufferGeometry.
 * 
 * CRITICAL PERFORMANCE COMPONENT:
 * - All per-instance data stored in TypedArrays
 * - Time filtering happens in vertex shader
 * - No JavaScript iteration per frame
 */

import * as THREE from 'three';
import { RENDER_BUDGET, WHALE_VISUAL, SPECIES_COLORS_FLAT } from '../utils/Constants.js';

// Inline shaders (for reliability without build tools)
// UNCERTAINTY VISUALIZATION: Shaders encode confidence visually
const WHALE_VERT = `
// Global uniforms
uniform float uTime;
uniform float uTimeWindow;
uniform vec3 uOriginOffset;
uniform float uBaseSize;
uniform float uQuality;
uniform float uShowUncertainty; // UNCERTAINTY: Toggle for uncertainty visualization

// Per-instance attributes
attribute vec3 instancePosition;
attribute float instanceTime;
attribute float instanceSpecies;
attribute float instanceDensity;
attribute float instanceConfidence; // UNCERTAINTY: Confidence level [0-1]

// Varyings
varying float vTimeFade;
varying float vSpecies;
varying float vDensity;
varying float vDistanceFade;
varying float vConfidence; // UNCERTAINTY: Pass to fragment shader

void main() {
  float timeDist = abs(instanceTime - uTime);
  vTimeFade = 1.0 - smoothstep(0.0, uTimeWindow, timeDist);
  
  if (vTimeFade < 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  
  vec3 worldPos = instancePosition - uOriginOffset;
  vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
  float distToCamera = -mvPosition.z;
  
  vDistanceFade = 1.0 - smoothstep(1.0, 10.0, distToCamera);
  
  float combinedFade = vTimeFade * vDistanceFade * uQuality;
  if (combinedFade < 0.01) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  
  vSpecies = instanceSpecies;
  vDensity = instanceDensity;
  vConfidence = instanceConfidence;
  
  float densityScale = 0.5 + instanceDensity * 0.5;
  float perspectiveScale = 300.0 / max(distToCamera, 0.1);
  float timeScale = 0.3 + vTimeFade * 0.7;
  
  // UNCERTAINTY: Low confidence = larger radius (more uncertain position)
  // High confidence = tighter point (more precise)
  float confidenceScale = 1.0;
  if (uShowUncertainty > 0.5) {
    // Inverse relationship: low confidence = bigger (fuzzier)
    confidenceScale = 1.0 + (1.0 - instanceConfidence) * 0.8;
  }
  
  gl_PointSize = uBaseSize * densityScale * perspectiveScale * timeScale * uQuality * confidenceScale;
  gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
  
  gl_Position = projectionMatrix * mvPosition;
}
`;

const WHALE_FRAG = `
uniform vec3 uSpeciesColors[8];
uniform float uOpacity;
uniform float uShowUncertainty; // UNCERTAINTY: Toggle for uncertainty visualization

varying float vTimeFade;
varying float vSpecies;
varying float vDensity;
varying float vDistanceFade;
varying float vConfidence; // UNCERTAINTY: Confidence level [0-1]

// UNCERTAINTY: Simple pseudo-random for radial noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float visibility = vTimeFade * vDistanceFade;
  if (visibility < 0.01) discard;
  
  vec2 centered = gl_PointCoord - 0.5;
  float dist = length(centered) * 2.0;
  
  // UNCERTAINTY: Confidence affects edge sharpness
  // High confidence = sharp crisp edge
  // Low confidence = soft fuzzy edge (uncertainty looks uncertain)
  float edgeStart = 0.6;
  float edgeEnd = 1.0;
  
  if (uShowUncertainty > 0.5) {
    // Low confidence: earlier fade start = softer, more diffuse appearance
    edgeStart = mix(0.3, 0.7, vConfidence);
    edgeEnd = mix(0.8, 1.0, vConfidence);
  }
  
  float alpha = 1.0 - smoothstep(edgeStart, edgeEnd, dist);
  
  // UNCERTAINTY: Add radial noise for low confidence points (fuzzy uncertainty)
  if (uShowUncertainty > 0.5 && vConfidence < 0.7) {
    float noise = hash(gl_PointCoord * 10.0 + vSpecies) * 0.4;
    float uncertaintyNoise = (0.7 - vConfidence) * noise;
    alpha *= (1.0 - uncertaintyNoise);
  }
  
  if (alpha < 0.01) discard;
  
  int speciesIndex = int(clamp(vSpecies, 0.0, 7.0));
  vec3 baseColor = uSpeciesColors[speciesIndex];
  
  float brightness = 0.7 + vDensity * 0.3;
  vec3 color = baseColor * brightness;
  
  // UNCERTAINTY: Subtle color desaturation for low confidence
  // Uncertain data should look less vibrant, more muted
  if (uShowUncertainty > 0.5 && vConfidence < 0.5) {
    float desatAmount = (0.5 - vConfidence) * 0.4;
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    // Shift toward cooler, desaturated tone
    color = mix(color, vec3(luminance * 0.9, luminance * 0.95, luminance * 1.05), desatAmount);
  }
  
  // Center glow - stronger for high confidence (crisp and clear)
  float glowStrength = 0.2;
  if (uShowUncertainty > 0.5) {
    glowStrength = 0.1 + vConfidence * 0.2; // High conf = brighter core
  }
  float glow = 1.0 - smoothstep(0.0, 0.4, dist);
  color += glow * glowStrength;
  
  float finalAlpha = alpha * visibility * uOpacity;
  gl_FragColor = vec4(color * finalAlpha, finalAlpha);
}
`;

export class WhaleInstanceRenderer {
  /**
   * Create whale instance renderer
   * FIX: Audit Issue - Performance safety: use maxVisibleInstances as default cap
   * @param {TimeSystem} timeSystem - Time controller for uniforms
   * @param {FloatingOrigin} floatingOrigin - Origin offset system
   * @param {number} maxInstances - Maximum instance count
   */
  constructor(timeSystem, floatingOrigin, maxInstances = RENDER_BUDGET.maxVisibleInstances) {
    this.timeSystem = timeSystem;
    this.floatingOrigin = floatingOrigin;
    // FIX: Audit Issue - Cap max instances to visible budget for Quest 2
    this.maxInstances = Math.min(maxInstances, RENDER_BUDGET.maxVisibleInstances);
    
    // Current instance count
    this.instanceCount = 0;
    
    // FIX: Audit Issue - Pre-allocate buffers at capped size only
    // This prevents over-allocation on Quest 2
    this.positions = new Float32Array(this.maxInstances * 3);
    this.times = new Float32Array(this.maxInstances);
    this.species = new Float32Array(this.maxInstances); // Using float for shader compatibility
    this.densities = new Float32Array(this.maxInstances);
    
    // UNCERTAINTY: Confidence buffer - stores per-instance confidence [0-1]
    // Derived from density and aggregation level at load time
    this.confidences = new Float32Array(this.maxInstances);
    
    // UNCERTAINTY: Toggle state
    this.showUncertainty = true; // Default: ON for scientific mode
    
    // Three.js objects
    this.geometry = null;
    this.material = null;
    this.mesh = null;
    
    // Quality level (from performance monitor)
    this.qualityLevel = 1.0;
    
    // FIX: Audit Issue - Track if buffers have been allocated to prevent reallocation
    this.buffersAllocated = false;
    
    this._init();
  }
  
  /**
   * Initialize geometry and material
   * @private
   */
  _init() {
    // Create instanced buffer geometry
    // Base geometry is just a single point
    this.geometry = new THREE.InstancedBufferGeometry();
    
    // Single vertex at origin (will be transformed by instances)
    const basePositions = new Float32Array([0, 0, 0]);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(basePositions, 3));
    
    // Instance attributes
    this.positionAttribute = new THREE.InstancedBufferAttribute(this.positions, 3);
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('instancePosition', this.positionAttribute);
    
    this.timeAttribute = new THREE.InstancedBufferAttribute(this.times, 1);
    this.timeAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('instanceTime', this.timeAttribute);
    
    this.speciesAttribute = new THREE.InstancedBufferAttribute(this.species, 1);
    this.speciesAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('instanceSpecies', this.speciesAttribute);
    
    this.densityAttribute = new THREE.InstancedBufferAttribute(this.densities, 1);
    this.densityAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('instanceDensity', this.densityAttribute);
    
    // UNCERTAINTY: Confidence attribute - per-instance confidence level
    this.confidenceAttribute = new THREE.InstancedBufferAttribute(this.confidences, 1);
    this.confidenceAttribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('instanceConfidence', this.confidenceAttribute);
    
    // Convert species colors to Vector3 array
    const speciesColorVectors = [];
    for (let i = 0; i < 8; i++) {
      speciesColorVectors.push(new THREE.Vector3(
        SPECIES_COLORS_FLAT[i * 3],
        SPECIES_COLORS_FLAT[i * 3 + 1],
        SPECIES_COLORS_FLAT[i * 3 + 2]
      ));
    }
    
    // Create shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.timeSystem.getUniforms().uTime,
        uTimeWindow: this.timeSystem.getUniforms().uTimeWindow,
        uOriginOffset: this.floatingOrigin.getUniform(),
        uBaseSize: { value: WHALE_VISUAL.baseSize * 100 }, // Scale for gl_PointSize
        uOpacity: { value: WHALE_VISUAL.baseOpacity },
        uQuality: { value: this.qualityLevel },
        uSpeciesColors: { value: speciesColorVectors },
        // UNCERTAINTY: Toggle for uncertainty visualization
        uShowUncertainty: { value: this.showUncertainty ? 1.0 : 0.0 }
      },
      vertexShader: WHALE_VERT,
      fragmentShader: WHALE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending // Nice glow effect
    });
    
    // Create points mesh
    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false; // We handle culling in shader
    this.mesh.name = 'WhaleInstances';
  }
  
  /**
   * Load whale data into instance buffers
   * FIX: Audit Issue - No per-frame reallocations, cap at max instances
   * UNCERTAINTY: Now includes confidence calculation from existing data
   * @param {Object} processedData - From DataProcessor
   * @param {Float32Array} processedData.positions - [x,y,z, x,y,z, ...]
   * @param {Float32Array} processedData.times - Normalized times
   * @param {Uint8Array|Float32Array} processedData.species - Species IDs
   * @param {Float32Array} processedData.densities - Density weights
   * @param {Float32Array} [processedData.confidences] - Optional pre-computed confidence
   * @param {number} processedData.count - Number of records
   * @param {number} [processedData.lodLevel] - LOD level (0=full, 1=medium, 2=coarse)
   */
  loadData(processedData) {
    const { positions, times, species, densities, confidences, count, lodLevel = 0 } = processedData;
    
    // FIX: Audit Issue - Performance safety: hard cap at maxInstances
    if (count > this.maxInstances) {
      console.warn(`FIX: Data count ${count} exceeds max instances ${this.maxInstances}. Truncating for Quest 2 performance.`);
    }
    
    const loadCount = Math.min(count, this.maxInstances);
    
    // FIX: Audit Issue - Reuse existing buffers, no reallocation
    // Copy data into pre-allocated buffers
    this.positions.set(positions.subarray(0, loadCount * 3));
    this.times.set(times.subarray(0, loadCount));
    
    // Handle species (may be Uint8Array)
    for (let i = 0; i < loadCount; i++) {
      this.species[i] = species[i];
    }
    
    // Handle densities (normalize if needed)
    if (densities) {
      this.densities.set(densities.subarray(0, loadCount));
    } else {
      // Default density of 0.5
      this.densities.fill(0.5, 0, loadCount);
    }
    
    // UNCERTAINTY: Calculate or use provided confidence values
    // Confidence is derived from existing data - no inference, no new datasets
    if (confidences) {
      // Use pre-computed confidence if provided
      this.confidences.set(confidences.subarray(0, loadCount));
    } else {
      // UNCERTAINTY: Derive confidence from density and LOD level
      // This uses only existing attributes - no scientific claims
      this._computeConfidenceFromData(loadCount, lodLevel);
    }
    
    this.instanceCount = loadCount;
    this.buffersAllocated = true;
    
    // Update geometry (marks buffers as needing upload, no reallocation)
    this._updateGeometry();
    
    console.log(`UNCERTAINTY: Loaded ${loadCount} whale instances with confidence visualization`);
  }
  
  /**
   * UNCERTAINTY: Compute confidence values from existing density and LOD data
   * This uses only visualization-level signals - NO scientific inference
   * 
   * Confidence signals:
   * - Higher density = more observations = higher confidence
   * - Higher LOD aggregation = lower spatial precision = lower confidence
   * - Single sightings (low density) = uncertain
   * - Aggregated cells (high density) = more certain about PRESENCE, less about POSITION
   * 
   * @private
   * @param {number} count - Number of instances
   * @param {number} lodLevel - LOD level (0=full, 1=medium, 2=coarse)
   */
  _computeConfidenceFromData(count, lodLevel) {
    // LOD penalty: higher LOD = lower spatial confidence
    // LOD 0 (full): 1.0 multiplier
    // LOD 1 (medium): 0.7 multiplier
    // LOD 2 (coarse): 0.5 multiplier
    const lodConfidenceMultiplier = 1.0 - (lodLevel * 0.25);
    
    for (let i = 0; i < count; i++) {
      const density = this.densities[i];
      
      // UNCERTAINTY: Confidence formula (visualization-only, no science claims)
      // Base confidence from density: low density = single sighting = uncertain
      // We use a sigmoid-like curve to map density [0,1] to confidence [0.2, 0.9]
      // Never fully certain (max 0.9), never fully uncertain (min 0.2)
      const densityConfidence = 0.2 + 0.7 * (1.0 - Math.exp(-density * 3));
      
      // Apply LOD penalty
      const finalConfidence = densityConfidence * lodConfidenceMultiplier;
      
      // Clamp to [0.1, 0.95] - never imply perfect certainty or complete unknowing
      this.confidences[i] = Math.max(0.1, Math.min(0.95, finalConfidence));
    }
    
    console.log(`UNCERTAINTY: Computed confidence values (LOD level ${lodLevel}, multiplier ${lodConfidenceMultiplier.toFixed(2)})`);
  }
  
  /**
   * Update GPU buffers after data change
   * @private
   */
  _updateGeometry() {
    // Update buffer attributes
    this.positionAttribute.needsUpdate = true;
    this.timeAttribute.needsUpdate = true;
    this.speciesAttribute.needsUpdate = true;
    this.densityAttribute.needsUpdate = true;
    this.confidenceAttribute.needsUpdate = true; // UNCERTAINTY: Update confidence buffer
    
    // Set draw range
    this.geometry.instanceCount = this.instanceCount;
  }
  
  /**
   * UNCERTAINTY: Toggle uncertainty visualization on/off
   * When OFF: Render points normally (demo-friendly, crisp)
   * When ON: Enable uncertainty shaders (scientific mode)
   * @param {boolean} show - Whether to show uncertainty
   */
  setShowUncertainty(show) {
    this.showUncertainty = show;
    this.material.uniforms.uShowUncertainty.value = show ? 1.0 : 0.0;
    console.log(`UNCERTAINTY: Visualization ${show ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * UNCERTAINTY: Get current uncertainty visualization state
   * @returns {boolean}
   */
  getShowUncertainty() {
    return this.showUncertainty;
  }
  
  /**
   * Update quality level (from performance monitor)
   * @param {number} quality - [0.3 - 1.0]
   */
  setQuality(quality) {
    this.qualityLevel = quality;
    this.material.uniforms.uQuality.value = quality;
  }
  
  /**
   * Get the renderable mesh
   * @returns {THREE.Points}
   */
  getObject() {
    return this.mesh;
  }
  
  /**
   * Get current instance count
   * @returns {number}
   */
  getInstanceCount() {
    return this.instanceCount;
  }
  
  /**
   * Set base point size
   * @param {number} size
   */
  setBaseSize(size) {
    this.material.uniforms.uBaseSize.value = size * 100;
  }
  
  /**
   * Set base opacity
   * @param {number} opacity
   */
  setOpacity(opacity) {
    this.material.uniforms.uOpacity.value = opacity;
  }
  
  /**
   * Set visibility
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.mesh.visible = visible;
  }
  
  /**
   * Get statistics for performance monitoring
   * @returns {Object}
   */
  getStats() {
    return {
      instances: this.instanceCount,
      maxInstances: this.maxInstances,
      quality: this.qualityLevel,
      showUncertainty: this.showUncertainty // UNCERTAINTY: Include in stats
    };
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

