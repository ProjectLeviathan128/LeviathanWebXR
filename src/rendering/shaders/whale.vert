/**
 * Leviathan WebXR - Whale Instance Vertex Shader
 * 
 * Renders whale presence data as GPU-instanced billboards.
 * Each instance encodes position, time, species, and density.
 * 
 * TIME FILTERING HAPPENS HERE - no CPU iteration per frame.
 */

// Global uniforms
uniform float uTime;           // Current normalized time [0, 1]
uniform float uTimeWindow;     // Visible time radius
uniform vec3 uOriginOffset;    // Floating origin offset
uniform float uBaseSize;       // Base point size in world units
uniform float uQuality;        // Quality multiplier [0.3 - 1.0]

// Per-instance attributes
attribute vec3 instancePosition;   // World position (x, y, z)
attribute float instanceTime;      // Normalized time [0, 1]
attribute float instanceSpecies;   // Species ID (0-7)
attribute float instanceDensity;   // Observation count weight (0-1 normalized)

// Varyings to fragment shader
varying float vTimeFade;       // Visibility based on temporal distance
varying float vSpecies;        // Species for color lookup
varying float vDensity;        // Density for brightness
varying float vDistanceFade;   // Distance-based fade

void main() {
  // Calculate temporal distance from current time
  float timeDist = abs(instanceTime - uTime);
  
  // Smooth fade based on temporal distance
  // Points outside time window fade to invisible
  vTimeFade = 1.0 - smoothstep(0.0, uTimeWindow, timeDist);
  
  // Early culling - if completely invisible, move off-screen
  // This is faster than discard in fragment shader for many instances
  if (vTimeFade < 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // Off-screen
    gl_PointSize = 0.0;
    return;
  }
  
  // Apply floating origin offset
  vec3 worldPos = instancePosition - uOriginOffset;
  
  // Transform to view space
  vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
  
  // Calculate distance to camera for LOD
  float distToCamera = -mvPosition.z;
  
  // Distance-based fade (close = full, far = fade out)
  vDistanceFade = 1.0 - smoothstep(1.0, 10.0, distToCamera);
  
  // Combined visibility
  float combinedFade = vTimeFade * vDistanceFade * uQuality;
  
  // Early cull if too faint
  if (combinedFade < 0.01) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  
  // Pass species and density to fragment shader
  vSpecies = instanceSpecies;
  vDensity = instanceDensity;
  
  // Calculate point size
  // - Base size modified by density (higher count = larger)
  // - Scaled by temporal visibility
  // - Perspective scaling (closer = larger)
  float densityScale = 0.5 + instanceDensity * 0.5;
  float perspectiveScale = 300.0 / distToCamera; // Adjust for world scale
  float timeScale = 0.3 + vTimeFade * 0.7; // Minimum 30% size when fading
  
  gl_PointSize = uBaseSize * densityScale * perspectiveScale * timeScale * uQuality;
  
  // Clamp point size to reasonable range
  gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
  
  // Final position
  gl_Position = projectionMatrix * mvPosition;
}


