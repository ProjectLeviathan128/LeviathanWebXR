/**
 * Leviathan WebXR - XR Session Manager
 * 
 * Handles WebXR session lifecycle, hand tracking initialization,
 * and XR-specific frame management.
 */

export class XRSession {
  /**
   * Create XR Session manager
   * @param {Scene} sceneManager - Leviathan Scene instance
   */
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.renderer = sceneManager.getRenderer();
    this.xrManager = sceneManager.getXRManager();
    
    // Session state
    this.session = null;
    this.referenceSpace = null;
    this.isPresenting = false;
    
    // Hand tracking
    this.hand1 = null;
    this.hand2 = null;
    
    // Feature support flags
    this.handTrackingSupported = false;
    
    // Callbacks
    this.onSessionStart = null;
    this.onSessionEnd = null;
    this.onFrame = null;
  }
  
  /**
   * Check if WebXR is supported with required features
   * @returns {Promise<{supported: boolean, handTracking: boolean}>}
   */
  async checkSupport() {
    if (!navigator.xr) {
      return { supported: false, handTracking: false };
    }
    
    try {
      const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
      
      if (!vrSupported) {
        return { supported: false, handTracking: false };
      }
      
      // Check hand tracking support
      // Note: We can't fully verify until session starts, but this is a hint
      this.handTrackingSupported = true; // Assume supported, fail gracefully
      
      return { supported: true, handTracking: this.handTrackingSupported };
    } catch (e) {
      console.error('WebXR support check failed:', e);
      return { supported: false, handTracking: false };
    }
  }
  
  /**
   * Start immersive VR session with hand tracking
   * @returns {Promise<boolean>} Success status
   */
  async startSession() {
    if (this.isPresenting) {
      console.warn('XR session already active');
      return false;
    }
    
    try {
      // Request session with hand tracking
      // Using 'optional' for hand-tracking to allow fallback
      const sessionInit = {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking']
      };
      
      this.session = await navigator.xr.requestSession('immersive-vr', sessionInit);
      
      // Set up session
      this.session.addEventListener('end', () => this._onSessionEnd());
      
      // Get reference space
      this.referenceSpace = await this.session.requestReferenceSpace('local-floor');
      
      // Initialize hand tracking if available
      this._initHandTracking();
      
      // Connect to Three.js renderer
      await this.renderer.xr.setSession(this.session);
      
      this.isPresenting = true;
      
      // Start render loop
      this.renderer.setAnimationLoop((time, frame) => this._onXRFrame(time, frame));
      
      if (this.onSessionStart) {
        this.onSessionStart();
      }
      
      console.log('XR session started successfully');
      return true;
      
    } catch (e) {
      console.error('Failed to start XR session:', e);
      return false;
    }
  }
  
  /**
   * Initialize hand tracking models
   * @private
   */
  _initHandTracking() {
    // Get hand spaces from XR manager
    this.hand1 = this.renderer.xr.getHand(0);
    this.hand2 = this.renderer.xr.getHand(1);
    
    // Add hands to scene for debugging (optional)
    // In production, we only use joint data for gestures
    if (this.hand1) {
      this.sceneManager.getScene().add(this.hand1);
      console.log('Hand 1 initialized');
    }
    
    if (this.hand2) {
      this.sceneManager.getScene().add(this.hand2);
      console.log('Hand 2 initialized');
    }
  }
  
  /**
   * XR frame callback
   * @private
   * @param {number} time - Timestamp in milliseconds
   * @param {XRFrame} frame - XR frame data
   */
  _onXRFrame(time, frame) {
    if (!this.isPresenting || !frame) return;
    
    // Convert time to seconds
    const timeSeconds = time * 0.001;
    
    // Extract hand data for this frame
    const handData = this._extractHandData(frame);
    
    // Call external frame handler
    if (this.onFrame) {
      this.onFrame(timeSeconds, frame, handData);
    }
    
    // Render
    this.sceneManager.render(timeSeconds, frame);
  }
  
  /**
   * Extract hand joint data from XR frame
   * @private
   * @param {XRFrame} frame
   * @returns {Object} Hand data for both hands
   */
  _extractHandData(frame) {
    const handData = {
      left: null,
      right: null
    };
    
    // Get input sources
    const inputSources = this.session.inputSources;
    
    for (const source of inputSources) {
      if (!source.hand) continue;
      
      const handedness = source.handedness;
      const joints = {};
      
      // Extract joint poses
      for (const [jointName, jointSpace] of source.hand.entries()) {
        const pose = frame.getJointPose(jointSpace, this.referenceSpace);
        
        if (pose) {
          joints[jointName] = {
            position: {
              x: pose.transform.position.x,
              y: pose.transform.position.y,
              z: pose.transform.position.z
            },
            orientation: {
              x: pose.transform.orientation.x,
              y: pose.transform.orientation.y,
              z: pose.transform.orientation.z,
              w: pose.transform.orientation.w
            },
            radius: pose.radius || 0.01
          };
        }
      }
      
      const handInfo = {
        joints,
        visible: Object.keys(joints).length > 0
      };
      
      if (handedness === 'left') {
        handData.left = handInfo;
      } else if (handedness === 'right') {
        handData.right = handInfo;
      }
    }
    
    return handData;
  }
  
  /**
   * Handle session end
   * @private
   */
  _onSessionEnd() {
    this.isPresenting = false;
    this.session = null;
    this.referenceSpace = null;
    
    // Stop animation loop
    this.renderer.setAnimationLoop(null);
    
    if (this.onSessionEnd) {
      this.onSessionEnd();
    }
    
    console.log('XR session ended');
  }
  
  /**
   * End the current XR session
   */
  async endSession() {
    if (this.session) {
      await this.session.end();
    }
  }
  
  /**
   * Check if currently in XR
   * @returns {boolean}
   */
  get presenting() {
    return this.isPresenting;
  }
  
  /**
   * Get reference space for coordinate transforms
   * @returns {XRReferenceSpace}
   */
  getReferenceSpace() {
    return this.referenceSpace;
  }
}


