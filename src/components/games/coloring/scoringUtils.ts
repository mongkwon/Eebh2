/**
 * 특정 세그먼트에서 "유저가 칠한 대표 색"을 추출
 */
function getSegmentUserColor(
  segmentPos: SegmentPosition,
  coloredData: ImageData,
  canvasWidth: number,
  canvasHeight: number
): { r: number; g: number; b: number } | null {
  const centerX = Math.floor(segmentPos.x);
  const centerY = Math.floor(segmentPos.y);

  // 좌표가 캔버스 범위를 벗어나면 경고하고 null 반환
  if (centerX < 0 || centerX >= canvasWidth || centerY < 0 || centerY >= canvasHeight) {
    console.warn(`   ⚠️ (${centerX}, ${centerY}): 좌표가 캔버스 범위(${canvasWidth}x${canvasHeight})를 벗어남`);
    return null;
  }

  // 점진적으로 범위를 늘려가며 색상 검색 - 정답색 검색과 동일한 범위
  const radiusSteps = [20, 30, 50, 80, 120, 150, 200, 250, 300];
  
  for (const sampleRadius of radiusSteps) {
    const colorCounts = new Map<string, { count: number; r: number; g: number; b: number }>();
    let validSamples = 0;

    // 샘플링 간격을 2로 줄여서 더 총체적게 검사
    for (let dy = -sampleRadius; dy <= sampleRadius; dy += 2) {
      for (let dx = -sampleRadius; dx <= sampleRadius; dx += 2) {
        const x = centerX + dx;
        const y = centerY + dy;

        if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
          const idx = (y * canvasWidth + x) * 4;
          const r = coloredData.data[idx];
          const g = coloredData.data[idx + 1];
          const b = coloredData.data[idx + 2];
          const a = coloredData.data[idx + 3];

          // 투명하거나 거의 흰색이면(배경) 무시
          if (a === 0) continue;
          if (r > 240 && g > 240 && b > 240) continue;
          
          // 윤곽선 색상(어두운 회색/검은색) 제외 - RGB가 모두 50 이하이면 윤곽선으로 간주
          const isOutline = r <= 50 && g <= 50 && b <= 50;
          if (isOutline) continue;

          validSamples++;

          const rKey = Math.floor(r / 10) * 10;
          const gKey = Math.floor(g / 10) * 10;
          const bKey = Math.floor(b / 10) * 10;
          const colorKey = `${rKey},${gKey},${bKey}`;

          if (!colorCounts.has(colorKey)) {
            colorCounts.set(colorKey, { count: 0, r, g, b });
          }
          const colorData = colorCounts.get(colorKey)!;
          colorData.count++;
          colorData.r = Math.floor((colorData.r * (colorData.count - 1) + r) / colorData.count);
          colorData.g = Math.floor((colorData.g * (colorData.count - 1) + g) / colorData.count);
          colorData.b = Math.floor((colorData.b * (colorData.count - 1) + b) / colorData.count);
        }
      }
    }

    // 유효한 샘플을 찾았으면 대표 색상 반환
    if (validSamples > 0 && colorCounts.size > 0) {
      let maxCount = 0;
      let resultColor = { r: 0, g: 0, b: 0 };

      for (const colorData of colorCounts.values()) {
        if (colorData.count > maxCount) {
          maxCount = colorData.count;
          resultColor = { r: colorData.r, g: colorData.g, b: colorData.b };
        }
      }

      if (sampleRadius > 20) {
        console.log(`   ✅ (${centerX}, ${centerY}): radius ${sampleRadius}에서 유저 색상 발견 - RGB(${resultColor.r}, ${resultColor.g}, ${resultColor.b})`);
      }
      return resultColor;
    }
  }

  // 모든 반경에서 색상을 찾지 못함 (색칠 안 된 세그먼트로 간주)
  // 경고가 아닌 일반 로그로 처리 (정상적인 상황일 수 있음)
  console.log(`   (${centerX}, ${centerY}): 색칠되지 않은 세그먼트`);
  return null;
}

/**
 * hex 색상을 RGB로 변환
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex || hex.length !== 7 || !hex.startsWith('#')) {
    return null;
  }

  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return { r, g, b };
}

/**
 * 노란색 계열인지 확인 (RGB 기반)
 */
function isSameYellowFamilyFromRgb(
  cr: number, cg: number, cb: number,
  ur: number, ug: number, ub: number
): boolean {
  // 정답과 유저 색상 모두 노란색 계열인지 확인
  const isCorrectYellow = cr > 200 && cg > 180 && cb < 100;
  const isUserYellow = ur > 200 && ug > 180 && ub < 100;
  
  // 둘 다 노란색 계열이면 true
  return isCorrectYellow && isUserYellow;
}

/**
 * 점수 계산 결과 타입
 */
export interface ScoringResult {
  correctSegments: number;
  correctSegmentIndices: number[];
  baseScore: number;
  timeBonus: number;
  finalScore: number;
}

/**
 * 세그먼트 위치 타입 (재정의 방지를 위한 import)
 */
export type { SegmentPosition } from './coloringTypes';

/**
 * 게임 점수를 계산
 * @param segmentCount 전체 세그먼트 수
 * @param segmentPositions 세그먼트 위치 배열
 * @param coloredCanvas 색칠된 캔버스
 * @param correctAnswerColors 세그먼트별 정답 색상 (index → hex)
 * @param elapsedTime 경과 시간 (초)
 * @param originalWidth 원본 이미지 너비
 * @param originalHeight 원본 이미지 높이
 * @returns 점수 계산 결과
 */
export function calculateGameScore(
  segmentCount: number,
  segmentPositions: SegmentPosition[],
  coloredCanvas: HTMLCanvasElement,
  correctAnswerColors: Map<number, string>,
  elapsedTime: number,
  originalWidth: number,
  originalHeight: number
): ScoringResult | null {
  const coloredCtx = coloredCanvas.getContext("2d", { willReadFrequently: true });
  if (!coloredCtx) return null;

  const coloredData = coloredCtx.getImageData(0, 0, coloredCanvas.width, coloredCanvas.height);

  // 원본 이미지 크기 대비 coloredCanvas 크기의 스케일 비율 계산
  const scaleX = coloredCanvas.width / originalWidth;
  const scaleY = coloredCanvas.height / originalHeight;

  console.log(`캔버스 크기: ${coloredCanvas.width}x${coloredCanvas.height}`);
  console.log(`원본 이미지 크기: ${originalWidth}x${originalHeight}`);
  console.log(`스케일 비율: ${scaleX} x ${scaleY}`);
  console.log(`세그먼트 개수: ${segmentCount}, 위치 배열 이: ${segmentPositions.length}`);
  console.log(`정답 색상이 있는 세그먼트 수: ${correctAnswerColors.size}`);

  let correctSegments = 0;
  const correctSegmentIndices: number[] = [];

  for (let i = 0; i < segmentCount; i++) {
    if (i >= segmentPositions.length) break;

    const pos = segmentPositions[i];
    const correctHex = correctAnswerColors.get(i);

    if (!correctHex) {
      console.log(`세그먼트 ${i}: 정답 색상이 정의되지 않았습니다. (건너뜀)`);
      continue;
    }

    const correctRgb = hexToRgb(correctHex);
    if (!correctRgb) {
      console.log(`세그먼트 ${i}: 정답 색상 ${correctHex} → RGB 변환 실패`);
      continue;
    }

    // 원본 좌표가 이미지 범위를 크게 벗어나면 건너뛰기
    // (여유를 10% 정도 둠)
    const margin = 0.1;
    if (pos.x < -originalWidth * margin || pos.x > originalWidth * (1 + margin) ||
        pos.y < -originalHeight * margin || pos.y > originalHeight * (1 + margin)) {
      console.warn(`⚠️ 세그먼트 ${i}: 원본 좌표가 이미지 범위를 벗어남 - (${pos.x}, ${pos.y}) - 건너뜀`);
      continue;
    }

    // 원본 좌표를 coloredCanvas 좌표로 스케일링
    const scaledPos = {
      x: pos.x * scaleX,
      y: pos.y * scaleY
    };

    // 스케일링된 좌표가 캔버스 범위를 벗어나면 건너뛰기
    // (범위를 크게 벗어난 좌표는 잘못된 데이터로 간주)
    if (scaledPos.x < -10 || scaledPos.x >= coloredCanvas.width + 10 ||
        scaledPos.y < -10 || scaledPos.y >= coloredCanvas.height + 10) {
      console.warn(`⚠️ 세그먼트 ${i}: 좌표가 캔버스 범위를 벗어남 - 원본(${pos.x}, ${pos.y}) → 스케일(${scaledPos.x.toFixed(1)}, ${scaledPos.y.toFixed(1)}) - 건너���`);
      continue;
    }

    // 약간의 여유만 있는 경우 클램핑
    const clampedPos = {
      x: Math.max(0, Math.min(coloredCanvas.width - 1, scaledPos.x)),
      y: Math.max(0, Math.min(coloredCanvas.height - 1, scaledPos.y))
    };

    // 클램핑이 크게 발생한 경우만 로그 (5픽셀 이상)
    if (Math.abs(scaledPos.x - clampedPos.x) > 5 || Math.abs(scaledPos.y - clampedPos.y) > 5) {
      console.log(`세그먼트 ${i}: 좌표 클램핑 (${scaledPos.x.toFixed(0)}, ${scaledPos.y.toFixed(0)}) → (${clampedPos.x}, ${clampedPos.y})`);
    }

    const userColor = getSegmentUserColor(
      clampedPos,
      coloredData,
      coloredCanvas.width,
      coloredCanvas.height
    );

    if (!userColor) {
      console.log(`세그먼트 ${i}: 유저 색상 없음 (색칠 안 된 것으로 간주)`);
      continue;
    }

    const { r: cr, g: cg, b: cb } = correctRgb;
    const { r: ur, g: ug, b: ub } = userColor;

    // 노란색 계열은 좀 더 관대하게
    const threshold = 40;
    const rDiff = Math.abs(cr - ur);
    const gDiff = Math.abs(cg - ug);
    const bDiff = Math.abs(cb - ub);

    const isYellowOk = isSameYellowFamilyFromRgb(cr, cg, cb, ur, ug, ub);
    const isCloseColor = rDiff <= threshold && gDiff <= threshold && bDiff <= threshold;

    const isCorrect = isYellowOk || isCloseColor;

    if (isCorrect) {
      correctSegments++;
      correctSegmentIndices.push(i);
    }

    const userHex = `#${ur.toString(16).padStart(2, "0")}${ug
      .toString(16)
      .padStart(2, "0")}${ub.toString(16).padStart(2, "0")}`.toUpperCase();

    console.log(
      `세그먼트 ${i}: 정답 ${correctHex} vs 유저 ${userHex} (ΔR=${rDiff}, ΔG=${gDiff}, ΔB=${bDiff}) → ${
        isCorrect ? "✅ 정답" : "❌ 오답"
      }`
    );
  }

  console.log(`올바르게 색칠된 조각: ${correctSegments}/${segmentCount}`);

  const baseScore = correctSegments * 10;
  const timeBonus = elapsedTime <= 180 ? Math.floor((180 - elapsedTime) / 30) * 5 : 0;
  const finalScore = baseScore + timeBonus;

  console.log(
    `기본 점수: ${baseScore} (조각 ${correctSegments}개), 시간 보너스: ${timeBonus}, 최종 점수: ${finalScore}`
  );

  return {
    correctSegments,
    correctSegmentIndices,
    baseScore,
    timeBonus,
    finalScore,
  };
}