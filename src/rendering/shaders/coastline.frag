/**
 * Leviathan WebXR - Coastline Fragment Shader
 * 
 * Simple color output with distance-based fade.
 */

uniform vec3 uColor;
uniform float uOpacity;

varying float vFade;

void main() {
  if (vFade < 0.01) {
    discard;
  }
  
  gl_FragColor = vec4(uColor, uOpacity * vFade);
}


