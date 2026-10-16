import * as THREE from 'three';
import { fbm, smoothstep, mixColor, TerrainEvalResult } from '../terrainMath';

export function evalGlacialTerrain(
  normSub: string,
  x: number,
  y: number,
  reliefScale: number
): TerrainEvalResult | null {
  const d = Math.sqrt(x * x + y * y);
  const color = new THREE.Color();
  let h = 0;

  // 1. 혼 (빙하 침식으로 깎인 날카로운 3~4각 뿔 봉우리 - 마터호른)
  if (normSub === '혼') {
    // 3방향 칼날 능선 (Arêtes / 아레테)
    const angle = Math.atan2(y, x);
    const arete1 = Math.abs(Math.cos(angle * 1.5));
    const areteSharpness = Math.pow(arete1, 5.0) * 1.6;

    // 정상 피라미드 가파른 사면
    const peak = Math.max(0, 5.8 * Math.pow(1.0 - Math.min(1.0, d / 7.2), 0.7));

    // 빙하 권곡(Cirque)에 의해 오목하게 파인 협벽
    const cirqueHollow = -Math.pow(1.0 - arete1, 2.0) * smoothstep(1.5, 6.0, d) * 1.2;

    h = (peak + areteSharpness + cirqueHollow + fbm(x * 1.5, y * 1.5) * 0.25) * reliefScale;

    if (h > 4.2 * reliefScale) {
      // 정상 영구 설산 빙하 만년설
      color.set(mixColor('#e6edf2', '#ffffff', fbm(x * 6, y * 6)));
    } else if (h > 2.2 * reliefScale) {
      // 깎아지른 아레테 흑갈색 변성암 암벽
      color.set(mixColor('#47433f', '#66605a', fbm(x * 5, y * 5)));
    } else {
      // 기저부 한대 고산 초원 툰드라
      color.set(mixColor('#546142', '#6b7a54', fbm(x * 3, y * 3)));
    }
    return { height: h, color };
  }

  // 2. U자곡 & 피오르드 (빙하가 계곡을 깎아 만든 수직 절벽과 평탄한 바닥 - 노르웨이 가이랑에르, 뉴질랜드 밀포드 사운드)
  if (normSub === 'U자곡' || normSub === '피오르드') {
    const valleyX = Math.sin(y * 0.3) * 1.2;
    const distToValley = Math.abs(x - valleyX);

    // 완벽한 U자형 빙식곡 단면 함수: 바닥은 넓고 평탄하며 양안은 수직에 가까운 급경사
    const uFloorWidth = 2.4;
    const uSlope = Math.pow(Math.max(0, distToValley - uFloorWidth * 0.5) / 2.2, 2.6);
    
    // 측면 현곡(Hanging Valley) - 폭포수가 쏟아지는 지류 빙식곡
    const isHangingValley = (y > 1.2 && y < 2.8 && x < -2.8);
    const hangingFloor = isHangingValley ? 2.2 : 0;

    h = (0.45 + Math.min(4.8, uSlope * 3.6) + hangingFloor + fbm(x * 0.7, y * 0.7) * 0.2) * reliefScale;

    if (normSub === '피오르드' && distToValley < uFloorWidth * 0.8) {
      // 피오르드: 깊은 바닷물이 채워진 짙은 코발트블루 해수면
      h = (0.28 + fbm(x * 2, y * 2) * 0.05) * reliefScale;
      color.set(mixColor('#0a2638', '#113c54', fbm(x * 4, y * 4)));
    } else if (distToValley < uFloorWidth * 0.8) {
      // 내륙 U자곡: 퇴적토가 깔린 평탄한 빙식곡 바닥 초원
      color.set(mixColor('#385e32', '#4b7842', fbm(x * 3, y * 3)));
    } else if (h > 3.6 * reliefScale) {
      // 고원 위 잔설과 회색 기반암
      color.set(mixColor('#828a91', '#9ca4ab', fbm(x * 4, y * 4)));
    } else {
      // 빙하 찰흔(Glacial striations)이 새겨진 수직 암벽
      color.set(mixColor('#4a4846', '#63605d', fbm(x * 5, y * 5)));
    }
    return { height: h, color };
  }

  // 3. 권곡 (빙하의 발원지로 반원형 안락의자 모양의 오목한 산정 분지 - 백두산 천지 칼데라와 구분되는 카르/Cirque)
  if (normSub === '권곡') {
    // 웅장한 말발굽형(안락의자형) 권곡벽(Cirque Headwall)
    const headwallDist = Math.sqrt(Math.pow(x, 2) + Math.pow(y + 1.8, 2));
    const isHeadwall = y < 1.0;
    
    let bowlH = 0;
    if (isHeadwall) {
      // 수직 300m 이상의 웅장한 급경사 암벽
      bowlH = Math.pow(Math.max(0, headwallDist - 1.8) / 3.2, 1.8) * 4.6;
    } else {
      // 하류 쪽 빙하 유출 턱(Rock Threshold / 권곡 턱)
      const lip = Math.exp(-Math.pow((y - 2.2) / 0.8, 2)) * 1.6;
      bowlH = lip;
    }

    // 권곡 바닥 빙식호(Tarn / 산정 호수) 분지
    const isTarn = Math.sqrt(Math.pow(x, 2) + Math.pow(y - 0.2, 2)) < 1.6;

    h = (0.55 + bowlH + fbm(x * 0.8, y * 0.8) * 0.25) * reliefScale;

    if (isTarn) {
      // 빙하 유백색 침전물이 섞인 신비로운 옥빛 권곡호(Tarn Lake)
      h = (0.35 + fbm(x * 2, y * 2) * 0.05) * reliefScale;
      color.set(mixColor('#165969', '#247a8c', fbm(x * 4, y * 4)));
    } else if (isHeadwall && headwallDist > 2.2) {
      // 깎아지른 권곡벽 암벽과 빙하 찰흔
      color.set(mixColor('#47433f', '#5e5954', fbm(x * 6, y * 6)));
    } else {
      // 빙퇴석 더미 및 한대 식생
      color.set(mixColor('#4c5e3d', '#5f754c', fbm(x * 3, y * 3)));
    }
    return { height: h, color };
  }

  // 4. 모레인 (빙하가 운반해 쌓아놓은 미분급 자갈/토사 제방 - 알프스, 칠레 빙하지대)
  if (normSub === '모레인') {
    // 말발굽 모양의 종퇴석(Terminal Moraine Ridge, y = 1.0)
    const moraineArc = Math.sqrt(Math.pow(x, 2) + Math.pow(y - 0.2, 2));
    const distToRidge = Math.abs(moraineArc - 3.2);
    const terminalRidge = Math.exp(-Math.pow(distToRidge / 0.9, 2)) * 2.8;

    // 양측 측퇴석(Lateral Moraines)
    const lateral1 = Math.exp(-Math.pow((x - (-3.0)) / 0.8, 2)) * smoothstep(0, -4, y) * 2.4;
    const lateral2 = Math.exp(-Math.pow((x - 3.0) / 0.8, 2)) * smoothstep(0, -4, y) * 2.4;

    // 빙퇴석 제방 안쪽에 갇힌 빙하 융설수 말단호(Proglacial Lake)
    const inLake = (moraineArc < 2.9 && y < 1.0);

    h = (0.4 + terminalRidge + lateral1 + lateral2 + fbm(x * 1.5, y * 1.5) * 0.18) * reliefScale;

    if (inLake) {
      // 빙하 록플라워(Rock flour)가 부유하는 우윳빛 청록색 호수
      h = (0.28 + fbm(x * 2, y * 2) * 0.05) * reliefScale;
      color.set(mixColor('#196366', '#268a8f', fbm(x * 4, y * 4)));
    } else if (distToRidge < 0.6) {
      // 모레인 능선: 모서리가 각진 거대한 표이암(Erratic boulders)과 자갈 더미
      color.set(mixColor('#695e52', '#827566', fbm(x * 7, y * 7)));
    } else {
      // 외곽 툰드라 초원
      color.set(mixColor('#425736', '#546e45', fbm(x * 3, y * 3)));
    }
    return { height: h, color };
  }

  return null;
}
