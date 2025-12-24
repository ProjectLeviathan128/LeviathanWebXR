/**
 * Leviathan WebXR - Coastline Vertex Shader
 * 
 * Simple pass-through with distance calculation for fading.
 */

uniform vec3 uCameraPosition;
uniform float uFadeNear;
uniform float uFadeFar;

varying float vFade;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  float dist = distance(worldPos.xyz, uCameraPosition);
  
  // Fade based on distance from camera
  vFade = 1.0 - smoothstep(uFadeNear, uFadeFar, dist);
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}


