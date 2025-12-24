/**
 * Leviathan WebXR - Ocean Reference Volume
 * 
 * Minimal visual representation of the Pacific Ocean volume.
 * Provides spatial orientation without obscuring whale data.
 * 
 * Components:
 * - Wireframe bounding box
 * - Depth reference planes
 * - Subtle horizon gradient
 * - Optional grid for scale reference
 */

import * as THREE from 'three';
import { PACIFIC_BOUNDS, OCEAN_VISUAL, WORLD_SCALE } from '../utils/Constants.js';

export class OceanVolume {
  /**
   * Create ocean volume visualization
   * @param {Projection} projection - Geo projection for bounds calculation
   */
  constructor(projection) {
    this.projection = projection;
    
    // Root group for all ocean visuals
    this.group = new THREE.Group();
    this.group.name = 'OceanVolume';
    
    // Calculate world-space bounds
    this.worldBounds = projection.getWorldBounds(
      PACIFIC_BOUNDS.latMin,
      PACIFIC_BOUNDS.latMax,
      PACIFIC_BOUNDS.lonMin,
      PACIFIC_BOUNDS.lonMax,
      PACIFIC_BOUNDS.depthMax
    );
    
    // Build visual components
    this._createBoundingBox();
    this._createDepthPlanes();
    this._createHorizonPlane();
    
    console.log('Ocean volume created:', this.worldBounds);
  }
  
  /**
   * Create wireframe bounding box
   * @private
   */
  _createBoundingBox() {
    const { size, center } = this.worldBounds;
    
    // Create box geometry
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    
    // Edges only (wireframe)
    const edges = new THREE.EdgesGeometry(geometry);
    
    // Line material with subtle color
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(0.2, 0.4, 0.6),
      transparent: true,
      opacity: OCEAN_VISUAL.wireframeOpacity,
      depthWrite: false
    });
    
    const wireframe = new THREE.LineSegments(edges, material);
    wireframe.position.set(center[0], center[1], center[2]);
    wireframe.name = 'BoundingBox';
    
    this.group.add(wireframe);
    this.boundingBox = wireframe;
    
    // Clean up
    geometry.dispose();
  }
  
  /**
   * Create horizontal depth reference planes
   * @private
   */
  _createDepthPlanes() {
    const { min, max, size } = this.worldBounds;
    const centerX = (min[0] + max[0]) / 2;
    const centerZ = (min[2] + max[2]) / 2;
    
    const depthPlanesGroup = new THREE.Group();
    depthPlanesGroup.name = 'DepthPlanes';
    
    // Create a plane for each depth marker
    for (const depth of OCEAN_VISUAL.depthMarkers) {
      const y = -depth * WORLD_SCALE;
      
      // Skip if outside bounds
      if (y < min[1] || y > max[1]) continue;
      
      // Create grid helper for this depth
      const gridSize = Math.max(size[0], size[2]);
      const divisions = 10;
      
      const grid = new THREE.GridHelper(
        gridSize,
        divisions,
        new THREE.Color(0.15, 0.25, 0.35), // Center line color
        new THREE.Color(0.1, 0.18, 0.25)   // Grid color
      );
      
      grid.position.set(centerX, y, centerZ);
      grid.material.transparent = true;
      grid.material.opacity = 0.08 + (depth / PACIFIC_BOUNDS.depthMax) * 0.05;
      grid.material.depthWrite = false;
      grid.name = `DepthPlane_${depth}m`;
      
      depthPlanesGroup.add(grid);
    }
    
    this.group.add(depthPlanesGroup);
    this.depthPlanes = depthPlanesGroup;
  }
  
  /**
   * Create subtle horizon plane at surface
   * @private
   */
  _createHorizonPlane() {
    const { min, max, center, size } = this.worldBounds;
    
    // Create plane geometry
    const geometry = new THREE.PlaneGeometry(size[0] * 1.5, size[2] * 1.5);
    
    // Custom shader material for gradient fade
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColorCenter: { value: new THREE.Color(0.08, 0.15, 0.22) },
        uColorEdge: { value: new THREE.Color(0.04, 0.08, 0.12) },
        uOpacity: { value: 0.4 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorCenter;
        uniform vec3 uColorEdge;
        uniform float uOpacity;
        varying vec2 vUv;
        
        void main() {
          // Radial gradient from center
          vec2 centered = vUv - 0.5;
          float dist = length(centered) * 2.0;
          float fade = 1.0 - smoothstep(0.3, 1.0, dist);
          
          vec3 color = mix(uColorEdge, uColorCenter, fade);
          gl_FragColor = vec4(color, uOpacity * fade);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    
    const horizon = new THREE.Mesh(geometry, material);
    horizon.rotation.x = -Math.PI / 2; // Lay flat
    horizon.position.set(center[0], 0.001, center[2]); // Just above y=0
    horizon.name = 'HorizonPlane';
    
    this.group.add(horizon);
    this.horizonPlane = horizon;
  }
  
  /**
   * Get the ocean volume group to add to scene
   * @returns {THREE.Group}
   */
  getObject() {
    return this.group;
  }
  
  /**
   * Get world-space bounds
   * @returns {Object}
   */
  getBounds() {
    return this.worldBounds;
  }
  
  /**
   * Set visibility of all ocean visuals
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.group.visible = visible;
  }
  
  /**
   * Set opacity of all ocean elements
   * @param {number} opacity - [0, 1]
   */
  setOpacity(opacity) {
    if (this.boundingBox) {
      this.boundingBox.material.opacity = OCEAN_VISUAL.wireframeOpacity * opacity;
    }
    
    if (this.horizonPlane) {
      this.horizonPlane.material.uniforms.uOpacity.value = 0.4 * opacity;
    }
    
    if (this.depthPlanes) {
      this.depthPlanes.traverse((child) => {
        if (child.material) {
          child.material.opacity *= opacity;
        }
      });
    }
  }
  
  /**
   * Update for camera position (fade distant elements)
   * @param {THREE.Vector3} cameraPosition
   */
  update(cameraPosition) {
    // Could implement distance-based fading here if needed
  }
  
  /**
   * Dispose of all resources
   */
  dispose() {
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.uniforms) {
          // Shader material - no textures to dispose
        }
        child.material.dispose();
      }
    });
  }
}


