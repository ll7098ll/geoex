import React, { forwardRef, useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MapPin,
  Box,
  ExternalLink,
  Compass,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Layers,
  Calendar,
  Mountain,
  Globe,
  Activity,
  Eye,
  AlertTriangle,
  Clock,
  Maximize2,
  Minimize2,
  BookOpen,
  FileText,
  Map as MapIcon,
  GitCompare,
} from 'lucide-react';
import Terrain3D from './Terrain3D';
import { TerrainCompareView } from './TerrainCompareView';
import { SearchResult as SearchResultType, Region, PlaceInfo } from '../types';
import { generateTerrainElevationField } from './terrain/terrainGenerators';
import { ContourMapModal } from './terrain/contour/ContourMapModal';

interface SearchResultProps {
  result: SearchResultType;
  region: Region;
  selectedTerrain: string | null;
  onSelectAlternativePlace?: (place: PlaceInfo) => void;
  onShufflePlace?: () => void;
}

export const SearchResult = forwardRef<HTMLDivElement, SearchResultProps>(
  ({ result, region, selectedTerrain, onSelectAlternativePlace }, ref) => {
    const { placeInfo, alternativePlaces } = result;
    const geology = placeInfo?.geology;
    const evolutionStages = placeInfo?.evolutionStages;
    const fieldGuide = placeInfo?.fieldGuide;

    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
    const [isContourModalOpen, setIsContourModalOpen] = useState<boolean>(false);

    // ESC key closes fullscreen 3D studio
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isFullscreen) {
          setIsFullscreen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullscreen]);

    // Prevent body scrolling while in fullscreen
    useEffect(() => {
      if (isFullscreen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [isFullscreen]);

    const resolvedSubTerrain =
      selectedTerrain && selectedTerrain !== '모든 지형'
        ? selectedTerrain
        : placeInfo?.terrain || '';

    const demField = useMemo(() => {
      return generateTerrainElevationField(result.categoryId, resolvedSubTerrain);
    }, [result.categoryId, resolvedSubTerrain]);

    return (
      <div ref={ref} className="bg-[#f8fafc] w-full relative z-30 min-h-screen pb-24 text-slate-800">
        {/* Fullscreen 3D Viewer Modal */}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <Box className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-white text-base">
                    {result.placeName} 3D 정밀 지형 시뮬레이터 ({resolvedSubTerrain})
                  </h3>
                  <p className="text-xs text-slate-400">
                    전체화면 몰입 모드 · 드래그 360° 회전 · 스크롤 줌 · 핀 클릭 시 상세 지형 정보
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors border border-slate-700 cursor-pointer shadow-sm"
              >
                <Minimize2 className="w-4 h-4 text-amber-400" />
                <span>전체화면 종료 (ESC)</span>
              </button>
            </div>
            <div className="flex-1 w-full h-full relative">
              <Terrain3D category={result.categoryId} subTerrain={resolvedSubTerrain} />
            </div>
          </div>
        )}

        {/* Map Hero Banner */}
        <div className="w-full h-[36vh] min-h-[280px] max-h-[400px] relative overflow-hidden bg-slate-950">
          <div className="absolute inset-0 w-full h-full">
            <iframe
              title={`${result.placeName} 위성 지도`}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(
                placeInfo?.mapQuery || result.placeName
              )}&t=k&z=13&ie=UTF8&iwloc=&output=embed`}
              className="w-full h-full border-0 opacity-80"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] via-transparent to-black/60 pointer-events-none" />

          {/* Banner Floating Metadata */}
          <div className="absolute bottom-0 left-0 w-full p-5 sm:p-8 md:p-10 max-w-7xl mx-auto pointer-events-none">
            <div className="flex items-center gap-2 mb-2 text-xs md:text-sm font-semibold text-slate-700 bg-white/90 backdrop-blur-md px-3 py-1 rounded-md shadow-sm border border-slate-200/60 w-fit pointer-events-auto">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              <span>{region === 'korea' ? '대한민국' : '전 세계'} · {selectedTerrain}</span>
            </div>

            <h2 className="text-2xl sm:text-4xl md:text-5xl font-serif font-bold text-slate-900 drop-shadow-sm leading-tight">
              {result.placeName}
            </h2>

            {placeInfo?.tagline && (
              <p className="mt-1.5 text-sm sm:text-base text-slate-700 font-medium max-w-3xl line-clamp-2 leading-relaxed">
                {placeInfo.tagline}
              </p>
            )}
          </div>
        </div>

        {/* Alternative Places Selection Strip (Clean & Focused) */}
        {alternativePlaces && alternativePlaces.length > 0 && (
          <div className="border-y border-slate-200 bg-white relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0 mr-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>이 지형의 다른 명소:</span>
                </span>
                {alternativePlaces.map((alt) => {
                  const isCurrent = placeInfo?.id === alt.id;
                  return (
                    <button
                      key={alt.id}
                      onClick={() => onSelectAlternativePlace?.(alt)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer border ${
                        isCurrent
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 active:scale-[0.98]'
                      }`}
                    >
                      <span>{alt.placeName}</span>
                      <ChevronRight className={`w-3 h-3 ${isCurrent ? 'text-slate-300' : 'text-slate-400'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            MAIN SECTION: 3D Interactive Diorama Studio OR Compare Mode
           ======================================================== */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
          {isCompareMode ? (
            <TerrainCompareView
              currentPlace={placeInfo}
              currentCategory={result.categoryId}
              currentSubTerrain={resolvedSubTerrain}
              region={region}
              onClose={() => setIsCompareMode(false)}
              onSelectNewBasePlace={onSelectAlternativePlace}
            />
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                {/* Unified Action Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-slate-100 bg-slate-50/80">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 shrink-0">
                      <Box className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                          3D 입체 지형 스튜디오
                        </h3>
                        <span className="text-xs text-slate-500">
                          / {resolvedSubTerrain}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 hidden sm:block">
                        지형학적 실측 특성에 기반한 3D 시뮬레이션
                      </p>
                    </div>
                  </div>

                  {/* Right Action Bar (Single Consolidated Zone) */}
                  <div className="flex items-center gap-2">
                    {/* 2D Contour Map Modal Trigger */}
                    <button
                      onClick={() => setIsContourModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-all border border-slate-200 shadow-2xs active:scale-95 cursor-pointer"
                      title="2D 인터랙티브 등고선도 지도 열기"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                      <span>2D 등고선도</span>
                    </button>

                    {/* Compare Mode Trigger */}
                    <button
                      onClick={() => setIsCompareMode(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-all border border-slate-200 shadow-2xs active:scale-95 cursor-pointer"
                      title="다른 지형과 나란히 비교하기"
                    >
                      <GitCompare className="w-3.5 h-3.5 text-amber-600" />
                      <span>두 지형 비교</span>
                    </button>

                    {/* Fullscreen Trigger */}
                    <button
                      onClick={() => setIsFullscreen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
                      title="3D 모델 전체화면으로 크게 보기"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>전체화면</span>
                    </button>
                  </div>
                </div>

                {/* 3D Canvas Box */}
                <div className="w-full h-[460px] sm:h-[520px] md:h-[560px] bg-slate-950 relative border-b border-slate-800">
                  <Terrain3D category={result.categoryId} subTerrain={resolvedSubTerrain} />
                </div>

                {/* Sleek Geological Profile Ribbon (No Boxy Cards) */}
                {geology && (
                  <div className="bg-white px-4 sm:px-6 py-3.5 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>핵심 지질 프로필</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
                      <div className="pt-2 sm:pt-0 sm:pr-3">
                        <div className="text-slate-400 text-[11px] mb-0.5">지질 시대</div>
                        <div className="font-bold text-slate-800 truncate">{geology.geologicalAge}</div>
                      </div>

                      <div className="pt-2 sm:pt-0 sm:px-3">
                        <div className="text-slate-400 text-[11px] mb-0.5">암석 종류</div>
                        <div className="font-bold text-slate-800 truncate">{geology.rockType}</div>
                      </div>

                      <div className="pt-2 sm:pt-0 sm:px-3">
                        <div className="text-slate-400 text-[11px] mb-0.5">지체 구조</div>
                        <div className="font-bold text-slate-800 truncate">{geology.tectonicSetting}</div>
                      </div>

                      <div className="pt-2 sm:pt-0 sm:px-3">
                        <div className="text-slate-400 text-[11px] mb-0.5">주요 형성 인자</div>
                        <div className="font-bold text-slate-800 truncate">{geology.geomorphicAgent}</div>
                      </div>

                      {geology.scale && (
                        <div className="pt-2 sm:pt-0 sm:pl-3 col-span-2 sm:col-span-4 lg:col-span-1">
                          <div className="text-slate-400 text-[11px] mb-0.5">대표 규모</div>
                          <div className="font-bold text-slate-800 truncate">
                            {geology.scale.elevationMeters
                              ? `해발 ${geology.scale.elevationMeters}m`
                              : geology.scale.areaKm2
                              ? `면적 ${geology.scale.areaKm2}㎢`
                              : geology.scale.lengthKm
                              ? `연장 ${geology.scale.lengthKm}km`
                              : '실측치 참조'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            SECTION 2: CLEAN SINGLE KNOWLEDGE FEED (단일 지식 피드)
           ======================================================== */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-10">
          {/* Part 1: 지형 진화 4단계 타임라인 (Terrain Evolution Timeline) */}
          {evolutionStages && evolutionStages.length > 0 && (
            <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                      지형 진화 4단계 타임라인
                    </h3>
                    <p className="text-xs text-slate-500">
                      기반암 태동부터 현대 경관 완성까지의 지구과학적 형성 과정
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {evolutionStages.map((stage) => (
                  <div
                    key={stage.stageNumber}
                    className="p-4 rounded-lg bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span className="font-bold text-amber-700">0{stage.stageNumber}단계</span>
                        <span>{stage.timeframe}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1.5">{stage.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">{stage.process}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/70 flex items-center gap-1.5 text-xs text-slate-700">
                      <Eye className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="line-clamp-2">{stage.visualKeyFeature}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Part 2: 현장 탐험 및 관찰 가이드 (Observation Points & Field Tips) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Core Observation Points */}
            <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-100">
                <Compass className="w-5 h-5 text-emerald-600" />
                <div>
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                    현장 탐험 시 핵심 관찰 포인트
                  </h4>
                  <p className="text-xs text-slate-500">
                    실제 지형 방문 시 눈여겨보아야 할 주요 증거
                  </p>
                </div>
              </div>

              {placeInfo?.observationPoints && placeInfo.observationPoints.length > 0 ? (
                <ul className="space-y-2.5">
                  {placeInfo.observationPoints.map((pt, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs sm:text-sm text-slate-700 leading-snug"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 py-3">관찰 포인트 데이터 준비 중입니다.</p>
              )}
            </div>

            {/* Right: Visiting Tips & Safety */}
            <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-100">
                  <Calendar className="w-5 h-5 text-teal-600" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                      탐방 시기 및 자연유산 보전
                    </h4>
                    <p className="text-xs text-slate-500">안전하고 유익한 지리 탐방 안내</p>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs sm:text-sm">
                  {fieldGuide?.bestVisitingSeason && (
                    <div>
                      <span className="font-semibold text-slate-500 text-xs block mb-1">최적 방문 시기</span>
                      <p className="text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                        {fieldGuide.bestVisitingSeason}
                      </p>
                    </div>
                  )}

                  {fieldGuide?.cautionAndConservation ? (
                    <div>
                      <span className="font-semibold text-slate-500 text-xs block mb-1">안전 유의사항</span>
                      <p className="text-amber-950 bg-amber-50/70 p-3 rounded-lg border border-amber-200/60 leading-relaxed flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{fieldGuide.cautionAndConservation}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs">
                      현장 탐방 시 지정된 관람로를 준수하고 자연 지형을 훼손하지 않도록 유의하세요.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 text-right">
                <span className="text-[11px] text-slate-400">
                  자연유산은 수억 년에 걸쳐 형성된 인류 공통의 자연 자산입니다.
                </span>
              </div>
            </div>
          </div>

          {/* Part 3: 심층 지형학적 형성 보고서 & 참고 자료 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Geographic Briefing & External References */}
            <div className="lg:col-span-4 space-y-6">
              {/* Geographic Overview */}
              <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                  <Compass className="w-4.5 h-4.5 text-slate-700" />
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                    지리적 위치 및 형성 개요
                  </h4>
                </div>
                <div className="prose prose-sm text-slate-600 leading-relaxed text-xs sm:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.mapsDescription}</ReactMarkdown>
                </div>
              </div>

              {/* Map & Exploration Links */}
              <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                  <MapIcon className="w-4.5 h-4.5 text-slate-700" />
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                    지도 및 탐방 바로가기
                  </h4>
                </div>
                <div className="space-y-2">
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(
                      placeInfo?.mapQuery || result.placeName
                    )}&t=k`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-sky-600" />
                      <span>Google 지도 위성뷰</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>

                  {region === 'korea' && (
                    <a
                      href={`https://map.naver.com/p/search/${encodeURIComponent(
                        placeInfo?.mapQuery || result.placeName
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-800"
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span>네이버 지도 고해상도 항공뷰</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>
                  )}

                  {result.mapsLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs font-medium text-slate-700"
                    >
                      <span className="truncate pr-2">{link.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Scholarly References */}
              {result.searchSources.length > 0 && (
                <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
                    <FileText className="w-4.5 h-4.5 text-slate-700" />
                    <h4 className="font-bold text-slate-900 text-sm">
                      학술 및 지리 참고 자료
                    </h4>
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {result.searchSources.map((source, idx) => (
                      <li key={idx}>
                        <a
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 hover:text-slate-900 flex items-center justify-between gap-2 py-1 transition-colors"
                        >
                          <span className="truncate">{source.title}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right Column: Comprehensive Scientific Article */}
            <div className="lg:col-span-8">
              <article className="bg-white p-6 sm:p-8 md:p-10 shadow-xs border border-slate-200 rounded-xl prose prose-slate max-w-none prose-headings:font-serif prose-h2:text-xl sm:prose-h2:text-2xl prose-h3:text-lg sm:prose-h3:text-xl prose-p:text-sm sm:prose-p:text-[15px] prose-p:leading-relaxed prose-li:text-sm sm:prose-li:text-[15px] prose-a:text-amber-700 hover:prose-a:text-amber-800">
                <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-100 text-slate-900 font-bold text-base">
                  <BookOpen className="w-5 h-5 text-amber-600" />
                  <span>심층 지형학적 형성 보고서</span>
                </div>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.description}</ReactMarkdown>
              </article>
            </div>
          </div>
        </div>

        {/* 2D Contour Map Modal Dialog */}
        <ContourMapModal
          field={demField}
          isOpen={isContourModalOpen}
          onClose={() => setIsContourModalOpen(false)}
        />
      </div>
    );
  }
);

SearchResult.displayName = 'SearchResult';
