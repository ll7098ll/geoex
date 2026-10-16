import * as THREE from 'three';
import { fbm, getHexBasaltColumn, warpedFbm, smoothstep, mixColor, TerrainEvalResult } from '../terrainMath';

export function evalVolcanicTerrain(
  normSub: string,
  x: number,
  y: number,
  reliefScale: number
): TerrainEvalResult | null {
  const d = Math.sqrt(x * x + y * y);
  const angle = Math.atan2(y, x);
  const color = new THREE.Color();
  let h = 0;

  // 1. 기생화산 (제주 분석구 / 오름 - 예: 다랑쉬오름, 금오름)
  if (normSub === '기생화산') {
    // 30도 안식각(Angle of Repose)을 가진 완벽한 원추형 분석구
    const coneR = 7.4;
    const coneH = Math.max(0, 4.8 * Math.pow(1.0 - Math.min(1.0, d / coneR), 1.15));
    
    // 깊은 원형 산정 화구호 (Crater bowl)
    const craterR = 2.4;
    const inCrater = d < craterR;
    const craterDepth = inCrater ? Math.cos((d / craterR) * Math.PI * 0.5) * 3.2 : 0;
    
    // 말굽형 분화구 유출구 (용암류가 화구륜의 한쪽을 무너뜨리고 흘러나간 Breach gap)
    const breachAngle = Math.atan2(y - 0.8, x - 2.6);
    const angleDiff = Math.abs(breachAngle - 0.35);
    const isBreach = angleDiff < 0.55 && d > 1.4 && d < 6.2;
    const breachCut = isBreach ? Math.cos((angleDiff / 0.55) * Math.PI * 0.5) * 1.5 : 0;
    
    // 스코리아(송이석) 쇄설물 방사상 침식 홈 (Gullies)
    const scoriaRibs = Math.abs(Math.sin(angle * 7 + fbm(x * 0.6, y * 0.6) * 2.0)) * 0.22 * smoothstep(1.8, 6.5, d);

    h = Math.max(0.35, (coneH - craterDepth - breachCut + scoriaRibs + fbm(x * 1.5, y * 1.5) * 0.18) * reliefScale);

    if (d < 0.95) {
      // 화구 바닥 습지 및 고요한 천연 화구호 (백록담/금오름 산정 호수)
      color.set(mixColor('#1a382c', '#295444', fbm(x * 6, y * 6)));
    } else if (inCrater) {
      // 분화구 내벽: 붉은색 산화 스코리아(송이석) 및 다공질 현무암
      color.set(mixColor('#5c281a', '#3d160c', fbm(x * 7, y * 7)));
    } else if (h > 2.9 * reliefScale) {
      // 화구륜 정상 능선: 은빛 억새풀(Silver grass)과 낮은 관목
      color.set(mixColor('#828c46', '#9fa355', fbm(x * 3, y * 3)));
    } else {
      // 사면: 푸른 제주 초원 지대
      color.set(mixColor('#385e2b', '#4c7a3a', fbm(x * 2, y * 2)));
    }
    return { height: h, color };
  }

  // 2. 화산 (성층화산 - 백두산, 후지산 스타일 원추형 성층 복합화산체)
  if (normSub === '화산') {
    const rimRadius = 1.45;
    const peakHeight = 4.6;
    const floorHeight = 3.05;

    let baseH = 0;
    const inCrater = d < rimRadius;

    if (inCrater) {
      // 화구 내부: 중심부(d=0) 용암 분출구로 갈수록 가파르게 파여 들어가는 깔때기형 화구
      const t = d / rimRadius;
      baseH = floorHeight + (peakHeight - floorHeight) * Math.pow(t, 1.7);
    } else {
      // 외곽 사면: 정상부(33도 안식각)에서 기저부(8도)로 유려하게 뻗어나가는 성층화산 오목 곡면
      const distFromRim = d - rimRadius;
      baseH = peakHeight * Math.exp(-distFromRim * 0.32);
    }

    // 화구륜 정상의 거친 암봉 능선 요철 (Crater rim peaks)
    const rimJagged = Math.sin(angle * 8 + fbm(x * 1.5, y * 1.5) * 2.5) * 0.22 * smoothstep(0.8, 1.45, d) * (1.0 - smoothstep(1.45, 2.5, d));

    // 방사상 개식곡 (Barrancos): 빗물과 용암이 화산 사면을 깎아내린 깊은 V자 방사상 계곡
    const barrancos = -Math.pow(Math.abs(Math.sin(angle * 5.0 + fbm(x * 0.4, y * 0.4) * 2.2)), 2.2) * 0.65 * smoothstep(1.7, 7.5, d);

    // 측화산 / 기생화산 (측화구): 산록 동남쪽 틈새 분출로 솟아오른 분석구 (Parasitic Cinder Cone)
    const dSide = Math.hypot(x - 4.2, y + 2.0);
    const sideCone = Math.max(0, 1.4 * Math.pow(Math.max(0, 1.0 - dSide / 1.9), 1.3));
    const sideCrater = dSide < 0.4 ? (1.0 - dSide / 0.4) * 0.5 : 0;
    const pc = Math.max(0, sideCone - sideCrater);

    // 굳어버린 흑색 용암류 엽상체 둑 (Lava flow tongue): 서북쪽으로 흘러내린 용암 지대
    const lavaFlowAngle = 2.4;
    const angleDiff = Math.abs(angle - lavaFlowAngle);
    const isLava = angleDiff < 0.32 && d > 1.6 && d < 7.2;
    const lavaLobe = isLava ? Math.cos((angleDiff / 0.32) * Math.PI * 0.5) * 0.38 * (1.0 + fbm(x * 2.0, y * 2.0) * 0.4) : 0;

    h = Math.max(0.2, (baseH + rimJagged + barrancos + pc + lavaLobe + fbm(x * 1.2, y * 1.2) * 0.18) * reliefScale);

    if (d < 0.85) {
      // 화구 바닥: 유황 증기 분기공 및 굳은 흑색 화산암 찌꺼기
      color.set(mixColor('#1c130f', '#36180c', fbm(x * 6, y * 6)));
    } else if (inCrater) {
      // 화구 내벽 절벽: 산화된 붉은 스코리아 암벽과 유황 노란 반점
      const isSulfur = fbm(x * 4, y * 4) > 0.65;
      color.set(isSulfur ? '#8c782b' : mixColor('#4d2318', '#38160e', fbm(x * 5, y * 5)));
    } else if (isLava) {
      // 용암류 엽상체: 거친 암흑색 아아(A'a) 용암암설
      color.set(mixColor('#1f1c1a', '#29231f', fbm(x * 8, y * 8)));
    } else if (dSide < 1.6) {
      // 측화산 (분석구): 적갈색 스코리아(송이석)
      color.set(mixColor('#542b1f', '#3d1d14', fbm(x * 5, y * 5)));
    } else if (h > 3.8 * reliefScale) {
      // 정상부 고산 암설대: 화산재와 풍화된 거친 암석
      color.set(mixColor('#38302a', '#241e1a', fbm(x * 4, y * 4)));
    } else if (h > 2.0 * reliefScale) {
      // 중턱: 한랭 건조 관목림 및 고산 왜곡 소나무
      color.set(mixColor('#4a572e', '#3c4024', fbm(x * 3, y * 3)));
    } else {
      // 산록 기저부: 지하수가 풍부한 울창한 온대 활엽수림
      color.set(mixColor('#2b4920', '#3b612d', fbm(x * 2, y * 2)));
    }
    return { height: h, color };
  }

  // 3. 칼데라 (백두산 천지 모델 - 거대한 함몰 칼데라호와 외륜산 16봉)
  if (normSub === '칼데라') {
    // 백두산 천지는 남북 약 4.4km, 동서 약 3.6km의 장대한 타원형 칼데라
    // 정규화된 타원 좌표계 (North-South elongated ellipse, semi-minor X=3.85, semi-major Y=4.55)
    const ex = x / 3.85;
    const ey = (y + 0.25) / 4.55;
    const dShore = Math.hypot(ex, ey);
    const rimAngle = Math.atan2(y + 0.25, x);

    // 외륜산 림의 유기적 불규칙 곡률 (기본 1.25, 폭 0.95~1.35)
    const rimCurve = 1.25 + Math.sin(rimAngle * 3.0 + 0.8) * 0.04 + fbm(x * 0.35, y * 0.35) * 0.06;
    const waterLevel = 1.62;
    const lakeFloor = 0.55;

    // 외륜산 정상 능선 기본 고도 (4.4 ~ 5.2)
    // 외륜산 16개 암봉 (장군봉 2,744m, 백운봉 2,691m, 천문봉 2,670m 등)
    let rimPeakH = 4.5;
    // 16개 봉우리 리듬 파형
    const sixteenPeaks = Math.sin(rimAngle * 8.0) * 0.38 + Math.cos(rimAngle * 16.0) * 0.18;
    rimPeakH += sixteenPeaks;

    // 장군봉 (남동쪽 최고봉 [2.2, -4.2]): 웅장한 화구벽 주봉
    const janggunDist = Math.hypot(x - 2.2, y + 4.2);
    if (janggunDist < 2.4) {
      rimPeakH += Math.cos((janggunDist / 2.4) * Math.PI * 0.5) * 0.65;
    }
    // 백운봉 (서쪽 기암봉 [-4.4, 0.2]): 백색 부석의 가파른 첨봉
    const baegunDist = Math.hypot(x + 4.4, y - 0.2);
    if (baegunDist < 2.2) {
      rimPeakH += Math.cos((baegunDist / 2.2) * Math.PI * 0.5) * 0.5;
    }

    let baseH = 0;

    if (dShore <= 1.0) {
      // 1) [천지 호수 바닥] 수면(1.62) 아래 384m 깊이의 U자형 침강 호저
      // dShore=0일 때 lakeFloor(0.55), 호안선(dShore=1.0)에서 수면 살짝 아래(1.50)
      const tFloor = dShore; // 0 at center, 1 at shoreline
      baseH = lakeFloor + (waterLevel - 0.12 - lakeFloor) * Math.pow(tFloor, 1.7);
    } else if (dShore <= rimCurve) {
      // 2) [외륜산 내벽 대단애 (화구벽)]
      // 호안선(dShore=1.0)에서 정상 림(dShore=rimCurve)까지 솟구치는 65~75도 깎아지른 수직 암벽
      const tCliff = (dShore - 1.0) / (rimCurve - 1.0); // 0 at shore, 1 at rim
      baseH = (waterLevel - 0.12) + (rimPeakH - (waterLevel - 0.12)) * Math.pow(tCliff, 1.35);

      // 내벽 화구벽의 수직 침식 절리 및 너덜(Talus) 골짜기
      const cliffCrevices = Math.sin(rimAngle * 18.0 + fbm(x * 1.5, y * 1.5) * 4.0) * 0.26 * tCliff;
      baseH += cliffCrevices;
    } else {
      // 3) [외곽 산록 사면 (백두용암대지)]
      // 정상 림에서 사방으로 부드럽게 펼쳐지는 완경사 화산 산록
      const distOut = (dShore - rimCurve) * 4.5;
      baseH = rimPeakH * Math.exp(-distOut * 0.32);

      // 외곽 방사상 개식곡 (바랑코 협곡)
      const barrancos = -Math.pow(Math.abs(Math.sin(rimAngle * 6.0 + fbm(x * 0.3, y * 0.3) * 2.0)), 2.0) * 0.42 * smoothstep(0.4, 4.5, distOut);
      baseH += barrancos;
    }

    // 4) [북쪽 달문(Moon Gate) 배출구 협곡]
    // 북쪽 외륜산이 V자로 깊게 침식되어 천지 호숫물이 장백폭포로 흘러나가는 물길
    const dalmunX = Math.abs(x);
    if (y > 3.0 && y < 7.6 && dalmunX < 1.5) {
      const cutFactor = Math.cos((dalmunX / 1.5) * Math.PI * 0.5);
      const breachDepth = cutFactor * 3.4;
      // 달문 협곡 바닥을 수면(1.62)에서 북쪽으로 완만하게 하강하도록 조성
      const gorgeFloor = waterLevel + 0.02 - (y - 3.0) * 0.07;
      baseH = Math.max(gorgeFloor, baseH - breachDepth);
    }

    // 외륜산 정상부의 날카로운 톱니 암봉 질감
    const distToRimPeak = Math.abs(dShore - rimCurve);
    const cragDetail = Math.sin(rimAngle * 22.0 + fbm(x * 2.0, y * 2.0) * 3.0) * 0.24 * Math.exp(-Math.pow(distToRimPeak / 0.12, 2.0));

    h = Math.max(0.25, (baseH + cragDetail + fbm(x * 1.2, y * 1.2) * 0.12) * reliefScale);

    // ==========================================
    // 지질학적 색상 분포 (백두산 특유의 백색 부석 & 고산 생태)
    // ==========================================
    if (dShore <= 1.0) {
      // 1) 천지 호수 바닥 암반: 수심에 따른 짙고 신비로운 심해 흑현무암
      color.set(mixColor('#091a27', '#11293a', fbm(x * 3, y * 3)));
    } else if (dShore <= rimCurve + 0.12) {
      // 2) 외륜산 내벽 절벽: 백두산 상징 백색 부석층(Pumice) + 흑갈색 조면암 층리
      const strataNoise = fbm(x * 2.5, y * 2.5);
      const isPumiceLayer = h > 3.4 * reliefScale; // 상부 1,000m는 천년 대분화 백색 부석

      if (isPumiceLayer) {
        // 백두(白頭)를 상징하는 백색·크림색 유문암질 경석
        const pumiceTone = mixColor('#e2ded4', '#ccc5b4', strataNoise);
        color.set(pumiceTone);
      } else {
        // 중하부 조면암·안산암질 수직 단애벽
        const rockStrata = Math.sin(h * 6.5 + strataNoise * 2.0) * 0.5 + 0.5;
        const cliffTone = mixColor('#4d4640', '#6c6257', rockStrata);
        color.set(cliffTone);
      }
    } else {
      // 3) 외곽 산록 완경사면 (백두용암대지)
      if (h > 3.6 * reliefScale) {
        // 산정부 능선 부근: 백색 부석 자갈과 풍화토
        color.set(mixColor('#bcb5a5', '#9c9586', fbm(x * 3, y * 3)));
      } else if (h > 2.5 * reliefScale) {
        // 고산 툰드라 초지 (노랑만병초, 담자리꽃나무 등 고산 초원)
        color.set(mixColor('#6f793e', '#88934d', fbm(x * 2.5, y * 2.5)));
      } else {
        // 산록 하부 침엽수림대 (자작나무와 가문비나무 타이가)
        color.set(mixColor('#274620', '#395d2c', fbm(x * 2, y * 2)));
      }
    }

    return { height: h, color };
  }

  // 4. 주상절리 (제주 대포동, 북아일랜드 자이언츠 코즈웨이)
  if (normSub === '주상절리') {
    // 규칙적인 육각 기둥 격자(Hexagonal prism lattice)로 개별 높이 양자화!
    const hex = getHexBasaltColumn(x, y, 0.55);
    
    // 해안선 경계 (동쪽은 육지 주상절리 고원, 서쪽은 바다로 떨어지는 계단 단애)
    const coastLine = fbm(y * 0.35, 0) * 1.6 - 0.6;
    const distToCoast = x - coastLine;

    // 조인트 틈새 폭 (냉각 수축 균열 홈)
    const isCrack = hex.edgeDist < 0.055;

    if (distToCoast > 0) {
      // 해안가로 갈수록 계단식으로 낮아지는 주상절리 테라스
      const stepTier = Math.floor(distToCoast / 1.6);
      const baseH = 1.6 + stepTier * 0.85;
      const columnVariation = hex.cellId * 0.45;
      
      // 기둥 상부의 자연스러운 미세 오목 접시 형태 (Cooling basin)
      const dish = -0.04 * hex.relDist * hex.relDist;
      
      h = (baseH + columnVariation + dish - (isCrack ? 0.8 : 0)) * reliefScale;

      if (isCrack) {
        // 균열 내부의 짙은 그늘과 산화철 풍화 침전물
        color.set(mixColor('#0a0b0d', '#1a1410', fbm(x * 8, y * 8)));
      } else if (distToCoast < 1.5) {
        // 바닷물이 튀는 젖은 암갈색-암회색 현무암
        color.set(mixColor('#16181b', '#24272c', hex.cellId));
      } else {
        // 건조한 상부 주상절리: 짙은 회색 현무암 및 틈새 이끼
        color.set(mixColor('#2c2e32', '#3e4147', hex.cellId * 0.4 + fbm(x * 3, y * 3) * 0.3));
      }
    } else {
      // 바다 밑 파식 기저면 (수중 침식된 기둥 잔해)
      h = (0.25 + fbm(x * 1.5, y * 1.5) * 0.25) * reliefScale;
      color.set(mixColor('#0a1d2b', '#102d42', fbm(x * 3, y * 3)));
    }
    return { height: h, color };
  }

  // 5. 용암동굴 (제주 만장굴, 김녕사굴)
  if (normSub === '용암동굴') {
    // 파호이호이 새끼줄 용암이 굳은 현무암 평원
    const tubePath = Math.sin(y * 0.42) * 2.6;
    const distToTube = Math.abs(x - tubePath);
    const isBridgeArch = Math.abs(y - 2.8) < 1.1; // 붕괴되지 않고 다리처럼 남은 천연교
    
    h = (2.4 + warpedFbm(x * 0.5, y * 0.5, 3) * 0.5) * reliefScale;

    if (distToTube < 1.8) {
      if (!isBridgeArch) {
        // 천장이 함몰되어 드러난 라바튜브 협곡 (천창/붕괴구)
        const trenchDepth = Math.cos((distToTube / 1.8) * Math.PI * 0.5) * 2.9;
        h -= trenchDepth * reliefScale;
        
        // 동굴 바닥/내벽 색채
        if (h < 0.6 * reliefScale) {
          color.set(mixColor('#120e0c', '#0a0705', fbm(x * 6, y * 6)));
        } else {
          color.set(mixColor('#2e221c', '#3d2e26', fbm(x * 4, y * 4)));
        }
      } else {
        // 천연 현무암 아치교 표면
        color.set(mixColor('#382e26', '#4a3d34', fbm(x * 4, y * 4)));
      }
    } else {
      // 지표면 파호이호이 밧줄구조 용암류
      color.set(mixColor('#282422', '#3a3430', fbm(x * 2, y * 2)));
    }
    return { height: h, color };
  }

  // 6. 단층 산맥 (경동지괴 / 단층애 - 미국의 시에라네바다, 한반도 태백산맥)
  if (normSub === '단층 산맥') {
    const faultX = Math.sin(y * 0.15) * 0.6; // 약간 굽은 단층선
    
    if (x >= faultX) {
      // 배후 완경사면 (경동지괴 / Dip Slope)
      const dip = (x - faultX) / 10.0;
      h = (4.8 - dip * 3.8 + fbm(x * 0.8, y * 0.8) * 0.5) * reliefScale;
      color.set(mixColor('#385628', '#4b6e37', fbm(x * 2, y * 2)));
    } else {
      // 급격한 수직 단층애 (Fault Scarp, 55도 경사)
      const distToFault = faultX - x;
      if (distToFault < 1.1) {
        // V자 계곡 침식으로 형성된 삼각말단면 (Triangular Facets)
        const gully = Math.abs(Math.sin(y * 1.8)) * 0.45;
        h = (4.8 - (distToFault / 1.1) * 4.4 - gully) * reliefScale;
        color.set(mixColor('#574e46', '#70655b', fbm(x * 6, y * 6)));
      } else {
        // 단층 침강 지구대 분지 (Graben Valley Floor)
        h = (0.5 + fbm(x * 1.2, y * 1.2) * 0.3) * reliefScale;
        color.set(mixColor('#695f4c', '#7d725c', fbm(x * 3, y * 3)));
      }
    }
    if (h > 4.0 * reliefScale) {
      color.set(mixColor('#827b74', '#9e9790', fbm(x * 4, y * 4)));
    }
    return { height: h, color };
  }

  return null;
}
