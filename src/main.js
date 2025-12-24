/**
 * Leviathan WebXR - Main Entry Point
 * 
 * Orchestrates all subsystems for the immersive whale data visualization.
 * 
 * Architecture:
 * - Scene: Three.js rendering foundation
 * - XRSession: WebXR session management
 * - TimeSystem: Global temporal control
 * - Projection: Geographic coordinate system
 * - FloatingOrigin: GPU precision management
 * - OceanVolume: Spatial reference
 * - CoastlineRenderer: Geographic context
 * - WhaleInstanceRenderer: Data visualization
 * - HandTracker: Hand tracking input
 * - GestureRecognizer: Gesture state machine
 */

import * as THREE from 'three';

// Core
import { Scene } from './core/Scene.js';
import { XRSession } from './core/XRSession.js';
import { TimeSystem } from './core/TimeSystem.js';
import { PerformanceMonitor } from './core/PerformanceMonitor.js';

// Geospatial
import { Projection } from './geo/Projection.js';
import { FloatingOrigin } from './geo/FloatingOrigin.js';
import { OceanVolume } from './geo/OceanVolume.js';
import { CoastlineRenderer } from './geo/CoastlineRenderer.js';

// Rendering
import { WhaleInstanceRenderer } from './rendering/WhaleInstanceRenderer.js';
import { DensityAggregator } from './rendering/DensityAggregator.js';

// Interaction
import { HandTracker } from './interaction/HandTracker.js';
import { GestureRecognizer, GestureState } from './interaction/GestureRecognizer.js';
import { TimeScrubGesture } from './interaction/TimeScrubGesture.js';
import { InspectGesture } from './interaction/InspectGesture.js';
import { ResetGesture } from './interaction/ResetGesture.js';

// Data
import { DataLoader } from './data/DataLoader.js';
import { DataProcessor } from './data/DataProcessor.js';
import { TimeChunker } from './data/TimeChunker.js';
import { SyntheticDataGenerator } from './data/SyntheticDataGenerator.js';
import { SpatialGrid } from './data/SpatialGrid.js';

/**
 * Main Leviathan Application
 */
class LeviathanApp {
  constructor() {
    // DOM elements
    this.container = document.getElementById('container');
    this.enterButton = document.getElementById('enter-xr');
    this.statusText = document.getElementById('status');
    this.loadingScreen = document.getElementById('loading-screen');
    
    // Core systems
    this.scene = null;
    this.xrSession = null;
    this.timeSystem = null;
    this.performanceMonitor = null;
    
    // Geospatial
    this.projection = null;
    this.floatingOrigin = null;
    this.oceanVolume = null;
    this.coastlineRenderer = null;
    
    // Rendering
    this.whaleRenderer = null;
    this.densityAggregator = null;
    
    // Interaction
    this.handTracker = null;
    this.gestureRecognizer = null;
    this.timeScrubGesture = null;
    this.inspectGesture = null;
    this.resetGesture = null;
    
    // Data
    this.dataLoader = null;
    this.dataProcessor = null;
    this.timeChunker = null;
    this.processedData = null;
    
    // AUDIT FOLLOW-UP: Spatial Inspection - Grid for safe region queries
    this.spatialGrid = null;
    
    // FIX: Audit Issue - Track active LOD data
    this.activeLOD = 'fine';
    this.activeData = null;
    
    // FIX: Audit Issue - Time indicator for user comprehension
    this.timeIndicator = null;
    this.timeIndicatorCanvas = null;
    this.timeIndicatorTexture = null;
    
    // State
    this.initialized = false;
    this.dataLoaded = false;
    
    // Start initialization
    this._init();
  }
  
  /**
   * Initialize the application
   * @private
   */
  async _init() {
    try {
      // Create core systems
      this._initCoreSystems();
      
      // Check WebXR support
      const support = await this.xrSession.checkSupport();
      
      if (!support.supported) {
        this._showError('WebXR not supported. Please use a VR headset with WebXR support.');
        return;
      }
      
      // Initialize geospatial systems
      this._initGeospatial();
      
      // Initialize rendering
      this._initRendering();
      
      // Initialize interaction
      this._initInteraction();
      
      // Initialize data pipeline
      this._initData();
      
      // Load initial data
      await this._loadData();
      
      // Enable XR button
      this._enableXRButton(support.handTracking);
      
      this.initialized = true;
      
    } catch (error) {
      console.error('Initialization failed:', error);
      this._showError(`Initialization failed: ${error.message}`);
    }
  }
  
  /**
   * Initialize core systems
   * @private
   */
  _initCoreSystems() {
    // Create Three.js scene
    this.scene = new Scene(this.container);
    
    // Create XR session manager
    this.xrSession = new XRSession(this.scene);
    
    // Create time system
    this.timeSystem = new TimeSystem();
    
    // Create performance monitor
    this.performanceMonitor = new PerformanceMonitor();
    
    // Wire up XR callbacks
    this.xrSession.onSessionStart = () => this._onXRStart();
    this.xrSession.onSessionEnd = () => this._onXREnd();
    this.xrSession.onFrame = (time, frame, handData) => this._onXRFrame(time, frame, handData);
    
    console.log('Core systems initialized');
  }
  
  /**
   * Initialize geospatial systems
   * @private
   */
  _initGeospatial() {
    // Create projection (Monterey Bay origin)
    this.projection = new Projection();
    
    // Create floating origin system
    this.floatingOrigin = new FloatingOrigin();
    
    // Create ocean volume
    this.oceanVolume = new OceanVolume(this.projection);
    this.scene.addToOcean(this.oceanVolume.getObject());
    
    // Create coastline renderer
    this.coastlineRenderer = new CoastlineRenderer(this.projection);
    this.coastlineRenderer.loadBuiltIn();
    this.scene.addToOcean(this.coastlineRenderer.getObject());
    
    console.log('Geospatial systems initialized');
  }
  
  /**
   * Initialize rendering systems
   * @private
   */
  _initRendering() {
    // Create whale instance renderer
    this.whaleRenderer = new WhaleInstanceRenderer(
      this.timeSystem,
      this.floatingOrigin
    );
    this.scene.addToData(this.whaleRenderer.getObject());
    
    // Create density aggregator
    this.densityAggregator = new DensityAggregator();
    
    // Wire up performance monitor
    this.performanceMonitor.onQualityChange = (quality) => {
      this.whaleRenderer.setQuality(quality);
      console.log(`Quality adjusted to ${Math.round(quality * 100)}%`);
    };
    
    console.log('Rendering systems initialized');
  }
  
  /**
   * Initialize interaction systems
   * @private
   */
  _initInteraction() {
    // Create hand tracker
    this.handTracker = new HandTracker();
    
    // Create gesture recognizer
    this.gestureRecognizer = new GestureRecognizer(this.handTracker);
    
    // Create gesture handlers
    this.timeScrubGesture = new TimeScrubGesture(this.timeSystem);
    this.inspectGesture = new InspectGesture(this.scene);
    this.resetGesture = new ResetGesture(this.timeSystem, this.scene);
    
    // Wire up gesture callbacks
    this.gestureRecognizer.onTimeScrub = (deltaX) => {
      this.timeScrubGesture.onInput(deltaX);
    };
    
    // AUDIT FOLLOW-UP: Spatial Inspection - Safe activation with grid queries
    this.gestureRecognizer.onInspect = (position, active) => {
      if (active && position) {
        this.inspectGesture.activate(position);
      } else {
        this.inspectGesture.deactivate();
      }
    };
    
    this.gestureRecognizer.onReset = () => {
      this.resetGesture.execute();
    };
    
    // Reset gesture callback
    this.resetGesture.onReset = () => {
      console.log('View reset');
    };
    
    console.log('Interaction systems initialized');
  }
  
  /**
   * Initialize data pipeline
   * @private
   */
  _initData() {
    this.dataLoader = new DataLoader();
    this.dataProcessor = new DataProcessor(this.projection);
    this.timeChunker = new TimeChunker();
    
    // Wire up loading progress
    this.dataLoader.onProgress = (progress) => {
      this._updateStatus(`Loading data: ${Math.round(progress * 100)}%`);
    };
    
    console.log('Data pipeline initialized');
  }
  
  /**
   * Load whale data
   * FIX: Audit Issue - Actually use LOD system and time chunking
   * @private
   */
  async _loadData() {
    this._updateStatus('Generating synthetic data...');
    
    try {
      // Generate synthetic data for development
      // In production, replace with: await this.dataLoader.loadJSON('data/whales.json')
      const rawData = SyntheticDataGenerator.generate(100000);
      
      this._updateStatus('Processing data...');
      
      // Process into GPU-ready format
      this.processedData = await this.dataProcessor.processAsync(
        rawData,
        10000,
        (progress) => {
          this._updateStatus(`Processing: ${Math.round(progress * 100)}%`);
        }
      );
      
      // Build time index
      this.timeChunker.build(this.processedData);
      
      // Build density LOD levels
      this.densityAggregator.process(this.processedData);
      
      // FIX: Audit Issue - Select LOD level based on dataset size and Quest 2 budget
      // Use coarser LOD for large datasets to maintain performance
      const lodStats = this.densityAggregator.getStats();
      let selectedData = this.processedData;
      let lodLevel = 'fine';
      
      // FIX: Audit Issue - Performance safety check: cap instance count
      const MAX_SAFE_INSTANCES = 50000; // Quest 2 budget
      
      if (this.processedData.count > MAX_SAFE_INSTANCES) {
        // Use medium LOD if fine is too large
        if (lodStats.medium <= MAX_SAFE_INSTANCES) {
          selectedData = this.densityAggregator.getLevel('medium');
          lodLevel = 'medium';
          console.log(`FIX: Using medium LOD (${selectedData.count} instances) for Quest 2 performance`);
        } else {
          // Use coarse LOD as last resort
          selectedData = this.densityAggregator.getLevel('coarse');
          lodLevel = 'coarse';
          console.log(`FIX: Using coarse LOD (${selectedData.count} instances) for Quest 2 performance`);
        }
      }
      
      // FIX: Audit Issue - Store selected LOD for reference
      this.activeLOD = lodLevel;
      this.activeData = selectedData;
      
      // Load selected LOD into renderer
      this.whaleRenderer.loadData(selectedData);
      
      // AUDIT FOLLOW-UP: Build spatial grid for safe inspection queries
      this.spatialGrid = new SpatialGrid(0.5); // ~50km cells
      this.spatialGrid.build(selectedData);
      
      // AUDIT FOLLOW-UP: Wire spatial grid to inspect gesture
      this.inspectGesture.setSpatialGrid(this.spatialGrid);
      
      this.dataLoaded = true;
      this._updateStatus('Data loaded. Ready for XR.');
      
      console.log('Data loaded:', this.processedData.count, 'records (full)');
      console.log('Active LOD:', lodLevel, 'with', selectedData.count, 'instances');
      console.log('Time index:', this.timeChunker.getStats());
      console.log('Density levels:', lodStats);
      console.log('AUDIT FOLLOW-UP: Spatial grid:', this.spatialGrid.getStats());
      
    } catch (error) {
      console.error('Data loading failed:', error);
      this._showError(`Failed to load data: ${error.message}`);
    }
  }
  
  /**
   * Enable XR entry button
   * @private
   */
  _enableXRButton(handTrackingSupported) {
    this.enterButton.disabled = false;
    this.loadingScreen.style.display = 'none';
    this.container.classList.add('ready');
    
    if (handTrackingSupported) {
      this._updateStatus('WebXR ready with hand tracking');
      this.statusText.classList.add('status-ready');
    } else {
      this._updateStatus('WebXR ready (hand tracking may be limited)');
    }
    
    // Bind button click
    this.enterButton.addEventListener('click', () => this._startXR());
  }
  
  /**
   * Start XR session
   * @private
   */
  async _startXR() {
    if (!this.initialized || !this.dataLoaded) {
      console.warn('Not ready to start XR');
      return;
    }
    
    this.enterButton.disabled = true;
    this._updateStatus('Starting XR session...');
    
    const success = await this.xrSession.startSession();
    
    if (!success) {
      this.enterButton.disabled = false;
      this._showError('Failed to start XR session');
    }
  }
  
  /**
   * XR session started callback
   * @private
   */
  _onXRStart() {
    console.log('XR session started');
    this.container.style.display = 'none';
    
    // FIX: Audit Issue - Create time indicator on XR start
    this._createTimeIndicator();
  }
  
  /**
   * XR session ended callback
   * @private
   */
  _onXREnd() {
    console.log('XR session ended');
    this.container.style.display = 'block';
    this.enterButton.disabled = false;
    this._updateStatus('XR session ended. Click to restart.');
  }
  
  /**
   * XR frame callback - main update loop
   * FIX: Audit Issue - Corrected update loop ordering
   * @private
   */
  _onXRFrame(time, frame, handData) {
    // Calculate delta time
    const dt = this.performanceMonitor.lastTime > 0 
      ? time - this.performanceMonitor.lastTime 
      : 1/72;
    
    // Update performance monitor
    this.performanceMonitor.update(time);
    
    // Update hand tracker
    this.handTracker.update(handData, time);
    
    // FIX: Audit Issue - Correct ordering: gestures -> time adjustments -> time update -> render
    // Step 1: Gesture recognition and handlers (may call timeSystem.adjustTime)
    this.gestureRecognizer.update(dt);
    this.timeScrubGesture.update(dt);
    
    // Step 2: Update time system AFTER gesture handlers have made adjustments
    // This ensures smoothed time reflects current frame's input
    this.timeSystem.update(dt);
    
    // Step 3: Update reset progress indicator (visual feedback only)
    const resetProgress = this.gestureRecognizer.getResetProgress();
    if (resetProgress > 0) {
      this.resetGesture.updateProgress(
        resetProgress,
        this.handTracker.getLeftHand().palmPosition,
        this.handTracker.getRightHand().palmPosition
      );
    }
    
    // Step 4: Update spatial systems
    const camera = this.scene.getCamera();
    this.floatingOrigin.update(camera);
    
    // Update coastline fade
    const cameraPos = camera.position.clone();
    this.coastlineRenderer.update(cameraPos);
    
    // AUDIT FOLLOW-UP: Spatial Inspection - Update inspect gesture safely
    // Now uses SpatialGrid for O(cells) queries, not O(n) point scans
    // Disabled during time scrub to prevent gesture conflicts
    const isTimeScrubbing = this.gestureRecognizer.isActive('time_scrub');
    
    if (this.inspectGesture.getIsActive() && !isTimeScrubbing) {
      const pinchPoint = this.handTracker.getPinchPoint('right');
      if (pinchPoint) {
        this.inspectGesture.update(pinchPoint, camera);
      }
    }
    
    // Step 5: Update time indicator if present
    if (this.timeIndicator) {
      this._updateTimeIndicator();
    }
    
    // Record stats
    this.performanceMonitor.recordDrawStats(
      1, // Single draw call for whales
      0, // Points, not triangles
      this.whaleRenderer.getInstanceCount()
    );
  }
  
  /**
   * FIX: Audit Issue - Create minimal time indicator for user comprehension
   * @private
   */
  _createTimeIndicator() {
    // Create canvas for text rendering
    this.timeIndicatorCanvas = document.createElement('canvas');
    this.timeIndicatorCanvas.width = 256;
    this.timeIndicatorCanvas.height = 64;
    
    // Create texture from canvas
    this.timeIndicatorTexture = new THREE.CanvasTexture(this.timeIndicatorCanvas);
    this.timeIndicatorTexture.minFilter = THREE.LinearFilter;
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: this.timeIndicatorTexture,
      transparent: true,
      depthWrite: false,
      depthTest: false
    });
    
    // Create sprite
    this.timeIndicator = new THREE.Sprite(material);
    this.timeIndicator.scale.set(0.3, 0.075, 1);
    this.timeIndicator.name = 'TimeIndicator';
    
    // Position in front and below user's view
    this.timeIndicator.position.set(0, -0.3, -0.8);
    
    // Add to UI layer
    this.scene.addToUI(this.timeIndicator);
    
    // Initial render
    this._updateTimeIndicator();
  }
  
  /**
   * FIX: Audit Issue - Update time indicator text
   * @private
   */
  _updateTimeIndicator() {
    if (!this.timeIndicatorCanvas || !this.timeIndicatorTexture) return;
    
    const ctx = this.timeIndicatorCanvas.getContext('2d');
    const width = this.timeIndicatorCanvas.width;
    const height = this.timeIndicatorCanvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Background
    ctx.fillStyle = 'rgba(10, 20, 35, 0.7)';
    ctx.roundRect(0, 0, width, height, 8);
    ctx.fill();
    
    // Text
    ctx.fillStyle = '#c5d4e0';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Get year from time system
    const yearText = this.timeSystem.getDateString();
    ctx.fillText(yearText, width / 2, height / 2);
    
    // Update texture
    this.timeIndicatorTexture.needsUpdate = true;
  }
  
  /**
   * Update status text
   * @private
   */
  _updateStatus(message) {
    if (this.statusText) {
      this.statusText.textContent = message;
    }
  }
  
  /**
   * Show error message
   * @private
   */
  _showError(message) {
    this._updateStatus(message);
    if (this.statusText) {
      this.statusText.classList.add('status-error');
    }
    console.error(message);
  }
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.leviathan = new LeviathanApp();
});

