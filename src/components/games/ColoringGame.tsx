import { useState, useEffect, useRef } from "react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { GameRulesButton } from "../GameRulesButton";
import { GameRulesModal, RuleSection, RuleList } from "../GameRulesModal";
import { playBackSound, playClickSound, playSelectSound } from "../../utils/sound";
import { saveGameRecord, getGameRecord } from "../../utils/gameRecord";
import { ColoringGameProps, GameState } from "./coloring/coloringTypes";
import { COLORING_IMAGES } from "./coloring/coloringData";
import { useColoringCanvas } from "./coloring/useColoringCanvas";
import { calculateGameScore } from "./coloring/scoringUtils";
import { Heart } from "lucide-react";
import pauseIcon from "figma:asset/8acb1e015c5c90586e07679819984941b38f74af.png";
import resumeImg from "figma:asset/62327073bfb38b1feb704b5c6f1eb2a36789eee8.png";
import restartImg from "figma:asset/d1a45328f3c2f5290d250ff17f71584c907a61a7.png";
import pauseMenuBg from "figma:asset/54f8a82ff3f9348da47c92cd7e8e9b17adc71522.png";
import pauseExitIcon from "figma:asset/7b6920cff9236248c28a92364a77c6df5be27012.png";
import exitIcon from "figma:asset/74b1288f91a03a19fc199ba8e3ce487eebb3c1fb.png";
import homeImg from "figma:asset/7b6920cff9236248c28a92364a77c6df5be27012.png";
import levelButtonBg from "figma:asset/5d455998023ef79fbbf223eaf0a0e503e73de2f2.png";
import replayButtonBg from "figma:asset/76896cc73d11fff23bc0ef71e56e9001acc1b9ee.png";
import paletteImg from "figma:asset/5ba5c743706f1f61b899a9b817da0382ca0aad0a.png";
import buttonImg from "figma:asset/292f675f474bdb9553a5527caffea8d853194246.png";
import brushIcon from "figma:asset/e91ce300ea77a7c842a3adb230615860359851c5.png";
import timerIcon from "figma:asset/7c8f40952522b94eb464f4eaf7b991a3386aee04.png";
import brushYellow from "figma:asset/0faf0b9cb98707116d975388798b3aabb49b9813.png";
import brushOrange from "figma:asset/8fdb52456b875d46ec70625049c1c4d84a52a0be.png";
import brushRed from "figma:asset/d4cbe294c778ed49075c692af65ae739fccf595e.png";
import brushGreen from "figma:asset/9da4d0c6e9d0443f1780bef8065a26327b7b076b.png";
import brushNavy from "figma:asset/91a3af52e196affa7901cfd76830500abac33a21.png";
import brushSky from "figma:asset/f3321191423e363ea4f72f45487cc54937634ccf.png";
import brushBrown from "figma:asset/95b3929dbf555867bcda381020ae890c63d63ddb.png";
import brushPurple from "figma:asset/88937aee057669826f57607995d91336d28a7824.png";
import brushClear from "figma:asset/e91ce300ea77a7c842a3adb230615860359851c5.png";
import starIcon from "figma:asset/536422266eac9485f74fff9de4a5153de25a14b7.png";
import checkIconGray from "figma:asset/2481c41f3b40adb897713a482226b3b07f990883.png";

export function ColoringGame({ onBack }: ColoringGameProps) {
  const [gameState, setGameState] = useState<GameState>("ready");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [colorSelected, setColorSelected] = useState(false); // 색상이 선택되었는지 추적
  const [elapsedTime, setElapsedTime] = useState(0);
  const [previewImage, setPreviewImage] = useState<string>("");
  const [previewOutlineImage, setPreviewOutlineImage] = useState<string>(""); // outline 이미지 추가
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [targetColors, setTargetColors] = useState<number[]>([]); // 활성화된 색상 인덱스 배열
  const cursorRef = useRef<HTMLDivElement>(null); // 커서 DOM 참조
  const [brushSrc, setBrushSrc] = useState(brushClear); // 브러쉬 이미지 src
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false); // 미리보기 생성 중 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false); // 정답 미리보기 모달
  const [previewTimeLeft, setPreviewTimeLeft] = useState(10); // 남은 미리보기 시간
  const [showCompletedTime, setShowCompletedTime] = useState(false); // 완성 버튼 눌렀을 때 시간 표시
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [scorePopups, setScorePopups] = useState<Array<{ id: number; points: number; x: number; y: number }>>([]);
  const scorePopupIdRef = useRef(0);
  const [checkPopups, setCheckPopups] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const checkPopupIdRef = useRef(0);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false); // 미완성 알림 모달
  const [incompleteMessage, setIncompleteMessage] = useState(""); // 미완성 메시지
  const [showCompleteButton, setShowCompleteButton] = useState(false); // 완성 버튼 표시 여부
  const [correctAnswerColors, setCorrectAnswerColors] = useState<Map<number, string>>(new Map()); // 정답 색상 매핑 (원본 색상 -> 정답 색상)
  const [previewUsedCount, setPreviewUsedCount] = useState(0); // 다시보기 사용 횟수
  const [originalImageSize, setOriginalImageSize] = useState({ width: 0, height: 0 }); // 원본 이미지 크기
  
  // 커서가 캔버스 안에 있는지 여부
  const [isCursorInside, setIsCursorInside] = useState(false);
  
  // 각 조각의 offset 위치 관리
  const [segmentOffsets, setSegmentOffsets] = useState<{ x: number; y: number }[]>([]);
  
  const { 
    canvasRef, 
    coloredCanvasRef, 
    loadImages, 
    fillSegment, 
    segmentColorsRef, 
    initializeCanvas, 
    outlineImgRef, 
    redrawSegments, 
    segmentPositionsRef 
  } = useColoringCanvas();

  const outlineCanvasRef = useRef<HTMLCanvasElement>(null); // 전체 outline 캔버스 (고정)
  
  // 세그먼트 위치 정보를 가져오기 위한 함수
  const getSegmentPositions = (imageName: string) => {
    const segmentData = (() => {
      switch (imageName) {
        case "풍선":
          return require("./coloring/coloringData").BALLOON_SEGMENT_POSITIONS;
        case "집":
          return require("./coloring/coloringData").HOUSE_SEGMENT_POSITIONS;
        case "아이":
          return require("./coloring/coloringData").CHILD_SEGMENT_POSITIONS;
        case "거실":
          return require("./coloring/coloringData").LIVINGROOM_SEGMENT_POSITIONS;
        case "기차":
          return require("./coloring/coloringData").TRAIN_SEGMENT_POSITIONS;
        default:
          return [];
      }
    })();
    return segmentData;
  };
  
  // 세그먼트 이름 정보를 가져오기 위한 함수
  const getSegmentNames = (imageName: string) => {
    const segmentNames = (() => {
      switch (imageName) {
        case "풍선":
          return require("./coloring/coloringData").BALLOON_SEGMENT_NAMES;
        case "집":
          return require("./coloring/coloringData").HOUSE_SEGMENT_NAMES;
        case "아이":
          return require("./coloring/coloringData").CHILD_SEGMENT_NAMES;
        case "거실":
          return require("./coloring/coloringData").LIVINGROOM_SEGMENT_NAMES;
        case "기차":
          return require("./coloring/coloringData").TRAIN_SEGMENT_NAMES;
        default:
          return [];
      }
    })();
    return segmentNames;
  };

  // 세그먼트 경로(URL) 정보를 가져오기 위한 함수
  const getSegmentPaths = (imageName: string) => {
    const segmentPaths = (() => {
      switch (imageName) {
        case "풍선":
          return require("./coloring/coloringData").BALLOON_SEGMENT_URLS;
        case "집":
          return require("./coloring/coloringData").HOUSE_SEGMENT_URLS;
        case "아이":
          return require("./coloring/coloringData").CHILD_SEGMENT_URLS;
        case "거실":
          return require("./coloring/coloringData").LIVINGROOM_SEGMENT_URLS;
        case "기차":
          return require("./coloring/coloringData").TRAIN_SEGMENT_URLS;
        default:
          return [];
      }
    })();
    return segmentPaths;
  };

  // 레벨에 따라 색상 개수 결정 (1레벨: 4개, 2레벨: 6개, 3레벨: 8개)
  const getColorCountForLevel = (level: number) => {
    if (level === 1) return 4;
    if (level === 2) return 6;
    return 8;
  };
  
  const currentImage = COLORING_IMAGES[selectedImageIndex];
  const colorCount = getColorCountForLevel(selectedLevel);
  const colors = currentImage?.colors.slice(0, colorCount) || [];

  // 색상 정의: 이름과 hex 코드를 항상 고정 매핑
  const COLOR_PALETTE = [
    { name: "빨강", hex: "#D58473" },
    { name: "주황", hex: "#E5A652" },
    { name: "노랑", hex: "#FCDB8E" },    // 기본값, 거실은 #E3D173
    { name: "초록", hex: "#4E7557" },
    { name: "하늘", hex: "#A7B7C4" },
    { name: "파랑", hex: "#486073" },
    { name: "보라", hex: "#A990BA" },
    { name: "갈색", hex: "#8B765B" }
  ];

  // 색상 hex → 브러쉬 이미지 매핑
  const colorToBrush: { [key: string]: string } = {
    "#D58473": brushRed, "#E5A652": brushOrange, "#E3D173": brushYellow,
    "#FCDB8E": brushYellow, "#4E7557": brushGreen, "#A7B7C4": brushSky,
    "#486073": brushNavy, "#A990BA": brushPurple, "#8B765B": brushBrown,
    "#E17B7B": brushRed, "#E89C5C": brushOrange, "#E8D465": brushYellow,
    "#7CB369": brushGreen, "#B994D1": brushPurple, "#A8C5D1": brushSky,
    "#8B6F47": brushBrown, "#2C3E7C": brushNavy, "#B89FC9": brushPurple,
    "#A0B5C1": brushSky, "#E89A8B": brushRed, "#5C8D5A": brushGreen,
    "#415468": brushNavy,
  };

  // 랜덤 색상 생성 함수 - 활성화할 색상 인덱스를 랜덤으로 선택
  const generateRandomColors = (count: number) => {
    const indices = [0, 1, 2, 3, 4, 5, 6, 7];
    
    // Fisher-Yates 셔플
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    return indices.slice(0, count).sort((a, b) => a - b);
  };

  const generatePreviewImage = async (imageIndex: number, level: number) => {
  console.log(`🎨 generatePreviewImage 호출됨 - imageIndex: ${imageIndex}, level: ${level}`);
  
  const colorCount = getColorCountForLevel(level);
  const randomColors = generateRandomColors(colorCount);
  setTargetColors(randomColors);

  const imageName = COLORING_IMAGES[imageIndex]?.name;
  const isLivingroomImage = imageName === "거실";
  const yellowColor = isLivingroomImage ? "#E3D173" : "#FCDB8E";

  // 선택된 색상 배열
  const selectedColorArray = randomColors.map((idx) => {
    const color = COLOR_PALETTE[idx];
    return color.name === "노랑" ? yellowColor : color.hex;
  });

  console.log(`🎨 선택된 색 인덱스: [${randomColors.join(", ")}]`);
  console.log(`🎨 선택된 색 Hex: [${selectedColorArray.join(", ")}]`);

  // 세그먼트 정보 가져오기
  const segmentPositions = getSegmentPositions(imageName);
  const segmentNames = getSegmentNames(imageName);
  const segmentPaths = getSegmentPaths(imageName);
  
  if (segmentPositions.length === 0) {
    console.warn("⚠️ 세그먼트 정보가 없습니다!");
    return;
  }

  // 세그먼트 순서를 섞어서 색상을 랜덤하게 할당
  const segmentIndices = Array.from({ length: segmentPositions.length }, (_, i) => i);
  const shuffledIndices = segmentIndices.sort(() => Math.random() - 0.5);
  
  // 각 세그먼트에 색상 할당 (순환)
  const segmentColors = shuffledIndices.map((segIdx, i) => ({
    segmentIndex: segIdx,
    color: selectedColorArray[i % colorCount]
  }));

  console.log(`🎨 세그먼트 ${segmentPositions.length}개에 색상 ${colorCount}개 할당`);

  // 원본 이미지 로드
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = COLORING_IMAGES[imageIndex].src;
  console.log(`🎨 이미지 로딩 시작: ${COLORING_IMAGES[imageIndex].name}`);

  await new Promise<void>((resolve) => {
    img.onload = async () => {
      console.log(`🎨 원본 이미지 로드 완료`);
      
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) {
        resolve();
        return;
      }

      // 원본 이미지 크기 저장
      setOriginalImageSize({ width: img.width, height: img.height });

      // 🎨 세그먼트별로 색칠
      let completedSegments = 0;
      const totalSegments = segmentColors.length;

      for (const { segmentIndex, color } of segmentColors) {
        const segmentPath = segmentPaths[segmentIndex];
        const segmentPos = segmentPositions[segmentIndex];
        
        // 세그먼트 이미지 로드
        const segImg = new Image();
        segImg.crossOrigin = "anonymous";
        
        await new Promise<void>((resolveSegment) => {
          segImg.onload = () => {
            // 임시 캔버스에 세그먼트 그리기 (저장된 위치에)
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
            
            if (tempCtx) {
              // 세그먼트를 저장된 위치에 그리기
              tempCtx.drawImage(segImg, segmentPos.x, segmentPos.y);
              const segData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
              const segPixels = segData.data;
              
              // 먼저 원본 세그먼트의 검은색 outline 위치를 저장
              const outlineMap = new Uint8Array(segPixels.length / 4);
              for (let i = 0; i < segPixels.length; i += 4) {
                const alpha = segPixels[i + 3];
                const origR = segPixels[i];
                const origG = segPixels[i + 1];
                const origB = segPixels[i + 2];
                
                // 검은색에 가까운 픽셀을 outline으로 저장 (RGB 모두 50 이하)
                if (alpha > 0 && origR <= 50 && origG <= 50 && origB <= 50) {
                  outlineMap[i / 4] = 1;
                }
              }
              
              // 색상을 RGB로 변환
              const hex = color.substring(1);
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);
              
              // 세그먼트의 불투명 픽셀 색칠
              for (let i = 0; i < segPixels.length; i += 4) {
                const alpha = segPixels[i + 3];
                
                if (alpha > 0) {
                  // outline이 아닌 부분만 색칠 (outline은 원본 색상 유지)
                  if (outlineMap[i / 4] !== 1) {
                    segPixels[i] = r;
                    segPixels[i + 1] = g;
                    segPixels[i + 2] = b;
                  }
                  // outline 부분(outlineMap[i / 4] === 1)은 원본 색상 그대로 유지
                }
              }
              
              tempCtx.putImageData(segData, 0, 0);
              
              // 메인 캔버스에 합성
              ctx.drawImage(tempCanvas, 0, 0);
            }
            
            completedSegments++;
            resolveSegment();
          };
          
          segImg.onerror = () => {
            console.warn(`⚠️ 세그먼트 이미지 로드 실패: ${segmentPath}`);
            completedSegments++;
            resolveSegment();
          };
          
          segImg.src = segmentPath;
        });
      }

      console.log(`✅ 모든 세그먼트 색칠 완료: ${completedSegments}/${totalSegments}`);

      // Outline 이미지 생성 (세그먼트를 검은색 테두리로만 표시)
      const outlineCanvas = document.createElement("canvas");
      outlineCanvas.width = img.width;
      outlineCanvas.height = img.height;
      const outlineCtx = outlineCanvas.getContext("2d", { willReadFrequently: true });

      if (outlineCtx) {
        for (let i = 0; i < segmentPaths.length; i++) {
          const segmentPath = segmentPaths[i];
          const segmentPos = segmentPositions[i];
          
          const outlineImg = new Image();
          outlineImg.crossOrigin = "anonymous";
          
          await new Promise<void>((resolveOutline) => {
            outlineImg.onload = () => {
              // 임시 캔버스에 세그먼트 그리기
              const tempCanvas = document.createElement("canvas");
              tempCanvas.width = img.width;
              tempCanvas.height = img.height;
              const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
              
              if (tempCtx) {
                // 세그먼트를 저장된 위치에 그리기
                tempCtx.drawImage(outlineImg, segmentPos.x, segmentPos.y);
                const segData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                const segPixels = segData.data;
                
                // 모든 불투명 픽셀을 회색으로 변환 (윤곽선만 남김)
                for (let j = 0; j < segPixels.length; j += 4) {
                  const alpha = segPixels[j + 3];
                  if (alpha > 0) {
                    segPixels[j] = 128;     // R - 회색
                    segPixels[j + 1] = 128; // G - 회색
                    segPixels[j + 2] = 128; // B - 회색
                    // alpha는 유지
                  }
                }
                
                tempCtx.putImageData(segData, 0, 0);
                outlineCtx.drawImage(tempCanvas, 0, 0);
              }
              
              resolveOutline();
            };
            outlineImg.onerror = () => {
              resolveOutline();
            };
            outlineImg.src = segmentPath;
          });
        }
        console.log(`✅ Outline 이미지 생성 완료`);
      }

      // 미리보기용 리사이즈
      const previewSize = 320;
      const previewCanvas = document.createElement("canvas");
      previewCanvas.width = previewSize;
      previewCanvas.height = previewSize;
      const previewCtx = previewCanvas.getContext("2d", { willReadFrequently: true });

      if (!previewCtx) {
        resolve();
        return;
      }

      previewCtx.drawImage(canvas, 0, 0, previewSize, previewSize);
      setPreviewImage(previewCanvas.toDataURL());

      // Outline 미리보기도 리사이즈
      const previewOutlineCanvas = document.createElement("canvas");
      previewOutlineCanvas.width = previewSize;
      previewOutlineCanvas.height = previewSize;
      const previewOutlineCtx = previewOutlineCanvas.getContext("2d", { willReadFrequently: true });

      if (previewOutlineCtx) {
        previewOutlineCtx.drawImage(outlineCanvas, 0, 0, previewSize, previewSize);
        setPreviewOutlineImage(previewOutlineCanvas.toDataURL());
      }

      // 정답 색상 저장
      const previewImageData = previewCtx.getImageData(0, 0, previewSize, previewSize);
      const previewPixels = previewImageData.data;
      const correctColorsMap: { [key: number]: string } = {};
      const scaleX = previewSize / canvas.width;
      const scaleY = previewSize / canvas.height;

      console.log(`🔍 디버깅: 이미지 = ${imageName}`);
      console.log(`🔍 디버깅: 원본 이미지 크기 = ${canvas.width}x${canvas.height}`);
      console.log(`🔍 디버깅: 미리보기 크기 = ${previewSize}x${previewSize}`);
      console.log(`🔍 디버깅: 스케일 비율 = ${scaleX.toFixed(2)} x ${scaleY.toFixed(2)}`);

      segmentPositions.forEach((pos, index) => {
        const scaledX = Math.floor(pos.x * scaleX);
        const scaledY = Math.floor(pos.y * scaleY);

        const pixelIndex = (scaledY * previewSize + scaledX) * 4;
        const r = previewPixels[pixelIndex];
        const g = previewPixels[pixelIndex + 1];
        const b = previewPixels[pixelIndex + 2];

        const hexColor = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
        correctColorsMap[index] = hexColor;

        console.log(`세그먼트 ${index} (${segmentNames[index]}) 정답색: ${hexColor}`);
      });

      // Map으로 변환하여 저장
      const correctColorsMapAsMap = new Map<number, string>();
      Object.entries(correctColorsMap).forEach(([key, value]) => {
        correctColorsMapAsMap.set(Number(key), value);
      });
      setCorrectAnswerColors(correctColorsMapAsMap);
      console.log(`✅ 정답색 저장 완료: ${Object.keys(correctColorsMap).length}/${segmentPositions.length}개 세그먼트`);

      resolve();
    };

    img.onerror = () => {
      console.error("❌ 이미지 로드 실패");
      resolve();
    };
  });
};
  
  // 브러쉬 이미지 preload
  useEffect(() => {
    const brushImages = [
      brushYellow, brushOrange, brushRed, brushGreen, 
      brushNavy, brushSky, brushBrown, brushPurple, brushClear
    ];
    brushImages.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // 커서 표시 여부 제어
  useEffect(() => {
    if (!cursorRef.current) return;

    const shouldShow =
      gameState === "playing" &&
      !isPaused &&
      isCursorInside &&
      colorSelected;

    cursorRef.current.style.display = shouldShow ? "block" : "none";
  }, [gameState, isPaused, isCursorInside, colorSelected]);

  // 선택한 색에 따라 브러쉬 이미지 자동 변경
  useEffect(() => {
    if (!colorSelected) {
      setBrushSrc(brushClear);
      return;
    }

    const imageName = COLORING_IMAGES[selectedImageIndex]?.name;
    const yellowColor = imageName === "거실" ? "#E3D173" : "#FCDB8E";

    let currentColorHex = COLOR_PALETTE[selectedColorIndex]?.hex;
    if (COLOR_PALETTE[selectedColorIndex]?.name === "노랑") {
      currentColorHex = yellowColor;
    }

    setBrushSrc(colorToBrush[currentColorHex || ""] || brushClear);
  }, [colorSelected, selectedColorIndex, selectedImageIndex]);

  useEffect(() => {
    if (gameState === "preview" || gameState === "playing") {
      loadImages(selectedImageIndex).then(() => {
        if (outlineImgRef.current) {
          initializeCanvas(outlineImgRef.current, selectedImageIndex, outlineCanvasRef.current);
          const positions = segmentPositionsRef.current;
          setSegmentOffsets(positions.map(() => ({ x: 0, y: 0 })));
        }
      });
    }
  }, [selectedImageIndex, gameState]);

  useEffect(() => {
    if (segmentOffsets.length > 0) {
      redrawSegments(segmentOffsets);
    }
  }, [segmentOffsets]);

  useEffect(() => {
    if (gameState === "playing" && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [gameState, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeText = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  const startGame = () => {
    playSelectSound();
    setShowCompleteButton(false);
    setSegmentOffsets(segmentPositionsRef.current.map(() => ({ x: 0, y: 0 })));
    setColorSelected(false);
    setSelectedColorIndex(0);
    setBrushSrc(brushClear);
    setGameState("playing");
  };

  const togglePause = () => {
    playClickSound();
    setIsPaused(prev => !prev);
  };

  const handleRestart = () => {
    playClickSound();
    setIsPaused(false);
    setElapsedTime(0);
    setShowCompletedTime(false);
    setShowCompleteButton(false);
    setScore(0);
    setCorrectAnswerColors(new Map());
    setSegmentOffsets(segmentPositionsRef.current.map(() => ({ x: 0, y: 0 })));
    setPreviewUsedCount(0);
    setColorSelected(false);
    setSelectedColorIndex(0);
    setBrushSrc(brushClear);
    
    const randomIndex = Math.floor(Math.random() * COLORING_IMAGES.length);
    setSelectedImageIndex(randomIndex);
    generatePreviewImage(randomIndex, selectedLevel);
    setGameState("preview");
  };

  const handleContinue = () => {
    playClickSound();
    setIsPaused(false);
    setElapsedTime(0);
    setShowCompletedTime(false);
    setShowCompleteButton(false);
    // setScore(0); // 점수는 초기화하지 않음!
    setCorrectAnswerColors(new Map());
    setSegmentOffsets(segmentPositionsRef.current.map(() => ({ x: 0, y: 0 })));
    setPreviewUsedCount(0);
    setColorSelected(false);
    setSelectedColorIndex(0);
    setBrushSrc(brushClear);
    
    const randomIndex = Math.floor(Math.random() * COLORING_IMAGES.length);
    setSelectedImageIndex(randomIndex);
    generatePreviewImage(randomIndex, selectedLevel);
    setGameState("preview");
  };

  const handleBackToLevels = () => {
    playBackSound();
    setIsPaused(false);
    setElapsedTime(0);
    setCorrectAnswerColors(new Map());
    setSegmentOffsets([]);
    setColorSelected(false);
    setSelectedColorIndex(0);
    onBack();
  };

  const handleExitConfirm = () => {
    playBackSound();
    setShowExitConfirm(false);
    handleBackToLevels();
  };

  const handleLevelSelect = (level: number) => {
    playSelectSound();
    setSelectedLevel(level);
    setElapsedTime(0);
    setCorrectAnswerColors(new Map());
    setSegmentOffsets([]);
    
    const randomIndex = Math.floor(Math.random() * COLORING_IMAGES.length);
    setSelectedImageIndex(randomIndex);
    generatePreviewImage(randomIndex, level);
    setGameState("preview");
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== "playing" || isPaused) return;

    if (!colorSelected) {
      console.log("먼저 팔레트에서 색상을 선택해주세요");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const brushOffsetX = 0;
    const brushOffsetY = 0;
    
    const centerX = Math.floor((e.clientX - rect.left + brushOffsetX) * scaleX);
    const centerY = Math.floor((e.clientY - rect.top + brushOffsetY) * scaleY);

    const imageName = COLORING_IMAGES[selectedImageIndex]?.name;
    const yellowColor = imageName === "거실" ? "#E3D173" : "#FCDB8E";
    
    let currentColorHex = COLOR_PALETTE[selectedColorIndex]?.hex;
    if (COLOR_PALETTE[selectedColorIndex]?.name === "노랑") {
      currentColorHex = yellowColor;
    }
    
    if (!currentColorHex) {
      console.log("색상이 선택되지 않았습니다");
      return;
    }

    let filled = false;
    const searchRadius = 3;
    
    filled = fillSegment(centerX, centerY, currentColorHex, segmentOffsets);
    
    if (!filled) {
      for (let radius = 1; radius <= searchRadius && !filled; radius++) {
        for (let dx = -radius; dx <= radius && !filled; dx++) {
          for (let dy = -radius; dy <= radius && !filled; dy++) {
            if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
              filled = fillSegment(centerX + dx, centerY + dy, currentColorHex, segmentOffsets);
            }
          }
        }
      }
    }
    
    if (filled) {
      playClickSound();
      redrawSegments(segmentOffsets);
      
      const imageName = COLORING_IMAGES[selectedImageIndex]?.name || "";
      let segmentCount = 8;
      
      switch (imageName) {
        case "풍선":
          segmentCount = 8;
          break;
        case "집":
          segmentCount = 14;
          break;
        case "아이":
          segmentCount = 20;
          break;
        case "거실":
          segmentCount = 12;
          break;
        case "기차":
          segmentCount = 21;
          break;
        default:
          segmentCount = 8;
      }
      
      const filledCount = segmentColorsRef.current.filter(color => color != null && color !== undefined).length;
      
      if (filledCount === segmentCount) {
        setShowCompleteButton(true);
      }
    } else {
      console.log("색칠 실패 - 해당 위치 근처에 조각 없음");
    }
  };

  const handleCanvasMouseEnter = () => {
    setIsCursorInside(true);
  };

  const handleCanvasMouseLeave = () => {
    setIsCursorInside(false);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cursorRef.current) return;
    if (gameState !== "playing" || isPaused) return;

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    cursorRef.current.style.left = `${x}px`;
    cursorRef.current.style.top = `${y}px`;
  };

  const handleColorSelect = (index: number) => {
    playClickSound();
    setSelectedColorIndex(index);
    setColorSelected(true);

    const colorName = COLOR_PALETTE[index]?.name || "알 수 없음";
    const imageName = COLORING_IMAGES[selectedImageIndex]?.name;
    const yellowColor = imageName === "거실" ? "#E3D173" : "#FCDB8E";

    let colorHex = COLOR_PALETTE[index]?.hex;
    if (COLOR_PALETTE[index]?.name === "노랑") {
      colorHex = yellowColor;
    }

    console.log(`선택된 색상: ${colorName} (${colorHex})`);
  };

  const handlePaletteClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPaused) return;
    
    const element = e.currentTarget;
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    const colorWidth = width / 8;
    const clickedIndex = Math.floor(x / colorWidth);
    
    if (clickedIndex >= 0 && clickedIndex < 8) {
      handleColorSelect(clickedIndex);
    }
  };

  const handleComplete = () => {
    playSelectSound();
    
    const imageName = COLORING_IMAGES[selectedImageIndex]?.name;
    let segmentCount = 0;
    
    switch (imageName) {
      case "풍선":
        segmentCount = 8;
        break;
      case "집":
        segmentCount = 14;
        break;
      case "난":
        segmentCount = 14;
        break;
      case "아이":
        segmentCount = 20;
        break;
      case "거실":
        segmentCount = 12;
        break;
      case "기차":
        segmentCount = 21;
        break;
      default:
        segmentCount = 8;
    }
    
    const coloredCanvas = coloredCanvasRef.current;
    if (!coloredCanvas) {
      setGameState("complete");
      return;
    }
    
    const correctImg = new Image();
    correctImg.crossOrigin = "anonymous";
    correctImg.src = COLORING_IMAGES[selectedImageIndex].src;
    
    correctImg.onload = () => {
      console.log(`📸 원본 이미지 로드 완료: ${correctImg.naturalWidth}x${correctImg.naturalHeight}`);
      console.log(`🎨 캔버스 크기: ${coloredCanvas.width}x${coloredCanvas.height}`);
      
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = coloredCanvas.width;
      tempCanvas.height = coloredCanvas.height;
      const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
      
      if (!tempCtx) return;
      
      tempCtx.drawImage(correctImg, 0, 0, tempCanvas.width, tempCanvas.height);
      const correctData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      
      const coloredCtx = coloredCanvas.getContext("2d", { willReadFrequently: true });
      if (!coloredCtx) return;
      
      const coloredData = coloredCtx.getImageData(0, 0, coloredCanvas.width, coloredCanvas.height);
      
      let totalColoredPixels = 0;
      let correctPixels = 0;
      const threshold = 50;
      
      for (let i = 0; i < correctData.data.length; i += 4) {
        const correctR = correctData.data[i];
        const correctG = correctData.data[i + 1];
        const correctB = correctData.data[i + 2];
        const correctA = correctData.data[i + 3];
        
        const coloredR = coloredData.data[i];
        const coloredG = coloredData.data[i + 1];
        const coloredB = coloredData.data[i + 2];
        const coloredA = coloredData.data[i + 3];
        
        if (correctA > 0 && (correctR >= 80 || correctG >= 80 || correctB >= 80)) {
          totalColoredPixels++;
          
          if (coloredA > 0) {
            const rDiff = Math.abs(correctR - coloredR);
            const gDiff = Math.abs(correctG - coloredG);
            const bDiff = Math.abs(correctB - coloredB);
            
            if (rDiff <= threshold && gDiff <= threshold && bDiff <= threshold) {
              correctPixels++;
            }
          }
        }
      }
      
      const accuracy = totalColoredPixels > 0 ? (correctPixels / totalColoredPixels) * 100 : 0;
      const filledCount = segmentColorsRef.current.filter(color => color != null && color !== undefined).length;
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setShowCompletedTime(true);
      
      const segmentPositions = getSegmentPositions(imageName);
        
      const scoringResult = calculateGameScore(
        segmentCount,
        segmentPositions,
        coloredCanvas,
        correctAnswerColors,
        elapsedTime,
        originalImageSize.width,  // 원본 이미지 너비
        originalImageSize.height  // 원본 이미지 높이
      );
      
      if (!scoringResult) {
        console.error("점수 계산 실패");
        return;
      }
      
      const { correctSegments, correctSegmentIndices, baseScore, timeBonus, finalScore } = scoringResult;
      setScore(finalScore);
      
      if (correctSegments < segmentCount) {
        setHearts(prev => Math.max(0, prev - 1));
      }
      
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        
        const pointsPerSegment = 10;
        
        console.log('🎨 캔버스 정보:', { 
          canvasWidth: canvas.width, 
          canvasHeight: canvas.height,
          rectLeft: rect.left,
          rectTop: rect.top,
          rectWidth: rect.width,
          rectHeight: rect.height
        });
        console.log('🎨 segmentPositions 개수:', segmentPositions.length);
        
        for (let i = 0; i < correctSegmentIndices.length; i++) {
          const segmentIdx = correctSegmentIndices[i];
          const pos = segmentPositions[segmentIdx];
          
          console.log(`🎯 세그먼트 ${segmentIdx} 위치:`, pos);
          
          if (!pos) {
            console.warn(`⚠️ 세그먼트 ${segmentIdx}의 위치 정보 없음`);
            continue;
          }
          
          // 세그먼트 위치는 원본 이미지 크기 좌표이므로 캔버스 크기 기준으로 비율 계산
          const ratioX = pos.x / canvas.width;
          const ratioY = pos.y / canvas.height;
          
          const screenX = rect.left + (rect.width * ratioX);
          const screenY = rect.top + (rect.height * ratioY);
          
          console.log(`📍 화면 위치 계산:`, { 
            segmentIdx, 
            posX: pos.x, 
            posY: pos.y,
            ratioX, 
            ratioY, 
            screenX, 
            screenY,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight
          });
          
          setTimeout(() => {
            console.log('✅ 점수+코인 팝업 생성:', { id: scorePopupIdRef.current, points: pointsPerSegment, x: screenX, y: screenY });
            setScorePopups(prev => [
              ...prev,
              {
                id: scorePopupIdRef.current++,
                points: pointsPerSegment,
                x: screenX,
                y: screenY
              }
            ]);
            playClickSound();
          }, i * 200);
        }
        
        if (timeBonus > 0) {
          const timerElement = document.getElementById('timer-display');
          if (timerElement) {
            const timerRect = timerElement.getBoundingClientRect();
            const bonusX = timerRect.left + timerRect.width / 2;
            const bonusY = timerRect.top;
            
            setTimeout(() => {
              console.log('✅ 시간 보너스 코인 팝업 생성:', { id: scorePopupIdRef.current, points: timeBonus, x: bonusX, y: bonusY });
              setScorePopups(prev => [
                ...prev,
                {
                  id: scorePopupIdRef.current++,
                  points: timeBonus,
                  x: bonusX,
                  y: bonusY
                }
              ]);
              playClickSound();
            }, correctSegmentIndices.length * 200 + 300);
          }
        }
        
        const totalDelay = timeBonus > 0 
          ? 1500 + correctSegmentIndices.length * 200 + 300 + 300
          : 1500 + correctSegmentIndices.length * 200 + 300;
        
        setTimeout(() => {
          setScorePopups([]); // 모든 팝업 제거
          setGameState("complete");
          saveGameRecord("coloringGame", finalScore, selectedLevel);
        }, totalDelay);
      } else {
        setTimeout(() => {
          setScorePopups([]); // 모든 팝업 제거
          setGameState("complete");
          saveGameRecord("coloringGame", finalScore, selectedLevel);
        }, 1500);
      }
    };
  };

  const handleReplay = () => {
    playClickSound();
    handleRestart();
  };

  const handleRulesClick = () => {
    playClickSound();
    setShowRules(true);
  };

  const handleRulesClose = () => {
    playClickSound();
    setShowRules(false);
  };

  const handleShowPreview = () => {
    if (previewUsedCount >= 3) return;
    
    playClickSound();
    setShowPreviewModal(true);
    setPreviewTimeLeft(10);
    setPreviewUsedCount(prev => prev + 1);
    
    previewTimerRef.current = setInterval(() => {
      setPreviewTimeLeft(prev => {
        if (prev <= 1) {
          if (previewTimerRef.current) {
            clearInterval(previewTimerRef.current);
            previewTimerRef.current = null;
          }
          setShowPreviewModal(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleClosePreview = () => {
    playClickSound();
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setShowPreviewModal(false);
  };

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
        previewTimerRef.current = null;
      }
    };
  }, []);

  // 팝업 컴포넌트 (모든 상태에서 공통으로 표시)
  const popups = (
    <>
      {/* 점수 팝업 애니메이션 - 코인과 함께 표시 */}
      {scorePopups.length > 0 && console.log('🎯 점수+코인 팝업 렌더링:', scorePopups)}
      {scorePopups.map(popup => (
        <div
          key={popup.id}
          className="fixed pointer-events-none z-50 animate-[scoreFloat_2s_ease-out_forwards]"
          style={{
            left: popup.x,
            top: popup.y,
            transform: 'translate(-50%, -50%)',
            zIndex: 10000
          }}
          onAnimationEnd={() => {
            setScorePopups(prev => prev.filter(p => p.id !== popup.id));
          }}
        >
          <div className="flex items-center gap-2">
            <ImageWithFallback 
              src={starIcon} 
              alt="코인" 
              style={{ width: "40px", height: "40px", objectFit: "contain" }}
            />
            <span className="text-4xl drop-shadow-lg" style={{ 
              fontFamily: 'OngleipRyudung',
              color: '#a7b7c4',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
            }}>
              +{popup.points}
            </span>
          </div>
        </div>
      ))}
    </>
  );

  if (gameState === "ready") {
    return (
      <>
      {popups}
      <div className="fixed inset-0 bg-amber-50 p-4 flex flex-col pt-16" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        <div className="flex items-center mb-4 flex-shrink-0">
          <button
            onClick={() => {
              playBackSound();
              onBack();
            }}
            className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer"
          >
            <ImageWithFallback
              src={exitIcon}
              alt="exit"
              className="h-8 w-8 object-contain"
            />
          </button>
          <h2 className="text-4xl ml-4" style={{ color: '#4a4a4a' }}>색칠 게임</h2>
        </div>

        <div className="pl-14 mb-4 flex-shrink-0">
          <p className="text-2xl text-center" style={{ color: '#4a4a4a', marginLeft: '-40px' }}>
            그림을 기억하고 색칠하세요!<br />
            잘못 색칠하면 하트를 잃습니다.
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative flex flex-col items-center justify-center">
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {[
                { level: 1, name: "4가지 색" },
                { level: 2, name: "6가지 색" },
                { level: 3, name: "8가지 색" }
              ].map((item) => (
                <button
                  key={item.level}
                  onClick={() => handleLevelSelect(item.level)}
                  className="relative hover:scale-105 active:scale-95 transition-transform w-2/3 mx-auto cursor-pointer"
                >
                  <ImageWithFallback
                    src={levelButtonBg}
                    alt={`레벨 ${item.level}`}
                    className="w-full h-auto object-contain"
                  />
                  <div className="absolute inset-0 flex flex-col items-start justify-center pl-8" style={{ fontFamily: 'OngleipRyudung', color: '#ffffff' }}>
                    <div className="text-3xl">레벨 {item.level}</div>
                    <div className="text-2xl">{item.name}</div>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-2xl text-gray-700 mt-4 text-center">레벨을 선택하세요</p>

            <GameRulesButton
              onClick={() => {
                playClickSound();
                setShowRules(true);
              }}
              backgroundColor="#a7b7c4"
              textColor="#ffffff"
            />
          </div>
        </div>

        <GameRulesModal 
          isOpen={showRules} 
          onClose={handleRulesClose} 
          title="색칠 게임 방법"
          primaryColor="#a7b7c4"
          backgroundColor="#e8edf1"
          scrollbarColor="#a7b7c4"
          scrollbarTrackColor="#e8edf1"
          onCloseSound={playClickSound}
        >
          <RuleSection title="게임 방법" titleColor="#a7b7c4">
            <RuleList items={[
              "색칠된 그림을 외워주세요.",
              "게임이 시작되면 색칠되지 않은 그림이 보입니다.",
              "아까 외운 완성본 그림과 똑같이 색칠해주세요.",
              "기억이 나지 않는다면 10초 동안 다시 볼 수 있어요!",
              "틀리게 색칠한 상태로 완성시키면 하트가 1개 줄어듭니다.",
              "하트가 모두 사라지면 게임이 종료됩니다."
            ]} />
          </RuleSection>
          
          <RuleSection title="점수" titleColor="#a7b7c4">
            <RuleList items={[
              "요소 하나 당 10점",
              "3분 이내로 완성시키면 30초 당 5점 추가"
            ]} />
          </RuleSection>
        </GameRulesModal>
      </div>
      </>
    );
  }
  
  if (gameState === "preview") {
    return (
      <>
      {popups}
      <div className="fixed inset-0 bg-amber-50 flex flex-col pt-16" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        <div className="flex items-center justify-between p-4 mb-4 flex-shrink-0">
          <button
            onClick={togglePause}
            className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer"
          >
            <ImageWithFallback
              src={pauseIcon}
              alt="일시정지"
              className="h-10 w-10 object-contain"
            />
          </button>

          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <Heart
                  key={i}
                  className={`w-7 h-7 ${
                    i < hearts
                      ? "text-[#cd6c58]"
                      : "fill-gray-300 text-gray-300"
                  }`}
                  fill={i < hearts ? "#cd6c58" : undefined}
                />
              ))}
            </div>
            
            <div className="bg-white/80 px-6 py-2 rounded-lg">
              <span className="text-2xl">점수: {score}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          <div 
            className="relative w-80 h-80 bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer" 
            style={{ border: '2px solid #a7b7c4' }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              console.log(`Preview 클릭 좌표: (${Math.floor(x)}, ${Math.floor(y)})`);
            }}
          >
            {/* 조각 그림 (색칠된 이미지) */}
            {previewImage && (
              <img
                src={previewImage}
                alt={`레벨 ${selectedLevel}`}
                className="absolute inset-0 w-full h-full object-contain"
                style={{ zIndex: 0 }}
              />
            )}
            
            {/* Outline 완성본 (위에 겹침) */}
            <canvas
              ref={outlineCanvasRef}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ zIndex: 1 }}
            />
          </div>

          <button
            onClick={startGame}
            className="relative w-64 h-20 flex items-center justify-center hover:scale-105 transition-transform"
          >
            <ImageWithFallback
              src={levelButtonBg}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
            />
            <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '2.25rem' }}>
              시작하기
            </span>
          </button>
        </div>

        {isPaused && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div 
              className="p-8 max-w-sm w-full mx-4 bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${pauseMenuBg})` }}
            >
              <h2 className="text-center mb-6 mt-4 text-4xl" style={{ color: '#eae4d3' }}>일시정지</h2>
              
              <div className="space-y-0">
                <button
                  onClick={togglePause}
                  className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
                >
                  <ImageWithFallback
                    src={resumeImg}
                    alt="resume"
                    className="h-12 w-12 object-contain"
                  />
                  <span className="text-3xl" style={{ color: '#eae4d3' }}>이어서</span>
                </button>

                <button
                  onClick={handleRestart}
                  className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
                >
                  <ImageWithFallback
                    src={restartImg}
                    alt="restart"
                    className="h-12 w-12 object-contain"
                  />
                  <span className="text-3xl" style={{ color: '#eae4d3' }}>처음부터</span>
                </button>

                <button
                  onClick={handleBackToLevels}
                  className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
                >
                  <ImageWithFallback
                    src={pauseExitIcon}
                    alt="exit"
                    className="h-12 w-12 object-contain"
                  />
                  <span className="text-3xl" style={{ color: '#eae4d3' }}>나가기</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  if (gameState === "complete") {
    return (
      <>
      {popups}
        {/* 게임 화면을 어둡게 배경으로 보여줌 */}
        <div className="fixed inset-0 bg-amber-50 flex flex-col" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, filter: 'brightness(0.5) blur(2px)' }}>
          <div className="flex justify-between items-center p-4 mb-4 flex-shrink-0">
            <button className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer" disabled>
              <ImageWithFallback
                src={pauseIcon}
                alt="일시정지"
                className="h-10 w-10 object-contain"
              />
            </button>

            <div className="flex items-center gap-4">
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <Heart
                    key={i}
                    className={`w-7 h-7 ${
                      i < hearts
                        ? "text-[#cd6c58]"
                        : "fill-gray-300 text-gray-300"
                    }`}
                    fill={i < hearts ? "#cd6c58" : undefined}
                  />
                ))}
              </div>
              
              <div className="bg-white/80 px-6 py-2 rounded-lg">
                <span className="text-2xl">점수: {score}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 pb-8 overflow-hidden">
            <div className="flex justify-center">
              <div className="relative w-80 h-80 bg-white rounded-lg shadow-lg overflow-hidden border-4 border-black">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="relative w-auto h-56">
                <ImageWithFallback
                  src={paletteImg}
                  alt="팔레트"
                  className="w-auto h-56 object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 성 모 */}
        <div className="fixed inset-0 flex items-center justify-center z-50 animate-in fade-in duration-200" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div 
            className="p-8 max-w-sm w-full mx-4 bg-contain bg-center bg-no-repeat animate-in zoom-in-95 duration-200"
            style={{ backgroundImage: `url(${pauseMenuBg})` }}
          >
            <h2 className="text-center mb-2 mt-4 text-4xl" style={{ color: '#eae4d3' }}>
              통과!
            </h2>
            <div className="text-center mb-2 text-2xl" style={{ color: '#d4c5a0' }}>
              최고 기록: {getGameRecord("coloringGame")[`level${selectedLevel}` as 'level1' | 'level2' | 'level3']}
            </div>
            <div className="text-center mb-6 text-2xl" style={{ color: '#eae4d3' }}>최종 점수: {score}</div>
            
            <div className="space-y-0">
              <button
                onClick={handleContinue}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
              >
                <ImageWithFallback
                  src={resumeImg}
                  alt="resume"
                  className="h-12 w-12 object-contain"
                />
                <span className="text-3xl" style={{ color: '#eae4d3' }}>이어서</span>
              </button>

              <button
                onClick={handleRestart}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
              >
                <ImageWithFallback
                  src={restartImg}
                  alt="restart"
                  className="h-12 w-12 object-contain"
                />
                <span className="text-3xl" style={{ color: '#eae4d3' }}>처음부터</span>
              </button>

              <button
                onClick={handleBackToLevels}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
              >
                <ImageWithFallback
                  src={pauseExitIcon}
                  alt="exit"
                  className="h-12 w-12 object-contain"
                />
                <span className="text-3xl" style={{ color: '#eae4d3' }}>나가기</span>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    {popups}
    <div className="fixed inset-0 bg-amber-50 flex flex-col pt-16" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="flex justify-between items-center px-4 py-3 flex-shrink-0">
        <button
          onClick={togglePause}
          className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer"
          disabled={isPaused}
        >
          <ImageWithFallback
            src={isPaused ? resumeImg : pauseIcon}
            alt={isPaused ? "계속하기" : "일시정지"}
            className="h-10 w-10 object-contain"
          />
        </button>

        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <Heart
                key={i}
                className={`w-7 h-7 ${
                  i < hearts
                    ? "text-[#cd6c58]"
                    : "fill-gray-300 text-gray-300"
                }`}
                fill={i < hearts ? "#cd6c58" : undefined}
              />
            ))}
          </div>
          
          <div className="bg-white/80 px-6 py-2 rounded-lg">
            <span className="text-2xl">점수: {score}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 pb-6 overflow-hidden">
        
        {/* 완성 시간 표시 (완성 버튼 누른 경우에만) */}
        {showCompletedTime && (
          <div className="mb-1 flex justify-center">
            <div className="flex items-center gap-2">
              <ImageWithFallback
                src={timerIcon}
                alt="타이머"
                className="h-7 w-7 object-contain -translate-y-0.5"
              />
              <span className="text-lg">걸린 시간: {formatTimeText(elapsedTime)}</span>
            </div>
          </div>
        )}
        
        {/* 캔버스 */}
        <div className="flex justify-center">
          <div 
            className="relative w-72 h-72 bg-white rounded-lg shadow-lg overflow-hidden"
            style={{ 
              border: '2px solid #a7b7c4'
            }}
          >
            {/* 전체 완성본 outline (고정, 배경) */}
            <canvas
              ref={outlineCanvasRef}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ zIndex: 0 }}
            />
            
            {/* 그림 조각들 */}
            <div
              style={{
                width: '100%',
                height: '100%',
                cursor: 'none',
                touchAction: 'none',
                position: 'relative',
                zIndex: 1
              }}
              onMouseMove={handleCanvasMouseMove}
              onMouseEnter={handleCanvasMouseEnter}
              onMouseLeave={handleCanvasMouseLeave}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
                style={{ background: 'transparent', pointerEvents: 'auto' }}
                onClick={handleCanvasClick}
              />
            </div>
            {/* 커스텀 브러쉬 커서 */}
            <div
              ref={cursorRef}
              className="pointer-events-none absolute z-10"
              style={{
                left: 0,
                top: 0,
                transform: 'translate(-5%, -90%)',
                display: 'none',
                width: '80px',
                height: '80px',
                backgroundImage: `url(${brushSrc})`,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                willChange: 'transform'
              }}
            />
          </div>
        </div>

        {/* 팔레트 이미지와 버튼들 */}
        <div className="flex flex-col items-center gap-1">
          <div 
            className="relative w-auto h-44"
          >
            <ImageWithFallback
              src={paletteImg}
              alt="팔레트"
              className="w-auto h-44 object-contain"
            />
            {/* 색상 선택 영역 - 투명 클릭 영역 */}
            <div className="absolute inset-0">
              {/* 빨강 위치 - 오른쪽 하단 */}
              <div
                className="absolute w-10 h-10 rounded-full cursor-pointer hover:bg-white/20 transition-colors"
                style={{ 
                  top: '73%', 
                  left: '66%', 
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={() => handleColorSelect(0)}
              />
              
              {/* 주황 위치 - 하단 중앙 */}
              <div
                className="absolute w-10 h-10 rounded-full cursor-pointer hover:bg-white/20 transition-colors"
                style={{ 
                  top: '77%', 
                  left: '47%', 
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={() => handleColorSelect(1)}
              />
              
              {/* 노랑 위치 - 왼쪽 하단 */}
              <div
                className="absolute w-10 h-10 rounded-full cursor-pointer hover:bg-white/20 transition-colors"
                style={{ 
                  top: '73%', 
                  left: '27%', 
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={() => handleColorSelect(2)}
              />
              
              {/* 초록 위치 - 왼쪽 */}
              <div
                className="absolute w-10 h-10 rounded-full cursor-pointer hover:bg-white/20 transition-colors"
                style={{ 
                  top: '54%', 
                  left: '13%', 
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={() => handleColorSelect(3)}
              />
              
              {/* 하늘 위치 - 왼쪽 위 */}
              <div
                className="absolute w-10 h-10 rounded-full cursor-pointer hover:bg-white/20 transition-colors"
                style={{ 
                  top: '34%', 
                  left: '21%', 
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={() => handleColorSelect(4)}
              />
              
              {/* 남색 위치 - 상단 중앙 */}
              <div
                className="absolute w-10 h-10 rounded-full cursor-pointer hover:bg-white/20 transition-colors"
                style={{ 
                  top: '24.5%', 
                  left: '41%', 
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={() => handleColorSelect(5)}
              />
              
              {/* 보라 위 - 오른쪽 위 */}
              <div
                className="absolute w-10 h-10 rounded-full cursor-pointer hover:bg-white/20 transition-colors"
                style={{ 
                  top: '27%', 
                  left: '62%', 
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={() => handleColorSelect(6)}
              />
              
              {/* 갈색 위치 - 중앙 */}
              <div
                className="absolute w-10 h-10 rounded-full cursor-pointer hover:bg-white/20 transition-colors"
                style={{ 
                  top: '51%', 
                  left: '40%', 
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={() => handleColorSelect(7)}
              />
            </div>
          </div>
          
          {/* 버튼들을 가로로 나란히 배치 */}
          <div className="flex gap-4 items-end">
            {/* 다시보기 버튼과 찬스 표시 */}
            <div className="flex flex-col items-center gap-2">
              {/* 다시보기 찬스 표시 (작은 원 3개) */}
              <div className="flex gap-1.5">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full transition-colors"
                    style={{
                      backgroundColor: i < (3 - previewUsedCount) ? '#A3B8C5' : '#FFFFFF',
                      border: '1px solid #A3B8C5'
                    }}
                  />
                ))}
              </div>
              
              {/* 다시보기 버튼 */}
              <button
                onClick={handleShowPreview}
                disabled={isPaused || previewUsedCount >= 3}
                className="relative w-40 h-16 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
              >
                <ImageWithFallback
                  src={buttonImg}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '1.75rem' }}>
                  다시보기
                </span>
              </button>
            </div>
            
            {/* Complete button - show only when all segments are filled */}
            {showCompleteButton && (
              <button
                onClick={handleComplete}
                disabled={isPaused}
                className="relative w-40 h-16 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
              >
                <ImageWithFallback
                  src={buttonImg}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '1.75rem' }}>
                  완성!
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {isPaused && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div 
            className="p-8 max-w-sm w-full mx-4 bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${pauseMenuBg})` }}
          >
            <h2 className="text-center mb-6 mt-4 text-4xl" style={{ color: '#eae4d3' }}>일시정지</h2>
            
            <div className="space-y-0">
              <button
                onClick={togglePause}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
              >
                <ImageWithFallback
                  src={resumeImg}
                  alt="resume"
                  className="h-12 w-12 object-contain"
                />
                <span className="text-3xl" style={{ color: '#eae4d3' }}>이어서</span>
              </button>
              
              <button
                onClick={handleRestart}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
              >
                <ImageWithFallback
                  src={restartImg}
                  alt="restart"
                  className="h-12 w-12 object-contain"
                />
                <span className="text-3xl" style={{ color: '#eae4d3' }}>처음부터</span>
              </button>
              
              <button
                onClick={handleBackToLevels}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
              >
                <ImageWithFallback
                  src={pauseExitIcon}
                  alt="exit"
                  className="h-12 w-12 object-contain"
                />
                <span className="text-3xl" style={{ color: '#eae4d3' }}>나가기</span>
              </button>
            </div>
          </div>
        </div>
      )}

            {/* 미리보기 다시보기 모달 */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-white/90 rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="text-center mb-4">
              <h3
                className="text-2xl mb-2"
                style={{ fontFamily: "OngleipRyudung" }}
              >
                미리보기
              </h3>
              <p
                className="text-xl"
                style={{ fontFamily: "OngleipRyudung" }}
              >
                {previewTimeLeft}초 남음
              </p>
            </div>

            {previewImage && previewOutlineImage && (
              <div className="mb-4 flex justify-center">
                {/* 두 이미지를 같은 위치에 완전히 겹쳐서 보여줌 */}
                <div className="relative w-80 h-80 bg-white rounded-lg overflow-hidden border border-gray-200">
                  {/* 색칠된 그림 */}
                  <ImageWithFallback
                    src={previewImage}
                    alt="Colored Preview"
                    className="absolute inset-0 w-full h-full object-contain rounded"
                  />
                  {/* 윤곽선 그림 (위에 겹침) */}
                  <ImageWithFallback
                    src={previewOutlineImage}
                    alt="Outline Preview"
                    className="absolute inset-0 w-full h-full object-contain rounded"
                    style={{ mixBlendMode: "multiply" }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleClosePreview}
              className="relative w-full h-12 flex items-center justify-center hover:scale-105 transition-transform"
            >
              <ImageWithFallback
                src={buttonImg}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
              <span
                className="relative font-[OngleipRyudung] text-white z-10"
                style={{ fontSize: "1.5rem" }}
              >
                닫기
              </span>
            </button>
          </div>
        </div>
      )}


      {/* 미완성 알림 모달 */}
      {showIncompleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-white/90 rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center mb-4">
              <p className="text-2xl mb-2" style={{ fontFamily: 'OngleipRyudung' }}>
                {incompleteMessage}
              </p>
              <p className="text-xl" style={{ fontFamily: 'OngleipRyudung', color: '#ef4444' }}>
                하트 -1
              </p>
            </div>
            
            <button
              onClick={() => setShowIncompleteModal(false)}
              className="relative w-full h-12 flex items-center justify-center hover:scale-105 transition-transform"
            >
              <ImageWithFallback
                src={buttonImg}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
              <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '1.5rem' }}>
                확인
              </span>
            </button>
          </div>
        </div>
      )}

      <canvas ref={coloredCanvasRef} className="hidden" />
    </div>
    </>
  );
}