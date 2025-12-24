/**
 * Leviathan WebXR - Coastline Renderer
 * 
 * Renders simplified Pacific coastline as vector outlines.
 * Coastlines provide geographic context without dominating the view.
 * 
 * Features:
 * - Pre-simplified GeoJSON input
 * - Distance-based fade
 * - Minimal vertex count (<50k target)
 */

import * as THREE from 'three';

export class CoastlineRenderer {
  /**
   * Create coastline renderer
   * @param {Projection} projection - Geo projection system
   */
  constructor(projection) {
    this.projection = projection;
    
    // Root group
    this.group = new THREE.Group();
    this.group.name = 'Coastlines';
    
    // Loaded state
    this.loaded = false;
    this.vertexCount = 0;
    
    // Materials (shared across all coastline segments)
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0.4, 0.55, 0.65) },
        uOpacity: { value: 0.6 },
        uFadeNear: { value: 0.5 },
        uFadeFar: { value: 5.0 },
        uCameraPosition: { value: new THREE.Vector3() }
      },
      vertexShader: `
        uniform vec3 uCameraPosition;
        uniform float uFadeNear;
        uniform float uFadeFar;
        
        varying float vFade;
        
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          float dist = distance(worldPos.xyz, uCameraPosition);
          
          // Fade based on distance
          vFade = 1.0 - smoothstep(uFadeNear, uFadeFar, dist);
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        
        varying float vFade;
        
        void main() {
          if (vFade < 0.01) discard;
          gl_FragColor = vec4(uColor, uOpacity * vFade);
        }
      `,
      transparent: true,
      depthWrite: false
    });
  }
  
  /**
   * Load coastline from GeoJSON data
   * @param {Object} geoJSON - GeoJSON FeatureCollection
   */
  loadFromGeoJSON(geoJSON) {
    if (!geoJSON || !geoJSON.features) {
      console.warn('Invalid GeoJSON data');
      return;
    }
    
    console.log(`Loading ${geoJSON.features.length} coastline features...`);
    
    let totalVertices = 0;
    
    for (const feature of geoJSON.features) {
      const geometry = feature.geometry;
      
      if (!geometry) continue;
      
      if (geometry.type === 'LineString') {
        totalVertices += this._addLineString(geometry.coordinates);
      } else if (geometry.type === 'MultiLineString') {
        for (const line of geometry.coordinates) {
          totalVertices += this._addLineString(line);
        }
      } else if (geometry.type === 'Polygon') {
        // Use outer ring only
        totalVertices += this._addLineString(geometry.coordinates[0]);
      } else if (geometry.type === 'MultiPolygon') {
        for (const polygon of geometry.coordinates) {
          totalVertices += this._addLineString(polygon[0]);
        }
      }
    }
    
    this.vertexCount = totalVertices;
    this.loaded = true;
    
    console.log(`Coastline loaded: ${totalVertices} vertices`);
  }
  
  /**
   * Add a single LineString to the renderer
   * @private
   * @param {Array} coordinates - [[lon, lat], [lon, lat], ...]
   * @returns {number} Number of vertices added
   */
  _addLineString(coordinates) {
    if (!coordinates || coordinates.length < 2) return 0;
    
    // Project coordinates
    const points = [];
    
    for (const coord of coordinates) {
      const lon = coord[0];
      const lat = coord[1];
      
      // Project to world space (depth = 0 for coastline)
      const [x, y, z] = this.projection.project(lat, lon, 0);
      points.push(new THREE.Vector3(x, y + 0.01, z)); // Slight y offset to prevent z-fighting
    }
    
    // Create geometry
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create line
    const line = new THREE.Line(geometry, this.material);
    line.frustumCulled = true;
    
    this.group.add(line);
    
    return points.length;
  }
  
  /**
   * Generate simplified Pacific coastline data
   * This is a fallback when no external data is loaded
   * @returns {Object} GeoJSON-like data
   */
  static generateSimplifiedPacificCoast() {
    // Simplified waypoints along the Pacific coast
    // From Alaska to Baja California
    const pacificCoast = [
      // Alaska
      [-165.0, 65.0], [-162.0, 64.5], [-160.0, 63.0], [-158.0, 61.0],
      [-155.0, 59.0], [-152.0, 58.0], [-149.0, 60.0], [-146.0, 61.0],
      [-142.0, 60.0], [-140.0, 59.5], [-137.0, 58.5], [-135.0, 57.0],
      [-133.0, 55.0], [-131.0, 54.0], [-130.0, 52.0],
      
      // British Columbia
      [-128.0, 51.0], [-126.0, 49.5], [-124.5, 48.5],
      
      // Washington
      [-124.0, 47.5], [-124.5, 46.5],
      
      // Oregon
      [-124.0, 45.5], [-124.5, 44.0], [-124.2, 42.5],
      
      // California
      [-124.0, 41.5], [-123.5, 39.5], [-122.5, 38.0], [-122.0, 36.8],
      [-121.8, 36.5], // Monterey Bay
      [-121.0, 35.5], [-120.5, 34.5], [-119.0, 34.0], [-118.0, 33.5],
      [-117.0, 32.5],
      
      // Baja California
      [-116.5, 31.5], [-116.0, 30.0], [-115.5, 28.5], [-114.0, 27.0],
      [-112.0, 25.0], [-110.0, 23.5], [-109.5, 22.5]
    ];
    
    // Hawaii (simplified)
    const hawaii = [
      [-160.0, 22.0], [-159.0, 22.2], [-158.0, 21.5], [-157.0, 21.3],
      [-156.5, 20.8], [-155.5, 20.0], [-155.0, 19.5]
    ];
    
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Pacific Coast' },
          geometry: {
            type: 'LineString',
            coordinates: pacificCoast
          }
        },
        {
          type: 'Feature',
          properties: { name: 'Hawaii' },
          geometry: {
            type: 'LineString',
            coordinates: hawaii
          }
        }
      ]
    };
  }
  
  /**
   * Initialize with built-in simplified coastline
   */
  loadBuiltIn() {
    const data = CoastlineRenderer.generateSimplifiedPacificCoast();
    this.loadFromGeoJSON(data);
  }
  
  /**
   * Get the coastline group to add to scene
   * @returns {THREE.Group}
   */
  getObject() {
    return this.group;
  }
  
  /**
   * Update for camera position (for distance fade)
   * @param {THREE.Vector3} cameraPosition
   */
  update(cameraPosition) {
    this.material.uniforms.uCameraPosition.value.copy(cameraPosition);
  }
  
  /**
   * Set fade distances
   * @param {number} near - Distance where fade starts
   * @param {number} far - Distance where fully faded
   */
  setFadeDistance(near, far) {
    this.material.uniforms.uFadeNear.value = near;
    this.material.uniforms.uFadeFar.value = far;
  }
  
  /**
   * Set coastline color
   * @param {THREE.Color|number} color
   */
  setColor(color) {
    if (typeof color === 'number') {
      this.material.uniforms.uColor.value.setHex(color);
    } else {
      this.material.uniforms.uColor.value.copy(color);
    }
  }
  
  /**
   * Set opacity
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
    this.group.visible = visible;
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
    this.material.dispose();
  }
}


