import * as THREE from 'three';

export type Contour3DTheme = 'gold' | 'ink' | 'cyan';

export interface ContourShaderParams {
  showContours: boolean;
  contourInterval: number;
  indexInterval: number;
  highlightElevation: number | null;
  theme?: Contour3DTheme;
  thickness?: number;
  indexThickness?: number;
}

export interface TerrainShaderUniforms {
  uShowContours: { value: number };
  uContourInterval: { value: number };
  uIndexInterval: { value: number };
  uHighlightElevation: { value: number };
  uIndexColor: { value: THREE.Color };
  uIntermediateColor: { value: THREE.Color };
  uHighlightColor: { value: THREE.Color };
  uThickness: { value: number };
  uIndexThickness: { value: number };
}

/**
 * Creates standardized uniform objects for the 3D contour isoline shader
 */
export function createContourShaderUniforms(params: ContourShaderParams): TerrainShaderUniforms {
  const themeColors = getThemeColors(params.theme || 'gold');

  return {
    uShowContours: { value: params.showContours ? 1.0 : 0.0 },
    uContourInterval: { value: Math.max(0.01, params.contourInterval) },
    uIndexInterval: { value: Math.max(0.02, params.indexInterval) },
    uHighlightElevation: { value: params.highlightElevation ?? -999.0 },
    uIndexColor: { value: themeColors.index },
    uIntermediateColor: { value: themeColors.intermediate },
    uHighlightColor: { value: themeColors.highlight },
    uThickness: { value: params.thickness ?? 1.5 },
    uIndexThickness: { value: params.indexThickness ?? 2.4 },
  };
}

/**
 * Updates uniforms safely without shader recompilation
 */
export function updateContourShaderUniforms(
  uniforms: TerrainShaderUniforms,
  params: ContourShaderParams
) {
  uniforms.uShowContours.value = params.showContours ? 1.0 : 0.0;
  uniforms.uContourInterval.value = Math.max(0.01, params.contourInterval);
  uniforms.uIndexInterval.value = Math.max(0.02, params.indexInterval);
  uniforms.uHighlightElevation.value = params.highlightElevation ?? -999.0;

  const themeColors = getThemeColors(params.theme || 'gold');
  uniforms.uIndexColor.value.copy(themeColors.index);
  uniforms.uIntermediateColor.value.copy(themeColors.intermediate);
  uniforms.uHighlightColor.value.copy(themeColors.highlight);

  if (params.thickness !== undefined) uniforms.uThickness.value = params.thickness;
  if (params.indexThickness !== undefined) uniforms.uIndexThickness.value = params.indexThickness;
}

function getThemeColors(theme: Contour3DTheme) {
  switch (theme) {
    case 'ink':
      return {
        index: new THREE.Color('#1c1917'), // dark charcoal ink
        intermediate: new THREE.Color('#44403c'), // medium charcoal
        highlight: new THREE.Color('#0284c7'), // sky blue
      };
    case 'cyan':
      return {
        index: new THREE.Color('#38bdf8'), // bright cyan
        intermediate: new THREE.Color('#94a3b8'), // subtle silver slate
        highlight: new THREE.Color('#facc15'), // bright amber
      };
    case 'gold':
    default:
      return {
        index: new THREE.Color('#f59e0b'), // warm amber gold
        intermediate: new THREE.Color('#ffffff'), // crisp white
        highlight: new THREE.Color('#00f0ff'), // neon laser cyan
      };
  }
}

/**
 * Injects 3D contour isoline GLSL into Three.js MeshStandardMaterial shader
 */
export function injectContourShader(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: TerrainShaderUniforms
) {
  // Bind uniform references
  Object.assign(shader.uniforms, uniforms);

  // 1. Vertex Shader Injection: export local position & normal
  shader.vertexShader = `
    varying vec3 vTerrainLocalPos;
    varying vec3 vTerrainNormal;
    ${shader.vertexShader}
  `.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>
    vTerrainLocalPos = position;
    vTerrainNormal = normal;
    `
  );

  // 2. Fragment Shader Injection: Isoline pixel shader calculation
  shader.fragmentShader = `
    varying vec3 vTerrainLocalPos;
    varying vec3 vTerrainNormal;

    uniform float uShowContours;
    uniform float uContourInterval;
    uniform float uIndexInterval;
    uniform float uHighlightElevation;
    uniform vec3 uIndexColor;
    uniform vec3 uIntermediateColor;
    uniform vec3 uHighlightColor;
    uniform float uThickness;
    uniform float uIndexThickness;

    ${shader.fragmentShader}
  `.replace(
    '#include <dithering_fragment>',
    `
    #include <dithering_fragment>

    // Only apply isolines on top terrain surface (avoiding side strata skirts and base)
    if (uShowContours > 0.5 && vTerrainNormal.z > 0.12 && vTerrainLocalPos.z > -1.15) {
      float elev = vTerrainLocalPos.z;
      // Screen-space derivative for constant pixel thickness regardless of camera distance
      float df = max(fwidth(elev), 0.0004);

      // Intermediate contour lines
      float safeInter = max(0.005, uContourInterval);
      float distInter = abs(fract(elev / safeInter + 0.5) - 0.5) * safeInter;
      float lineInter = 1.0 - smoothstep(0.0, df * uThickness, distInter);

      // Index contour lines (every 5th interval)
      float safeIndex = max(0.01, uIndexInterval);
      float distIndex = abs(fract(elev / safeIndex + 0.5) - 0.5) * safeIndex;
      float lineIndex = 1.0 - smoothstep(0.0, df * uIndexThickness, distIndex);

      // Highlighted single contour line (e.g. hovered elevation)
      float lineHighlight = 0.0;
      if (uHighlightElevation > -900.0) {
        float distHl = abs(elev - uHighlightElevation);
        lineHighlight = 1.0 - smoothstep(0.0, df * (uIndexThickness * 1.8), distHl);
      }

      // Blend contour lines smoothly with lighting
      if (lineHighlight > 0.01) {
        vec3 hlGlow = uHighlightColor * 1.35;
        gl_FragColor.rgb = mix(gl_FragColor.rgb, hlGlow, lineHighlight * 0.95);
      } else if (lineIndex > 0.01) {
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uIndexColor, lineIndex * 0.88);
      } else if (lineInter > 0.01) {
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uIntermediateColor, lineInter * 0.62);
      }
    }
    `
  );
}
