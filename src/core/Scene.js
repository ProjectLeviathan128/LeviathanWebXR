/**
 * Leviathan WebXR - Scene Manager
 * 
 * Minimal Three.js scene setup optimized for Quest 2 WebXR.
 * Handles renderer, camera, and core scene graph.
 */

import * as THREE from 'three';
import { OCEAN_VISUAL } from '../utils/Constants.js';

export class Scene {
  /**
   * Create the Leviathan scene
   * @param {HTMLElement} container - DOM element to attach renderer
   */
  constructor(container) {
    this.container = container;
    
    // Core Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    
    // Scene layers for organization
    this.oceanLayer = null;
    this.dataLayer = null;
    this.uiLayer = null;
    
    this._init();
  }
  
  /**
   * Initialize Three.js scene, camera, and renderer
   * @private
   */
  _init() {
    // Create scene with deep ocean background
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(
      OCEAN_VISUAL.colorDeep[0],
      OCEAN_VISUAL.colorDeep[1],
      OCEAN_VISUAL.colorDeep[2]
    );
    
    // Create camera (will be controlled by XR)
    this.camera = new THREE.PerspectiveCamera(
      70,                                    // FOV - overridden by XR
      window.innerWidth / window.innerHeight, // Aspect - overridden by XR
      0.01,                                   // Near plane - important for hand tracking
      1000                                    // Far plane
    );
    this.camera.position.set(0, 1.6, 0); // Default standing height
    
    // Create WebGL2 renderer optimized for Quest 2
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,           // Disable for performance
      alpha: false,               // No transparency needed
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(1); // Fixed 1:1 for XR performance
    this.renderer.xr.enabled = true;
    
    // WebGL2 features we need
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // Append to container
    this.container.appendChild(this.renderer.domElement);
    
    // Create organizational layers
    this._createLayers();
    
    // Handle window resize for non-XR preview
    window.addEventListener('resize', () => this._onResize());
  }
  
  /**
   * Create scene layers for organized rendering
   * @private
   */
  _createLayers() {
    // Ocean reference visuals (wireframe, depth markers)
    this.oceanLayer = new THREE.Group();
    this.oceanLayer.name = 'OceanLayer';
    this.scene.add(this.oceanLayer);
    
    // Whale data points
    this.dataLayer = new THREE.Group();
    this.dataLayer.name = 'DataLayer';
    this.scene.add(this.dataLayer);
    
    // Spatial UI elements (inspect labels, etc)
    this.uiLayer = new THREE.Group();
    this.uiLayer.name = 'UILayer';
    this.scene.add(this.uiLayer);
  }
  
  /**
   * Handle window resize
   * @private
   */
  _onResize() {
    if (this.renderer.xr.isPresenting) return; // XR handles its own sizing
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  /**
   * Add object to ocean layer
   * @param {THREE.Object3D} object
   */
  addToOcean(object) {
    this.oceanLayer.add(object);
  }
  
  /**
   * Add object to data layer
   * @param {THREE.Object3D} object
   */
  addToData(object) {
    this.dataLayer.add(object);
  }
  
  /**
   * Add object to UI layer
   * @param {THREE.Object3D} object
   */
  addToUI(object) {
    this.uiLayer.add(object);
  }
  
  /**
   * Get the WebXR manager
   * @returns {THREE.WebXRManager}
   */
  getXRManager() {
    return this.renderer.xr;
  }
  
  /**
   * Get the Three.js renderer
   * @returns {THREE.WebGLRenderer}
   */
  getRenderer() {
    return this.renderer;
  }
  
  /**
   * Get the scene
   * @returns {THREE.Scene}
   */
  getScene() {
    return this.scene;
  }
  
  /**
   * Get the camera
   * @returns {THREE.PerspectiveCamera}
   */
  getCamera() {
    return this.camera;
  }
  
  /**
   * Render one frame
   * @param {number} time - Time in seconds
   * @param {XRFrame} xrFrame - Optional XR frame
   */
  render(time, xrFrame) {
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Dispose of all resources
   */
  dispose() {
    this.renderer.dispose();
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  }
}


