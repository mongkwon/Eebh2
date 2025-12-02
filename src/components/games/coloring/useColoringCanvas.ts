import { useRef, MutableRefObject } from "react";
import { 
  COLORING_IMAGES, 
  BALLOON_SEGMENT_URLS, 
  BALLOON_SEGMENT_POSITIONS,
  HOUSE_SEGMENT_URLS,
  HOUSE_SEGMENT_POSITIONS,
  CHILD_SEGMENT_URLS,
  CHILD_SEGMENT_POSITIONS,
  LIVINGROOM_SEGMENT_URLS,
  LIVINGROOM_SEGMENT_POSITIONS,
  TRAIN_SEGMENT_URLS,
  TRAIN_SEGMENT_POSITIONS,
} from "./coloringData";
import { SegmentPosition } from "./coloringTypes";

export function useColoringCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coloredCanvasRef = useRef<HTMLCanvasElement>(null);
  const outlineImgRef = useRef<HTMLImageElement | null>(null);
  const coloredImgRef = useRef<HTMLImageElement | null>(null);
  const imageScaleRef = useRef(1);
  const imageSizeRef = useRef({ width: 0, height: 0 });
  const segmentImagesRef = useRef<HTMLImageElement[]>([]);
  const segmentMasksRef = useRef<ImageData[]>([]);
  const segmentPositionsRef = useRef<SegmentPosition[]>([]);
  const fullOutlineImageRef = useRef<HTMLImageElement | null>(null); // 전체 outline 이미지 저장
  const segmentOutlinesRef = useRef<HTMLImageElement[]>([]); // 각 조각의 outline 저장
  const segmentColorsRef = useRef<(string | null)[]>([]); // 각 조각의 색상 저장
  const currentImageIndexRef = useRef(0); // 현재 이미지 인덱스

  const getSegmentData = (imageName: string) => {
    switch (imageName) {
      case "풍선":
        return { urls: BALLOON_SEGMENT_URLS, positions: BALLOON_SEGMENT_POSITIONS };
      case "집":
        return { urls: HOUSE_SEGMENT_URLS, positions: HOUSE_SEGMENT_POSITIONS };
      case "아이":
        return { urls: CHILD_SEGMENT_URLS, positions: CHILD_SEGMENT_POSITIONS };
      case "거실":
        return { urls: LIVINGROOM_SEGMENT_URLS, positions: LIVINGROOM_SEGMENT_POSITIONS };
      case "기차":
        return { urls: TRAIN_SEGMENT_URLS, positions: TRAIN_SEGMENT_POSITIONS };
      default:
        return null;
    }
  };

  const loadImages = async (imageIndex: number) => {
    const canvas = canvasRef.current;
    const coloredCanvas = coloredCanvasRef.current;
    if (!canvas || !coloredCanvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const coloredCtx = coloredCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !coloredCtx) return;

    // 캔버스 초기화 - 이전 그림 완전히 지우기
    segmentImagesRef.current = [];
    segmentMasksRef.current = [];
    segmentPositionsRef.current = [];
    segmentColorsRef.current = [];
    segmentOutlinesRef.current = [];

    const currentImage = COLORING_IMAGES[imageIndex];
    currentImageIndexRef.current = imageIndex;

    try {
      const outlineImg = new Image();
      outlineImg.crossOrigin = "anonymous";
      outlineImg.src = currentImage.src;

      await new Promise<void>((resolve, reject) => {
        outlineImg.onload = async () => {
          try {
            const coloredImg = new Image();
            coloredImg.crossOrigin = "anonymous";
            coloredImg.src = currentImage.src;

            await new Promise<void>((resolveColored, rejectColored) => {
              coloredImg.onload = () => {
                outlineImgRef.current = outlineImg;
                coloredImgRef.current = coloredImg;

                // 이미지 원본 크기를 사용하여 캔버스 크기 설정
                const canvasWidth = outlineImg.width;
                const canvasHeight = outlineImg.height;
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                coloredCanvas.width = canvasWidth;
                coloredCanvas.height = canvasHeight;

                const imageSize = { width: canvasWidth, height: canvasHeight };
                imageSizeRef.current = imageSize;

                console.log(`Canvas 크기 설정: ${canvasWidth}x${canvasHeight}`);
                console.log(`이미지 원본 크기: ${outlineImg.width}x${outlineImg.height}`);

                const scaleX = canvasWidth / outlineImg.width;
                const scaleY = canvasHeight / outlineImg.height;
                imageScaleRef.current = Math.min(scaleX, scaleY);

                console.log(`이미지 스케일: ${imageScaleRef.current}`);

                resolveColored();
              };
              coloredImg.onerror = rejectColored;
            });

            // 모든 그림에 대해 조각 이미지 로드
            const segmentData = getSegmentData(currentImage.name);
            if (segmentData) {
              console.log(`${currentImage.name} - 조각 이미지 로드 시작`);
              const { urls: segmentUrls, positions } = segmentData;

              const loadedImages: HTMLImageElement[] = [];
              const loadedMasks: ImageData[] = [];
              const loadedOutlines: HTMLImageElement[] = [];

              for (let i = 0; i < segmentUrls.length; i++) {
                const img = new Image();
                img.src = segmentUrls[i];

                await new Promise<void>((resolveImg) => {
                  img.onload = () => {
                    // 원본 조각 이미지를 먼저 저장 (마스크 용도)
                    loadedImages.push(img);
                    
                    const extractCanvas = document.createElement("canvas");
                    extractCanvas.width = img.width;
                    extractCanvas.height = img.height;
                    const extractCtx = extractCanvas.getContext("2d", { willReadFrequently: true });

                    if (extractCtx) {
                      try {
                        extractCtx.drawImage(img, 0, 0);
                        
                        // 마스크 데이터 생성
                        const maskData = extractCtx.getImageData(0, 0, img.width, img.height);
                        loadedMasks.push(maskData);
                        
                        // outline만 추출 (검은색 선만 남기고 나머지는 투명하게)
                        const outlineData = extractCtx.getImageData(0, 0, img.width, img.height);
                        const pixels = outlineData.data;
                        
                        for (let j = 0; j < pixels.length; j += 4) {
                          const r = pixels[j];
                          const g = pixels[j + 1];
                          const b = pixels[j + 2];
                          const a = pixels[j + 3];
                          
                          // 어두운 색상(outline)이 아니면 투명하게 변경
                          if (a > 0 && (r >= 80 || g >= 80 || b >= 80)) {
                            pixels[j + 3] = 0; // 투명하게
                          }
                        }
                        
                        extractCtx.putImageData(outlineData, 0, 0);
                        
                        const outlineSegmentImg = new Image();
                        outlineSegmentImg.src = extractCanvas.toDataURL();
                        outlineSegmentImg.onload = () => {
                          loadedOutlines.push(outlineSegmentImg);
                          console.log(`조각 ${i + 1} outline 추출 완료 (${img.width}x${img.height})`);
                          resolveImg();
                        };
                      } catch (error) {
                        console.error(`조각 ${i + 1} outline 추출 실패:`, error);
                        resolveImg();
                      }
                    } else {
                      resolveImg();
                    }
                  };

                  img.onerror = (error) => {
                    console.error(`조각 ${i + 1} 로드 실패:`, segmentUrls[i], error);
                    resolveImg();
                  };
                });
              }

              segmentImagesRef.current = loadedImages;
              segmentMasksRef.current = loadedMasks;
              segmentPositionsRef.current = positions;
              segmentOutlinesRef.current = loadedOutlines;
              console.log(`총 ${loadedImages.length}개 조각 이미지 로드 완료`);
            }

            resolve();
          } catch (error) {
            console.error("이미지 로드 중 오류:", error);
            reject(error);
          }
        };
        outlineImg.onerror = reject;
      });
    } catch (error) {
      console.error("이미지 로드 실패:", error);
    }
  };

  const initializeCanvas = (img: HTMLImageElement, imageIndex: number, outlineCanvas?: HTMLCanvasElement | null) => {
    const canvas = canvasRef.current;
    const coloredCanvas = coloredCanvasRef.current;
    if (!canvas || !coloredCanvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const coloredCtx = coloredCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !coloredCtx) return;

    const imageSize = imageSizeRef.current;
    
    // 기본 캔버스 초기화
    ctx.clearRect(0, 0, imageSize.width, imageSize.height);
    
    // 색칠 캔버스도 완전히 초기화 (이전 그림 제거)
    coloredCtx.clearRect(0, 0, imageSize.width, imageSize.height);

    // 1단계: 전체 완성본 이미지에서 outline만 추출
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
    
    if (tempCtx) {
      tempCtx.drawImage(img, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const pixels = imageData.data;
      
      // 색칠된 부분은 투명으로, 검은색 선만 남기기
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        
        // 어두운 색상(outline)이 아니면 투명으로 변경
        if (a > 0 && (r >= 80 || g >= 80 || b >= 80)) {
          pixels[i + 3] = 0; // 투명하게
        }
      }
      
      tempCtx.putImageData(imageData, 0, 0);
      
      // outline 캔버스가 제공되면 그곳에 그리기
      if (outlineCanvas) {
        outlineCanvas.width = imageSize.width;
        outlineCanvas.height = imageSize.height;
        const outlineCtx = outlineCanvas.getContext("2d");
        if (outlineCtx) {
          // 흰색 배경
          outlineCtx.fillStyle = "#FFFFFF";
          outlineCtx.fillRect(0, 0, imageSize.width, imageSize.height);
          // outline 그리기
          outlineCtx.drawImage(tempCanvas, 0, 0);
          console.log("전체 outline 이미지를 별도 캔버스에 그리기 완료 (고정)");
        }
      }

      // 전체 outline 이미지 저장
      const fullOutlineImage = new Image();
      fullOutlineImage.src = tempCanvas.toDataURL();
      fullOutlineImage.onload = () => {
        fullOutlineImageRef.current = fullOutlineImage;
      };
    }

    const currentImage = COLORING_IMAGES[imageIndex];
    const segmentData = getSegmentData(currentImage.name);

    // 2단계: 조각 이미지들을 조각 캔버스에 그리기
    if (segmentData) {
      const segmentOutlines = segmentOutlinesRef.current;
      console.log(`${currentImage.name} - 조각 outline 개수:`, segmentOutlines.length);

      if (segmentOutlines.length === segmentData.urls.length) {
        const positions = segmentData.positions;

        segmentOutlines.forEach((outlineImg, index) => {
          const pos = positions[index];
          ctx.drawImage(outlineImg, pos.x, pos.y);
          console.log(`조각 ${index + 1} outline 그리기 완료 위치: (${pos.x}, ${pos.y})`);
        });
      } else {
        console.log("조각 outline이 충분하지 않음");
      }
    }

    console.log("Canvas initialized with size:", imageSize);
  };

  const fillSegment = (x: number, y: number, color: string, offsets: { x: number; y: number }[]): boolean => {
    const canvas = canvasRef.current;
    const coloredCanvas = coloredCanvasRef.current;
    if (!canvas || !coloredCanvas) return false;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const coloredCtx = coloredCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !coloredCtx) return false;

    const segmentImages = segmentImagesRef.current;
    const segmentMasks = segmentMasksRef.current;
    const segmentPositions = segmentPositionsRef.current;

    if (segmentImages.length === 0 || segmentMasks.length === 0) {
      console.log("조각 이미지가 로드되지 않았습니다");
      return false;
    }

    console.log(`fillSegment 호출: 위치 (${x}, ${y}), 색상: ${color}, 조각 개수: ${segmentImages.length}`);

    for (let i = 0; i < segmentImages.length; i++) {
      const pos = segmentPositions[i];
      const offset = offsets[i] || { x: 0, y: 0 };
      const mask = segmentMasks[i];
      const segImg = segmentImages[i];

      const localX = x - (pos.x + offset.x);
      const localY = y - (pos.y + offset.y);

      if (localX >= 0 && localX < mask.width && localY >= 0 && localY < mask.height) {
        const pixelIndex = (Math.floor(localY) * mask.width + Math.floor(localX)) * 4;
        const alpha = mask.data[pixelIndex + 3];

        console.log(`조각 ${i + 1} 체크: localX=${localX}, localY=${localY}, alpha=${alpha}`);

        if (alpha > 128) {
          console.log(`조각 ${i + 1} 클릭됨 - 색칠 시작 (색상: ${color})`);

          // 조각 색상 저장
          segmentColorsRef.current[i] = color;
          console.log(`조각 ${i + 1} 색칠 완료 (색상: ${color})`);

          // coloredCanvas에도 색칠 (점수 계산용)
          const offscreenCanvas = document.createElement("canvas");
          offscreenCanvas.width = segImg.width;
          offscreenCanvas.height = segImg.height;
          const offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });

          if (offscreenCtx) {
            offscreenCtx.fillStyle = color;
            offscreenCtx.fillRect(0, 0, segImg.width, segImg.height);
            offscreenCtx.globalCompositeOperation = "destination-in";
            offscreenCtx.drawImage(segImg, 0, 0);

            coloredCtx.globalCompositeOperation = "source-over";
            coloredCtx.drawImage(offscreenCanvas, pos.x, pos.y);
          }

          return true;
        }
      }
    }

    console.log("클릭한 위치에 조각이 없습니다");
    return false;
  };

  const redrawSegments = (offsets: { x: number; y: number }[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const imageSize = imageSizeRef.current;
    
    // 캔버스 초기화
    ctx.clearRect(0, 0, imageSize.width, imageSize.height);

    const segmentOutlines = segmentOutlinesRef.current;
    const segmentPositions = segmentPositionsRef.current;
    const segmentColors = segmentColorsRef.current;

    // 각 조각을 그리기
    segmentOutlines.forEach((outlineImg, index) => {
      const pos = segmentPositions[index];
      const offset = offsets[index] || { x: 0, y: 0 };
      const finalX = pos.x + offset.x;
      const finalY = pos.y + offset.y;

      // 색칠된 조각이면 색칠된 버전 그리기
      if (segmentColors[index]) {
        const segImg = segmentImagesRef.current[index];
        const color = segmentColors[index];
        
        if (segImg && color) {
          const offscreenCanvas = document.createElement("canvas");
          offscreenCanvas.width = segImg.width;
          offscreenCanvas.height = segImg.height;
          const offscreenCtx = offscreenCanvas.getContext("2d", { willReadFrequently: true });

          if (offscreenCtx) {
            offscreenCtx.fillStyle = color;
            offscreenCtx.fillRect(0, 0, segImg.width, segImg.height);
            offscreenCtx.globalCompositeOperation = "destination-in";
            offscreenCtx.drawImage(segImg, 0, 0);

            ctx.globalCompositeOperation = "source-over";
            ctx.drawImage(offscreenCanvas, finalX, finalY);
          }
        }
      }
      
      // outline 그리기
      ctx.drawImage(outlineImg, finalX, finalY);
    });
  };

  const getSegmentAtPosition = (x: number, y: number, offsets: { x: number; y: number }[]): number => {
    const segmentMasks = segmentMasksRef.current;
    const segmentPositions = segmentPositionsRef.current;

    // 역순으로 체크 (위에 있는 조각부터)
    for (let i = segmentMasks.length - 1; i >= 0; i--) {
      const pos = segmentPositions[i];
      const offset = offsets[i] || { x: 0, y: 0 };
      const mask = segmentMasks[i];

      const localX = x - (pos.x + offset.x);
      const localY = y - (pos.y + offset.y);

      if (localX >= 0 && localX < mask.width && localY >= 0 && localY < mask.height) {
        const pixelIndex = (Math.floor(localY) * mask.width + Math.floor(localX)) * 4;
        const alpha = mask.data[pixelIndex + 3];

        if (alpha > 128) {
          return i;
        }
      }
    }

    return -1;
  };

  return {
    canvasRef,
    coloredCanvasRef,
    loadImages,
    fillSegment,
    imageSizeRef,
    segmentColorsRef, // 조각별 색상 정보 반환
    initializeCanvas,
    outlineImgRef,
    redrawSegments,
    getSegmentAtPosition,
    segmentPositionsRef,
  };
}