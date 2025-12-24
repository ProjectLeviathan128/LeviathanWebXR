/**
 * Leviathan WebXR - Whale Instance Fragment Shader
 * 
 * Renders individual whale presence points with species-based coloring
 * and time-based opacity. Implements soft circular points with glow.
 */

// Species color palette (matches Constants.js)
uniform vec3 uSpeciesColors[8];
uniform float uOpacity;        // Base opacity

// From vertex shader
varying float vTimeFade;       // Temporal visibility
varying float vSpecies;        // Species ID
varying float vDensity;        // Density weight
varying float vDistanceFade;   // Distance fade

void main() {
  // Early discard for invisible points
  float visibility = vTimeFade * vDistanceFade;
  if (visibility < 0.01) {
    discard;
  }
  
  // Create soft circular point
  // gl_PointCoord is [0,1] across the point
  vec2 centered = gl_PointCoord - 0.5;
  float dist = length(centered) * 2.0;
  
  // Soft edge falloff
  float alpha = 1.0 - smoothstep(0.6, 1.0, dist);
  
  // Discard pixels outside circle
  if (alpha < 0.01) {
    discard;
  }
  
  // Look up species color
  int speciesIndex = int(clamp(vSpecies, 0.0, 7.0));
  vec3 baseColor = uSpeciesColors[speciesIndex];
  
  // Modulate brightness by density
  // Higher density = brighter core
  float brightness = 0.7 + vDensity * 0.3;
  vec3 color = baseColor * brightness;
  
  // Add subtle glow at center
  float glow = 1.0 - smoothstep(0.0, 0.4, dist);
  color += glow * 0.2;
  
  // Time-based color shift
  // More recent = slightly warmer, older = slightly cooler
  // Subtle effect to indicate temporal position
  float timeWarmth = vTimeFade * 0.1;
  color.r += timeWarmth * 0.05;
  color.b -= timeWarmth * 0.05;
  
  // Final alpha combines all factors
  float finalAlpha = alpha * visibility * uOpacity;
  
  // Premultiplied alpha for correct blending
  gl_FragColor = vec4(color * finalAlpha, finalAlpha);
}


