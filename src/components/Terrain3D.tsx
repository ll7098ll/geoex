import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  Eye,
  RotateCw,
  Grid,
  Layers,
  MapPin,
  Sparkles,
  Maximize2,
  Compass,
  Info,
  X,
  Clock,
  Map as MapIcon,
  ChevronDown,
  ChevronUp,
  Sliders,
  Palette,
  Scissors,
  Activity,
  Check,
  TrendingUp,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import { TerrainAnnotation } from '../types';
import {
  generateTerrainDioramaGeometry,
  resolveTerrainKey,
  generateTerrainElevationField,
  TerrainMaterialPreset,
} from './terrain/terrainGenerators';
import { getTerrainBumpTexture, TexturePatternKey } from './terrain/terrainTextures';
import { TERRAIN_ANNOTATIONS } from './terrain/TerrainAnnotationsData';
import { TerrainSpecialMeshes } from './terrain/TerrainSpecialMeshes';
import { ContourMapView } from './terrain/contour/ContourMapView';
import { ContourMapModal } from './terrain/contour/ContourMapModal';
import {
  createContourShaderUniforms,
  updateContourShaderUniforms,
  injectContourShader,
  TerrainShaderUniforms,
  Contour3DTheme,
} from './terrain/contour/terrainContourShader';
import { ElevationSlicePlane } from './terrain/contour/ElevationSlicePlane';
import { CrossSection3DVisualizer } from './terrain/contour/CrossSection3DVisualizer';
import { ElevationProfileChart } from './terrain/contour/ElevationProfileChart';
import { ContourReadingGuideModal } from './terrain/contour/ContourReadingGuideModal';
import { CrossSectionSample, CrossSectionPreset } from '../types/contour';

// ==========================================
// Terrain Default Material Settings per Category & SubTerrain
// ==========================================
export function getDefaultMaterialSettings(category: string, subTerrain: string) {
  const normSub = resolveTerrainKey(subTerrain);
  let roughness = 0.75;
  let metalness = 0.05;
  let bumpScale = 0.035;

  if (category === 'volcanic') {
    if (normSub === '주상절리') {
      roughness = 0.55;
      metalness = 0.18;
      bumpScale = 0.045;
    } else if (normSub === '용암동굴') {
      roughness = 0.85;
      metalness = 0.12;
      bumpScale = 0.04;
    } else {
      roughness = 0.78;
      metalness = 0.08;
      bumpScale = 0.035;
    }
  } else if (category === 'glacial') {
    roughness = 0.28;
    metalness = 0.35;
    bumpScale = 0.03;
  } else if (category === 'arid') {
    if (normSub === '플라야') {
      roughness = 0.08;
      metalness = 0.55;
      bumpScale = 0.015;
    } else {
      roughness = 0.95;
      metalness = 0.03;
      bumpScale = 0.025;
    }
  } else if (category === 'karst') {
    roughness = 0.72;
    metalness = 0.06;
    bumpScale = 0.042;
  } else if (category === 'coastal') {
    roughness = 0.65;
    metalness = 0.15;
    bumpScale = 0.03;
  } else {
    roughness = 0.72;
    metalness = 0.08;
    bumpScale = 0.03;
  }

  return {
    materialPreset: 'natural' as TerrainMaterialPreset,
    texturePattern: 'auto' as TexturePatternKey,
    roughness,
    metalness,
    bumpScale,
    opacity: 1.0,
  };
}

// ==========================================
// Inner 3D Diorama Mesh Component
// ==========================================
interface DioramaMeshProps {
  category: string;
  subTerrain: string;
  wireframe: boolean;
  reliefScale: number;
  showAnnotations: boolean;
  showStrata: boolean;
  evolutionStage: number;
  activeAnnotationIndex: number | null;
  onSelectAnnotation: (idx: number | null) => void;
  show3DContours: boolean;
  contourInterval: number;
  indexInterval: number;
  highlightElevation: number | null;
  contour3DTheme: Contour3DTheme;
  showSlicePlane: boolean;
  sliceElevation: number;
  demMinElevation: number;
  demMaxElevation: number;
  demField?: any;
  crossSectionLine?: { p1: [number, number]; p2: [number, number] } | null;
  crossSectionHoverPoint?: { x: number; y: number; z: number } | null;
  isCrossSection3DVisible?: boolean;
  materialPreset: TerrainMaterialPreset;
  texturePattern: TexturePatternKey;
  roughness: number;
  metalness: number;
  bumpScale: number;
  opacity: number;
}

const DioramaMesh: React.FC<DioramaMeshProps> = ({
  category,
  subTerrain,
  wireframe,
  reliefScale,
  showAnnotations,
  showStrata,
  evolutionStage,
  activeAnnotationIndex,
  onSelectAnnotation,
  show3DContours,
  contourInterval,
  indexInterval,
  highlightElevation,
  contour3DTheme,
  showSlicePlane,
  sliceElevation,
  demMinElevation,
  demMaxElevation,
  demField,
  crossSectionLine,
  crossSectionHoverPoint,
  isCrossSection3DVisible = true,
  materialPreset,
  texturePattern,
  roughness,
  metalness,
  bumpScale,
  opacity,
}) => {
  const normSub = resolveTerrainKey(subTerrain);

  // Generate solid diorama block geometry with terrain surface + geological strata skirts
  const geometry = useMemo(() => {
    return generateTerrainDioramaGeometry(
      category,
      subTerrain,
      reliefScale,
      showStrata,
      evolutionStage,
      materialPreset
    );
  }, [category, subTerrain, reliefScale, showStrata, evolutionStage, materialPreset]);

  const annotations: TerrainAnnotation[] = TERRAIN_ANNOTATIONS[normSub] || [];
  const bumpTexture = useMemo(
    () => getTerrainBumpTexture(texturePattern, category),
    [texturePattern, category]
  );

  // Isoline Contour Shader Uniforms Cache
  const uniformsRef = useRef<TerrainShaderUniforms>(
    createContourShaderUniforms({
      showContours: show3DContours,
      contourInterval,
      indexInterval,
      highlightElevation,
      theme: contour3DTheme,
    })
  );

  // Dynamic Uniforms update (0ms runtime update without recompiling shaders)
  useEffect(() => {
    updateContourShaderUniforms(uniformsRef.current, {
      showContours: show3DContours,
      contourInterval,
      indexInterval,
      highlightElevation,
      theme: contour3DTheme,
    });
  }, [show3DContours, contourInterval, indexInterval, highlightElevation, contour3DTheme]);

  // Hook into Three.js standard material shader pipeline
  const handleBeforeCompile = useCallback((shader: THREE.WebGLProgramParametersWithUniforms) => {
    injectContourShader(shader, uniformsRef.current);
  }, []);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* 1. Solid Diorama Mesh (Terrain Surface + 4 Side Strata Skirts + Bottom Plate) */}
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          wireframe={wireframe}
          bumpMap={wireframe ? undefined : bumpTexture}
          bumpScale={bumpScale}
          roughness={roughness}
          metalness={metalness}
          transparent={opacity < 0.99}
          opacity={opacity}
          onBeforeCompile={handleBeforeCompile}
          customProgramCacheKey={() => `terrain_mat_v5_${materialPreset}`}
        />
      </mesh>

      {/* 1-B. Interactive Elevation Slice Plane (수평 절단면) */}
      <ElevationSlicePlane
        visible={showSlicePlane}
        elevation={sliceElevation}
        minElevation={demMinElevation}
        maxElevation={demMaxElevation}
        theme={contour3DTheme}
      />

      {/* 1-C. 3D Cross-Section Visualizer (Phase 4: Laser Ribbon & Cut Surface Line) */}
      {demField && crossSectionLine && isCrossSection3DVisible && (
        <CrossSection3DVisualizer
          field={demField}
          line={crossSectionLine}
          hoverPoint={crossSectionHoverPoint || null}
        />
      )}

      {/* 2. Beveled Dark Obsidian Base Pedestal Rim */}
      <mesh position={[0, 0, -1.35]}>
        <boxGeometry args={[20.4, 20.4, 0.3]} />
        <meshStandardMaterial color="#0f1115" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* 3. Contextual 3D Special Meshes (Columns, Waterfalls, Lava, Water bodies, Caves, etc.) */}
      <TerrainSpecialMeshes
        normSub={normSub}
        category={category}
        reliefScale={reliefScale}
      />

      {/* 4. Interactive Geomorphic Feature Annotation Pins */}
      {showAnnotations &&
        annotations.map((anno, idx) => {
          const isSelected = activeAnnotationIndex === idx;
          // In group space (rotated -90 deg on X), coordinate mapping:
          // X -> X, Y -> Z (elevation), Z -> -Y
          const adjustedPos: [number, number, number] = [
            anno.position[0],
            anno.position[2],
            anno.position[1] * reliefScale + 0.5,
          ];

          return (
            <group key={idx} position={adjustedPos}>
              <Html distanceFactor={13} center>
                <div
                  className="group relative flex flex-col items-center pointer-events-auto cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAnnotation(isSelected ? null : idx);
                  }}
                >
                  {/* Pin Circle Marker */}
                  <div
                    className={`w-7 h-7 rounded-full font-bold flex items-center justify-center text-xs shadow-xl border-2 transition-all transform hover:scale-110 ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 border-white scale-110 ring-4 ring-amber-400/40'
                        : 'bg-[#FFCC00] text-slate-950 border-white/90 animate-bounce'
                    }`}
                  >
                    {idx + 1}
                  </div>

                  {/* Hover / Selected Callout Card */}
                  <div
                    className={`absolute bottom-8 bg-slate-950/95 text-white text-[11px] px-3 py-2 rounded-md shadow-2xl border border-white/20 whitespace-nowrap z-50 transition-all pointer-events-auto flex flex-col items-center min-w-[150px] max-w-[220px] ${
                      isSelected
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full gap-2 mb-0.5">
                      <span className="font-bold text-[#FFCC00] text-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        {anno.name}
                      </span>
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectAnnotation(null);
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-300 text-center leading-tight whitespace-normal font-sans">
                      {anno.description}
                    </p>
                    <div className="absolute -bottom-1 w-2 h-2 bg-slate-950 rotate-45 border-r border-b border-white/20" />
                  </div>
                </div>
              </Html>
            </group>
          );
        })}
    </group>
  );
};

// ==========================================
// Terrain Atmospheric Lighting & Environment Rig
// ==========================================
interface TerrainAtmosphereProps {
  category: string;
}

const TerrainEnvironmentRig: React.FC<TerrainAtmosphereProps> = ({ category }) => {
  const { scene } = useThree();

  const config = useMemo(() => {
    switch (category) {
      case 'volcanic':
        return {
          sunPos: [80, 20, 60] as [number, number, number],
          turbidity: 8.0,
          rayleigh: 2.6,
          keyColor: '#ffaa66',
          keyIntensity: 2.2,
          hemiSky: '#5e3229',
          hemiGround: '#241714',
          hemiIntensity: 0.85,
          rimColor: '#e05638',
          rimIntensity: 0.75,
          fogColor: '#1c1310',
          fogDensity: 0.015,
          preset: 'sunset' as const,
        };
      case 'glacial':
        return {
          sunPos: [100, 45, 90] as [number, number, number],
          turbidity: 0.2,
          rayleigh: 0.35,
          keyColor: '#f2f8ff',
          keyIntensity: 2.5,
          hemiSky: '#b8dcff',
          hemiGround: '#5a7894',
          hemiIntensity: 0.95,
          rimColor: '#90caff',
          rimIntensity: 0.9,
          fogColor: '#0f1826',
          fogDensity: 0.014,
          preset: 'dawn' as const,
        };
      case 'arid':
        return {
          sunPos: [80, 50, 40] as [number, number, number],
          turbidity: 9.0,
          rayleigh: 2.8,
          keyColor: '#fff2d6',
          keyIntensity: 2.6,
          hemiSky: '#ffdfa8',
          hemiGround: '#996939',
          hemiIntensity: 0.85,
          rimColor: '#ffd180',
          rimIntensity: 0.7,
          fogColor: '#211812',
          fogDensity: 0.017,
          preset: 'park' as const,
        };
      case 'karst':
        return {
          sunPos: [90, 28, 80] as [number, number, number],
          turbidity: 2.5,
          rayleigh: 1.2,
          keyColor: '#fffcee',
          keyIntensity: 2.1,
          hemiSky: '#b6e6d8',
          hemiGround: '#264d3b',
          hemiIntensity: 0.85,
          rimColor: '#5eead4',
          rimIntensity: 0.65,
          fogColor: '#121e1a',
          fogDensity: 0.015,
          preset: 'city' as const,
        };
      case 'coastal':
        return {
          sunPos: [100, 38, 80] as [number, number, number],
          turbidity: 1.2,
          rayleigh: 0.75,
          keyColor: '#fffef0',
          keyIntensity: 2.3,
          hemiSky: '#aae2ff',
          hemiGround: '#194361',
          hemiIntensity: 0.9,
          rimColor: '#38bdf8',
          rimIntensity: 0.75,
          fogColor: '#0e1d29',
          fogDensity: 0.015,
          preset: 'city' as const,
        };
      case 'fluvial':
      default:
        return {
          sunPos: [100, 35, 75] as [number, number, number],
          turbidity: 1.5,
          rayleigh: 0.9,
          keyColor: '#fffde6',
          keyIntensity: 2.2,
          hemiSky: '#cceeff',
          hemiGround: '#2e5223',
          hemiIntensity: 0.85,
          rimColor: '#86efac',
          rimIntensity: 0.65,
          fogColor: '#112022',
          fogDensity: 0.015,
          preset: 'city' as const,
        };
    }
  }, [category]);

  useEffect(() => {
    scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity);
    return () => {
      scene.fog = null;
    };
  }, [scene, config.fogColor, config.fogDensity]);

  return (
    <>
      <Sky sunPosition={config.sunPos} turbidity={config.turbidity} rayleigh={config.rayleigh} />
      <Environment preset={config.preset} />
      <hemisphereLight
        color={config.hemiSky}
        groundColor={config.hemiGround}
        intensity={config.hemiIntensity}
      />
      <directionalLight
        position={[14, 20, 10]}
        intensity={config.keyIntensity}
        color={config.keyColor}
        castShadow
        shadow-bias={-0.0005}
      />
      <directionalLight
        position={[-12, 10, -10]}
        intensity={config.rimIntensity}
        color={config.rimColor}
      />
      <directionalLight position={[0, -12, 6]} intensity={0.25} color="#edf4ff" />
    </>
  );
};

// ==========================================
// Main Export: Terrain3D Component
// ==========================================
export interface Terrain3DProps {
  category: string;
  subTerrain: string;
}

export default function Terrain3D({ category, subTerrain }: Terrain3DProps) {
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [reliefScale, setReliefScale] = useState(1.0);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showStrata, setShowStrata] = useState(true);
  const [evolutionStage, setEvolutionStage] = useState(4);
  const [activeAnnotationIndex, setActiveAnnotationIndex] = useState<number | null>(null);
  const [showDemSpecs, setShowDemSpecs] = useState(false);
  const [showContour2D, setShowContour2D] = useState(false);
  const [isContourModalOpen, setIsContourModalOpen] = useState(false);

  // Phase 3: 3D Surface Contour Isoline & Slicing Plane State
  const [show3DContours, setShow3DContours] = useState(true);
  const [contour3DTheme, setContour3DTheme] = useState<Contour3DTheme>('gold');
  const [highlightElevation, setHighlightElevation] = useState<number | null>(null);
  const [showSlicePlane, setShowSlicePlane] = useState(false);
  const [sliceElevation, setSliceElevation] = useState(0);
  const [contourDensity, setContourDensity] = useState(1.0); // 0.5 (dense), 1.0 (standard), 2.0 (sparse)
  const [showContourHUD, setShowContourHUD] = useState(false);

  // Phase 4 & 5: Cross-Section 2D/3D & Educational Guide State
  const [crossSectionLine, setCrossSectionLine] = useState<{ p1: [number, number]; p2: [number, number] } | null>(null);
  const [crossSectionHoverSample, setCrossSectionHoverSample] = useState<CrossSectionSample | null>(null);
  const [isCrossSection3DVisible, setIsCrossSection3DVisible] = useState(true);
  const [showProfileDock, setShowProfileDock] = useState(false);
  const [isReadingGuideOpen, setIsReadingGuideOpen] = useState(false);

  // Dynamic Material & Texture Customization State
  const [materialPreset, setMaterialPreset] = useState<TerrainMaterialPreset>('natural');
  const [texturePattern, setTexturePattern] = useState<TexturePatternKey>('auto');
  const [roughness, setRoughness] = useState(0.75);
  const [metalness, setMetalness] = useState(0.05);
  const [bumpScale, setBumpScale] = useState(0.035);
  const [materialOpacity, setMaterialOpacity] = useState(1.0);
  const [showMaterialHUD, setShowMaterialHUD] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);

  const hasActiveAdvancedTool =
    show3DContours || showSlicePlane || showProfileDock || wireframe || materialPreset !== 'natural';

  // Automatically adapt material & texture to optimal defaults when terrain category or subterrain changes!
  useEffect(() => {
    const def = getDefaultMaterialSettings(category, subTerrain);
    setRoughness(def.roughness);
    setMetalness(def.metalness);
    setBumpScale(def.bumpScale);
    setMaterialOpacity(def.opacity);
  }, [category, subTerrain]);

  const handleSelectPreset = (preset: TerrainMaterialPreset) => {
    setMaterialPreset(preset);
    const def = getDefaultMaterialSettings(category, subTerrain);
    if (preset === 'natural') {
      setRoughness(def.roughness);
      setMetalness(def.metalness);
      setBumpScale(def.bumpScale);
      setMaterialOpacity(1.0);
    } else if (preset === 'hypsometric') {
      setRoughness(0.65);
      setMetalness(0.08);
      setBumpScale(def.bumpScale);
    } else if (preset === 'thermal') {
      setRoughness(0.38);
      setMetalness(0.25);
      setBumpScale(0.025);
    } else if (preset === 'bedrock') {
      setRoughness(0.88);
      setMetalness(0.02);
      setBumpScale(def.bumpScale * 1.5);
    } else if (preset === 'obsidian') {
      setRoughness(0.12);
      setMetalness(0.85);
      setBumpScale(0.015);
    }
  };

  const handleResetMaterialDefaults = () => {
    const def = getDefaultMaterialSettings(category, subTerrain);
    setMaterialPreset(def.materialPreset);
    setTexturePattern(def.texturePattern);
    setRoughness(def.roughness);
    setMetalness(def.metalness);
    setBumpScale(def.bumpScale);
    setMaterialOpacity(def.opacity);
  };

  const controlsRef = useRef<any>(null);

  const setCameraView = (view: 'perspective' | 'top' | 'front' | 'profile') => {
    if (!controlsRef.current) return;
    setAutoRotate(false);

    if (view === 'top') {
      // Direct Top-down Aerial View
      controlsRef.current.object.position.set(0, 24, 0.01);
      controlsRef.current.target.set(0, 0, 0);
    } else if (view === 'front') {
      // Front Geological Cross-Section View
      controlsRef.current.object.position.set(0, 2.5, 20);
      controlsRef.current.target.set(0, 1.0, 0);
    } else if (view === 'profile') {
      // Side Profile View
      controlsRef.current.object.position.set(20, 2.5, 0);
      controlsRef.current.target.set(0, 1.0, 0);
    } else {
      // Perspective 3/4 Isometric View
      controlsRef.current.object.position.set(0, 10, 16);
      controlsRef.current.target.set(0, 0.5, 0);
    }
    controlsRef.current.update();
  };

  const normSub = resolveTerrainKey(subTerrain);
  const annotationList = TERRAIN_ANNOTATIONS[normSub] || [];

  // Phase 1 DEM Elevation Field & Contour Specification
  const demField = useMemo(() => {
    return generateTerrainElevationField(category, subTerrain, reliefScale, evolutionStage);
  }, [category, subTerrain, reliefScale, evolutionStage]);

  // Initialize slice plane height to median altitude when terrain changes
  useEffect(() => {
    if (demField) {
      setSliceElevation((demField.minElevation + demField.maxElevation) * 0.5);
      if (demField.crossSectionPresets && demField.crossSectionPresets.length > 0) {
        setCrossSectionLine({
          p1: demField.crossSectionPresets[0].p1,
          p2: demField.crossSectionPresets[0].p2,
        });
      } else {
        setCrossSectionLine({ p1: [-8, 0], p2: [8, 0] });
      }
      setCrossSectionHoverSample(null);
    }
  }, [demField.category, demField.terrainKey]);

  // Active highlighted elevation: Hovered from 2D or locked to current slice plane
  const activeHighlight =
    highlightElevation !== null
      ? highlightElevation
      : showSlicePlane
      ? sliceElevation
      : null;

  return (
    <div
      className="w-full h-full bg-radial from-slate-900 via-slate-950 to-black relative overflow-hidden select-none"
      onClick={() => setActiveAnnotationIndex(null)}
    >
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 10, 16], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
      >
        <TerrainEnvironmentRig category={category} />

        <React.Suspense fallback={null}>
          <DioramaMesh
            category={category}
            subTerrain={subTerrain}
            wireframe={wireframe}
            reliefScale={reliefScale}
            showAnnotations={showAnnotations}
            showStrata={showStrata}
            evolutionStage={evolutionStage}
            activeAnnotationIndex={activeAnnotationIndex}
            onSelectAnnotation={setActiveAnnotationIndex}
            show3DContours={show3DContours}
            contourInterval={demField.contourSettings.intermediateInterval * contourDensity}
            indexInterval={demField.contourSettings.indexInterval * contourDensity}
            highlightElevation={activeHighlight}
            contour3DTheme={contour3DTheme}
            showSlicePlane={showSlicePlane}
            sliceElevation={sliceElevation}
            demMinElevation={demField.minElevation}
            demMaxElevation={demField.maxElevation}
            demField={demField}
            crossSectionLine={crossSectionLine}
            crossSectionHoverPoint={
              crossSectionHoverSample
                ? {
                    x: crossSectionHoverSample.x,
                    y: crossSectionHoverSample.y,
                    z: crossSectionHoverSample.elevation,
                  }
                : null
            }
            isCrossSection3DVisible={isCrossSection3DVisible}
            materialPreset={materialPreset}
            texturePattern={texturePattern}
            roughness={roughness}
            metalness={metalness}
            bumpScale={bumpScale}
            opacity={materialOpacity}
          />
        </React.Suspense>

        <OrbitControls
          ref={controlsRef}
          enablePan
          enableZoom
          enableRotate
          maxPolarAngle={Math.PI / 2 + 0.05}
          minDistance={4}
          maxDistance={36}
          autoRotate={autoRotate}
          autoRotateSpeed={0.4}
        />
      </Canvas>

      {/* Top Left: Camera View Controls */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 pointer-events-none z-20">
        <div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur-md p-1 rounded-md border border-white/15 pointer-events-auto shadow-xl">
          <button
            onClick={() => setCameraView('perspective')}
            className="px-2.5 py-1 text-xs font-semibold text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1"
            title="기본 3D 입체 뷰"
          >
            <Eye className="w-3.5 h-3.5 text-[#FFCC00]" />
            입체
          </button>
          <button
            onClick={() => setCameraView('top')}
            className="px-2.5 py-1 text-xs font-semibold text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1"
            title="수직 항공 평면 뷰"
          >
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
            항공뷰
          </button>
          <button
            onClick={() => setCameraView('front')}
            className="px-2.5 py-1 text-xs font-semibold text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1"
            title="정면 지질 단면 뷰"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            단면뷰
          </button>
          <button
            onClick={() => setCameraView('profile')}
            className="px-2.5 py-1 text-xs font-semibold text-white/90 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1"
            title="측면 종단면 프로필"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            측면뷰
          </button>
        </div>
      </div>

      {/* Top Right: Streamlined Feature Controls & Tools Popover */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-none z-20">
        <div className="flex items-center gap-1 bg-slate-950/85 backdrop-blur-md p-1 rounded-lg border border-white/15 pointer-events-auto shadow-xl">
          {/* Toggle Strata */}
          <button
            onClick={() => setShowStrata(!showStrata)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
              showStrata
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-white/80 hover:bg-white/10'
            }`}
            title="하부 지질 단면 층리 표시"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">지질단면</span>
          </button>

          {/* Toggle Annotations */}
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 cursor-pointer ${
              showAnnotations
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                : 'text-white/80 hover:bg-white/10'
            }`}
            title="지형 특징 핀 표시"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">특징 핀</span>
          </button>

          {/* Toggle Auto Rotation */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              autoRotate ? 'text-amber-400 bg-white/10' : 'text-white/40 hover:text-white hover:bg-white/10'
            }`}
            title="자동 회전 On/Off"
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`}
              style={{ animationDuration: '8s' }}
            />
          </button>

          <div className="w-px h-4 bg-white/20 mx-0.5" />

          {/* Unified Advanced Tools Trigger */}
          <button
            onClick={() => setShowToolsMenu(!showToolsMenu)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              showToolsMenu || hasActiveAdvancedTool
                ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                : 'text-amber-300 hover:bg-amber-400/20'
            }`}
            title="고급 지형 분석 및 시각화 도구"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>고급 도구</span>
            {hasActiveAdvancedTool && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${showToolsMenu ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Unified Advanced Tools Popover Menu */}
      {showToolsMenu && (
        <div className="absolute top-14 right-3 z-30 w-80 sm:w-92 bg-slate-950/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl p-4 text-white pointer-events-auto animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300">
                <Sliders className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-white">고급 분석 및 시각화 도구</h4>
                <p className="text-[10px] text-slate-400">등고선 투영 · 절단면 · 단면도 · 재질</p>
              </div>
            </div>
            <button
              onClick={() => setShowToolsMenu(false)}
              className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* 1. 시각화 오버레이 제어 */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                지형 표면 시각화
              </span>
              <div className="space-y-2">
                {/* 3D 등고선 투영 */}
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                      3D 표면 등고선 투영
                    </span>
                    <button
                      onClick={() => setShow3DContours(!show3DContours)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                        show3DContours
                          ? 'bg-amber-400 text-slate-950 shadow-xs'
                          : 'bg-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {show3DContours ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  {show3DContours && (
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">테마:</span>
                      <div className="flex items-center gap-1">
                        {[
                          { key: 'gold', label: '골드' },
                          { key: 'ink', label: '잉크' },
                          { key: 'cyan', label: '시안' },
                        ].map((t) => (
                          <button
                            key={t.key}
                            onClick={() => setContour3DTheme(t.key as Contour3DTheme)}
                            className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                              contour3DTheme === t.key
                                ? 'bg-amber-400 text-slate-950 font-bold'
                                : 'bg-white/10 text-slate-300 hover:text-white'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 수평 절단면 */}
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-sky-400" />
                      수평 고도 절단면
                    </span>
                    <button
                      onClick={() => setShowSlicePlane(!showSlicePlane)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                        showSlicePlane
                          ? 'bg-sky-400 text-slate-950 shadow-xs'
                          : 'bg-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {showSlicePlane ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  {showSlicePlane && (
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">절단 표고:</span>
                        <span className="text-sky-300 font-bold font-mono">
                          {sliceElevation >= 0 ? '+' : ''}{sliceElevation.toFixed(2)}m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={demField.minElevation}
                        max={demField.maxElevation}
                        step={0.02}
                        value={sliceElevation}
                        onChange={(e) => setSliceElevation(parseFloat(e.target.value))}
                        className="w-full accent-sky-400 cursor-pointer h-1.5"
                      />
                    </div>
                  )}
                </div>

                {/* 단면도 분석 도크 */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    지형 횡단면도(Profile) 분석
                  </span>
                  <button
                    onClick={() => {
                      setShowProfileDock(!showProfileDock);
                      setIsCrossSection3DVisible(true);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      showProfileDock
                        ? 'bg-cyan-400 text-slate-950 shadow-xs'
                        : 'bg-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {showProfileDock ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* 격자망 (Wireframe) */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Grid className="w-3.5 h-3.5 text-slate-300" />
                    3D 표면 격자망 (Wireframe)
                  </span>
                  <button
                    onClick={() => setWireframe(!wireframe)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      wireframe
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'bg-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {wireframe ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. 지형 렌더링 재질 프리셋 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  지형 재질 프리셋
                </span>
                <button
                  onClick={handleResetMaterialDefaults}
                  className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  기본값 복원
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { key: 'natural', label: '자연' },
                  { key: 'hypsometric', label: '고도' },
                  { key: 'thermal', label: '열적외' },
                  { key: 'bedrock', label: '암석' },
                  { key: 'obsidian', label: '흑요석' },
                ].map((p) => {
                  const isSel = materialPreset === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => handleSelectPreset(p.key as TerrainMaterialPreset)}
                      className={`py-1.5 px-1 rounded text-center text-[10px] font-medium transition-all cursor-pointer border ${
                        isSel
                          ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. 지리 학습 가이드 및 사양 */}
            <div className="pt-2 border-t border-white/10 flex items-center gap-2">
              <button
                onClick={() => {
                  setIsReadingGuideOpen(true);
                  setShowToolsMenu(false);
                }}
                className="flex-1 py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>독도법 가이드</span>
              </button>
              <button
                onClick={() => {
                  setShowDemSpecs(true);
                  setShowToolsMenu(false);
                }}
                className="flex-1 py-1.5 px-2 bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>DEM 사양</span>
              </button>
            </div>
          </div>
        </div>
      )}






      {/* Bottom Controls: Relief Scale Slider, Evolution Stage & Subterrain Status */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2.5 pointer-events-none z-20">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Relief exaggeration slider */}
          <div className="bg-slate-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-md border border-white/15 flex items-center gap-2 text-xs text-white shadow-xl">
            <span className="text-gray-300 font-medium whitespace-nowrap text-[11px]">
              고저차 과장: <span className="text-[#FFCC00] font-bold">{reliefScale.toFixed(1)}x</span>
            </span>
            <input
              type="range"
              min="0.5"
              max="1.8"
              step="0.1"
              value={reliefScale}
              onChange={(e) => setReliefScale(parseFloat(e.target.value))}
              className="w-16 sm:w-24 accent-[#FFCC00] cursor-pointer"
            />
          </div>

          {/* Geological Evolution Stage Stepper */}
          <div className="bg-slate-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-md border border-white/15 flex items-center gap-1.5 text-xs text-white shadow-xl">
            <span className="text-gray-300 font-medium whitespace-nowrap flex items-center gap-1 text-[11px]">
              <Clock className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">형성 과정:</span>
            </span>
            <div className="flex items-center gap-1">
              {[
                { stage: 1, label: '1.초기' },
                { stage: 2, label: '2.발달' },
                { stage: 3, label: '3.침식' },
                { stage: 4, label: '4.현대' },
              ].map(({ stage, label }) => (
                <button
                  key={stage}
                  onClick={() => setEvolutionStage(stage)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                    evolutionStage === stage
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                  title={`${stage}단계 지형 발달 시뮬레이션`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Subterrain Status Pill */}
        <div className="bg-slate-950/80 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide flex items-center gap-2 border border-white/15 pointer-events-none shadow-xl">
          <span className="w-2 h-2 rounded-full bg-[#FFCC00] ring-2 ring-[#FFCC00]/30" />
          <span className="font-bold text-[#FFCC00]">{subTerrain}</span>
          <span className="text-gray-400 hidden sm:inline">• 3D 지질 블록 다이어그램</span>
        </div>
      </div>

      {/* Left Annotation Drawer (Features List on large screens) */}
      {showAnnotations && annotationList.length > 0 && (
        <div className="absolute left-3 top-16 hidden lg:flex flex-col gap-1 pointer-events-auto max-w-[220px] z-10">
          <div className="bg-slate-950/85 backdrop-blur-md p-2.5 rounded-md border border-white/15 text-white text-[11px] shadow-2xl">
            <div className="flex items-center gap-1.5 font-bold text-[#FFCC00] mb-2 pb-1.5 border-b border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              주요 지형 특성 ({annotationList.length})
            </div>
            <div className="space-y-1.5">
              {annotationList.map((a, i) => {
                const isSelected = activeAnnotationIndex === i;
                return (
                  <div
                    key={i}
                    onClick={() => setActiveAnnotationIndex(isSelected ? null : i)}
                    className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-400/20 text-white border border-amber-400/40'
                        : 'hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5 ${
                        isSelected ? 'bg-amber-400 text-slate-950' : 'bg-[#FFCC00] text-slate-950'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate text-[11px]">
                        {a.name}
                      </div>
                      <div className="text-[10px] text-gray-400 line-clamp-2 leading-tight">
                        {a.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* DEM Elevation Field & Contour Specification Panel (Phase 1) */}
      {showDemSpecs && (
        <div className="absolute right-3 top-16 z-30 w-80 sm:w-96 bg-slate-950/90 backdrop-blur-xl border border-amber-400/30 rounded-xl p-4 text-white shadow-2xl pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
              <MapIcon className="w-4 h-4 text-amber-400" />
              <span>수치표고모델(DEM) & 등고선 사양</span>
            </div>
            <button
              onClick={() => setShowDemSpecs(false)}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Grid Spec Overview */}
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div className="bg-white/5 p-2 rounded-lg border border-white/10">
              <div className="text-[10px] text-gray-400 font-medium">격자 해상도</div>
              <div className="text-xs font-bold text-white mt-0.5">{demField.segments} × {demField.segments}</div>
              <div className="text-[9px] text-gray-400">25,921 정점</div>
            </div>
            <div className="bg-white/5 p-2 rounded-lg border border-white/10">
              <div className="text-[10px] text-gray-400 font-medium">표고 범위(기복)</div>
              <div className="text-xs font-bold text-amber-300 mt-0.5">{demField.minElevation.toFixed(1)}m ~ {demField.maxElevation.toFixed(1)}m</div>
              <div className="text-[9px] text-gray-400">Δ {demField.reliefRange.toFixed(1)}m</div>
            </div>
            <div className="bg-white/5 p-2 rounded-lg border border-white/10">
              <div className="text-[10px] text-gray-400 font-medium">등고선 간격</div>
              <div className="text-xs font-bold text-emerald-400 mt-0.5">{demField.contourSettings.intermediateInterval}m</div>
              <div className="text-[9px] text-gray-400">주곡선 {demField.contourSettings.indexInterval}m</div>
            </div>
          </div>

          {/* Key Geomorphic Features on Contour Map */}
          {demField.features.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-200 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>지형 대표 구조선 및 피처</span>
              </div>
              <div className="space-y-1">
                {demField.features.map((feat) => (
                  <div key={feat.id} className="text-[11px] bg-white/5 px-2.5 py-1.5 rounded flex items-center justify-between border border-white/5">
                    <span className="font-medium text-white">{feat.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-400/20 text-amber-300 rounded">
                      {feat.type === 'crater' ? '화구/칼데라' :
                       feat.type === 'sinkhole' ? '싱크홀' :
                       feat.type === 'fault_line' ? '단층선' :
                       feat.type === 'cliff' ? '단애/절벽' :
                       feat.type === 'channel' ? '하도/수로' :
                       feat.type === 'peak' ? '독립봉' : '능선'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contour Map Reading Guide Tips */}
          <div>
            <div className="text-xs font-semibold text-gray-200 mb-1.5 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-sky-400" />
              <span>등고선 독도(讀圖) 핵심 가이드</span>
            </div>
            <ul className="text-[11px] text-gray-300 space-y-1 bg-white/5 p-2.5 rounded-lg border border-white/10 list-disc list-inside">
              {demField.contourReadingTips.map((tip, idx) => (
                <li key={idx} className="leading-snug">{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 2D Interactive Contour Map Floating Panel (Phase 2) */}
      {showContour2D && (
        <div className="absolute right-3 top-16 z-30 w-88 sm:w-[440px] md:w-[480px] h-[480px] sm:h-[520px] bg-slate-950/95 backdrop-blur-xl border border-[#FFCC00]/40 rounded-2xl shadow-2xl flex flex-col p-3 text-white pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#FFCC00] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#FFCC00]" />
                2D 등고선 캔버스 뷰
              </span>
              <span className="text-[10px] text-gray-400">
                (실시간 Marching Squares)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsContourModalOpen(true)}
                className="p-1 text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="등고선 지도 크게 보기"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowContour2D(false)}
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ContourMapView
              field={demField}
              isCompact={true}
              crossSectionLine={crossSectionLine}
              onCrossSectionChange={setCrossSectionLine}
              crossSectionHoverPoint={
                crossSectionHoverSample
                  ? {
                      x: crossSectionHoverSample.x,
                      y: crossSectionHoverSample.y,
                      z: crossSectionHoverSample.elevation,
                      t: crossSectionHoverSample.t,
                    }
                  : null
              }
              onCrossSectionHover={setCrossSectionHoverSample}
              onOpenReadingGuide={() => setIsReadingGuideOpen(true)}
              onHoverElevation={(elev) => setHighlightElevation(elev)}
              onClose={() => setShowContour2D(false)}
            />
          </div>
        </div>
      )}

      {/* Phase 4: Bottom Floating Elevation Profile Dock */}
      {showProfileDock && crossSectionLine && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[95%] max-w-2xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl shadow-2xl p-3 text-white pointer-events-auto animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-cyan-500/20 text-cyan-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-2">
                  3D ↔ 2D 단면도 크로스 인스펙션
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                    실시간 연동
                  </span>
                </h4>
                <p className="text-[10px] text-gray-400">
                  차트 위를 마우스로 스크러빙하면 3D 디오라마와 2D 지도 위의 대응 위치가 동기화됩니다.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsCrossSection3DVisible(!isCrossSection3DVisible)}
                className={`px-2 py-0.5 text-[10px] rounded font-semibold transition-colors ${
                  isCrossSection3DVisible
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-gray-400 hover:text-white bg-white/5'
                }`}
                title="3D 디오라마 상의 레이저 절단선 및 리본 On/Off"
              >
                3D 리본 {isCrossSection3DVisible ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setShowProfileDock(false)}
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="단면도 닫기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <ElevationProfileChart
            field={demField}
            line={crossSectionLine}
            hoverSample={crossSectionHoverSample}
            onHoverSample={setCrossSectionHoverSample}
            onSelectPreset={(preset: CrossSectionPreset) => {
              setCrossSectionLine({ p1: preset.p1, p2: preset.p2 });
            }}
          />
        </div>
      )}

      {/* Fullscreen/Modal 2D Contour Map (Phase 2) */}
      <ContourMapModal
        field={demField}
        isOpen={isContourModalOpen}
        crossSectionLine={crossSectionLine}
        onCrossSectionChange={setCrossSectionLine}
        crossSectionHoverPoint={
          crossSectionHoverSample
            ? {
                x: crossSectionHoverSample.x,
                y: crossSectionHoverSample.y,
                z: crossSectionHoverSample.elevation,
                t: crossSectionHoverSample.t,
              }
            : null
        }
        onCrossSectionHover={setCrossSectionHoverSample}
        onOpenReadingGuide={() => setIsReadingGuideOpen(true)}
        onHoverElevation={(elev) => setHighlightElevation(elev)}
        onClose={() => setIsContourModalOpen(false)}
      />

      {/* Phase 5: Educational Guide & Quiz Modal */}
      {isReadingGuideOpen && (
        <ContourReadingGuideModal
          field={demField}
          onClose={() => setIsReadingGuideOpen(false)}
        />
      )}
    </div>
  );
}
