import { useState, useEffect, useRef } from "react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { GameRulesButton } from "../GameRulesButton";
import { GameRulesModal, RuleSection, RuleList } from "../GameRulesModal";
import { playBackSound, playClickSound, playSelectSound } from "../../utils/sound";
import { ColoringGameProps, GameState } from "./coloring/coloringTypes";
import { COLORING_IMAGES } from "./coloring/coloringData";
import { useColoringCanvas } from "./coloring/useColoringCanvas";
import pauseIcon from "figma:asset/8acb1e015c5c90586e07679819984941b38f74af.png";
import resumeIcon from "figma:asset/62327073bfb38b1feb704b5c6f1eb2a36789eee8.png";
import pauseMenuBg from "figma:asset/54f8a82ff3f9348da47c92cd7e8e9b17adc71522.png";
import pauseExitIcon from "figma:asset/7b6920cff9236248c28a92364a77c6df5be27012.png";
import exitIcon from "figma:asset/74b1288f91a03a19fc199ba8e3ce487eebb3c1fb.png";
import levelButtonBg from "figma:asset/5d455998023ef79fbbf223eaf0a0e503e73de2f2.png";
import replayButtonBg from "figma:asset/76896cc73d11fff23bc0ef71e56e9001acc1b9ee.png";
import paletteImg from "figma:asset/5ba5c743706f1f61b899a9b817da0382ca0aad0a.png";
import buttonImg from "figma:asset/292f675f474bdb9553a5527caffea8d853194246.png";
import brushIcon from "figma:asset/e91ce300ea77a7c842a3adb230615860359851c5.png";
import timerIcon from "figma:asset/d1f826827279d92809d1120fb49bd347a1a3ee91.png";
import brushYellow from "figma:asset/0faf0b9cb98707116d975388798b3aabb49b9813.png";
import brushOrange from "figma:asset/8fdb52456b875d46ec70625049c1c4d84a52a0be.png";
import brushRed from "figma:asset/d4cbe294c778ed49075c692af65ae739fccf595e.png";
import brushGreen from "figma:asset/9da4d0c6e9d0443f1780bef8065a26327b7b076b.png";
import brushNavy from "figma:asset/91a3af52e196affa7901cfd76830500abac33a21.png";
import brushSky from "figma:asset/f3321191423e363ea4f72f45487cc54937634ccf.png";
import brushBrown from "figma:asset/95b3929dbf555867bcda381020ae890c63d63ddb.png";
import brushPurple from "figma:asset/88937aee057669826f57607995d91336d28a7824.png";

export function ColoringGame({ onBack }: ColoringGameProps) {
  const [gameState, setGameState] = useState<GameState>("ready");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [recommendedLevel, setRecommendedLevel] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { canvasRef, coloredCanvasRef, loadImages, fillBalloonSegment } = useColoringCanvas();
  
  const currentImage = COLORING_IMAGES[selectedLevel - 1];
  const colors = currentImage?.colors || [];

  useEffect(() => {
    if (gameState === "preview" || gameState === "playing") {
      loadImages(selectedLevel);
    }
  }, [selectedLevel, gameState]);

  // 컴포넌트 마운트 시 추천 레벨을 레벨 1로 설정
  useEffect(() => {
    setRecommendedLevel(1);
  }, []);

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

  const startGame = () => {
    playSelectSound();
    setGameState("playing");
  };

  const togglePause = () => {
    playClickSound();
    setIsPaused(!isPaused);
  };

  const handleRestart = () => {
    playClickSound();
    setIsPaused(false);
    setElapsedTime(0);
    setGameState("preview");
    
    setTimeout(() => {
      loadImages(selectedLevel);
      setGameState("playing");
    }, 100);
  };

  const handleBackToLevels = () => {
    playBackSound();
    setIsPaused(false);
    setElapsedTime(0);
    setGameState("ready");
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
    setGameState("preview");
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== "playing" || isPaused) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    console.log(`클릭 위치: canvas (${x}, ${y})`);

    const currentColor = colors[selectedColorIndex];
    if (!currentColor) return;

    if (COLORING_IMAGES[selectedLevel - 1].name === "풍선") {
      const filled = fillBalloonSegment(x, y, currentColor.hex);
      if (filled) {
        playClickSound();
      }
    }
  };

  const handleComplete = () => {
    playSelectSound();
    setGameState("complete");
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
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

  if (gameState === "ready") {
    return (
      <div className="fixed inset-0 bg-amber-50 flex flex-col" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        <div className="flex justify-between items-center p-4 px-8">
          <button
            onClick={() => {
              playBackSound();
              onBack();
            }}
            className="w-16 h-16 flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <ImageWithFallback src={exitIcon} alt="뒤로가기" className="w-full h-full object-contain" />
          </button>
          <GameRulesButton onClick={handleRulesClick} />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-12 pb-20">
          <div className="text-center">
            <h1 className="font-[Kkubullim] text-amber-900 mb-6" style={{ fontSize: '60px' }}>색칠하기</h1>
            <p className="font-[OngleipRyudung] text-amber-800" style={{ fontSize: '32px' }}>
              레벨을 선택하세요
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {[1, 2, 3].map((level) => (
              <button
                key={level}
                onClick={() => handleLevelSelect(level)}
                className="relative w-64 h-20 flex items-center justify-center hover:scale-105 transition-transform"
              >
                <ImageWithFallback
                  src={levelButtonBg}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '36px' }}>
                  {level}
                </span>
              </button>
            ))}
          </div>
        </div>

        <GameRulesModal isOpen={showRules} onClose={handleRulesClose} title="색칠하기 규칙">
          <RuleSection title="🎯 게임 목표">
            <RuleList>
              <li>그림의 각 영역을 클릭하여 색칠합니다</li>
              <li>모든 영역을 색칠하면 완성!</li>
            </RuleList>
          </RuleSection>

          <RuleSection title="🎨 게임 방법">
            <RuleList>
              <li>팔레트에서 원하는 색을 선택합니다</li>
              <li>그림의 원하는 영역을 클릭하여 색칠합니다</li>
              <li>잘못 칠했다면 다른 색으로 다시 칠할 수 있습니다</li>
            </RuleList>
          </RuleSection>

          <RuleSection title="⏸️ 게임 기능">
            <RuleList>
              <li>일시정지: 게임을 잠시 멈출 수 있습니다</li>
              <li>다시하기: 처음부터 다시 칠할 수 있습니다</li>
              <li>완성 버튼: 다 칠했다면 완성 버튼을 눌러주세요</li>
            </RuleList>
          </RuleSection>
        </GameRulesModal>
      </div>
    );
  }

  if (gameState === "preview") {
    return (
      <div className="fixed inset-0 bg-amber-50 flex flex-col items-center justify-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        <div className="flex flex-col items-center gap-8">
          <div className="text-center">
            <h2 className="font-[Kkubullim] text-amber-900 mb-4" style={{ fontSize: '48px' }}>
              레벨 {selectedLevel}
            </h2>
            <p className="font-[OngleipRyudung] text-amber-800" style={{ fontSize: '28px' }}>
              이 그림을 색칠해보세요!
            </p>
          </div>

          <div className="relative w-96 h-96 bg-white rounded-lg shadow-lg overflow-hidden">
            <ImageWithFallback
              src={currentImage.src}
              alt={`레벨 ${selectedLevel}`}
              className="w-full h-full object-contain"
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
            <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '36px' }}>
              시작하기
            </span>
          </button>

          <button
            onClick={handleBackToLevels}
            className="font-[OngleipRyudung] text-amber-700 hover:text-amber-900 transition-colors"
            style={{ fontSize: '24px' }}
          >
            레벨 선택으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (gameState === "complete") {
    return (
      <div className="fixed inset-0 bg-amber-50 flex flex-col items-center justify-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        <div className="flex flex-col items-center gap-8">
          <div className="text-center">
            <h2 className="font-[Kkubullim] text-amber-900 mb-4" style={{ fontSize: '56px' }}>
              완성!
            </h2>
            <p className="font-[OngleipRyudung] text-amber-800" style={{ fontSize: '28px' }}>
              소요 시간: {formatTime(elapsedTime)}
            </p>
          </div>

          <div className="relative w-96 h-96 bg-white rounded-lg shadow-lg overflow-hidden">
            <canvas
              ref={coloredCanvasRef}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex gap-6">
            <button
              onClick={handleReplay}
              className="relative w-48 h-16 flex items-center justify-center hover:scale-105 transition-transform"
            >
              <ImageWithFallback
                src={replayButtonBg}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
              <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '28px' }}>
                다시하기
              </span>
            </button>

            <button
              onClick={handleBackToLevels}
              className="relative w-48 h-16 flex items-center justify-center hover:scale-105 transition-transform"
            >
              <ImageWithFallback
                src={levelButtonBg}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
              <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '28px' }}>
                레벨 선택
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-amber-50 flex flex-col" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="flex justify-between items-center p-4 px-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="w-12 h-12 flex items-center justify-center hover:opacity-80 transition-opacity"
            disabled={isPaused}
          >
            <ImageWithFallback src={exitIcon} alt="나가기" className="w-full h-full object-contain" />
          </button>

          <div className="flex items-center gap-3 bg-white/80 px-6 py-3 rounded-full shadow-md">
            <ImageWithFallback src={timerIcon} alt="timer" className="w-8 h-8" />
            <span className="font-[OngleipRyudung] text-amber-900" style={{ fontSize: '28px' }}>
              {formatTime(elapsedTime)}
            </span>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={togglePause}
            className="w-14 h-14 flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <ImageWithFallback
              src={isPaused ? resumeIcon : pauseIcon}
              alt={isPaused ? "계속하기" : "일시정지"}
              className="w-full h-full object-contain"
            />
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-8 p-8 pt-4 overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-full h-full bg-white rounded-lg shadow-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full h-full object-contain cursor-crosshair"
            />
          </div>
        </div>

        <div className="w-80 flex flex-col gap-6">
          <div className="relative bg-white rounded-lg shadow-lg p-6">
            <ImageWithFallback
              src={paletteImg}
              alt="팔레트"
              className="absolute inset-0 w-full h-full object-cover rounded-lg"
            />
            <div className="relative z-10">
              <h3 className="font-[OngleipRyudung] text-amber-900 mb-4 text-center" style={{ fontSize: '32px' }}>
                색상 선택
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {colors.map((color, index) => {
                  const brushImages: {[key: string]: string} = {
                    "노란색": brushYellow,
                    "주황색": brushOrange,
                    "빨간색": brushRed,
                    "분홍색": brushRed,
                    "초록색": brushGreen,
                    "초록색2": brushGreen,
                    "연두색": brushGreen,
                    "남색": brushNavy,
                    "네이비색": brushNavy,
                    "하늘색": brushSky,
                    "하늘색2": brushSky,
                    "갈색": brushBrown,
                    "보라색": brushPurple,
                  };

                  return (
                    <button
                      key={index}
                      onClick={() => {
                        playClickSound();
                        setSelectedColorIndex(index);
                      }}
                      className={`relative h-16 rounded-lg transition-all ${
                        selectedColorIndex === index
                          ? "ring-4 ring-amber-400 scale-105"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.hex }}
                    >
                      {selectedColorIndex === index && (
                        <ImageWithFallback
                          src={brushImages[color.name] || brushIcon}
                          alt="brush"
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={handleComplete}
            disabled={isPaused}
            className="relative h-20 flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
          >
            <ImageWithFallback
              src={buttonImg}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
            />
            <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '32px' }}>
              완성!
            </span>
          </button>
        </div>
      </div>

      {isPaused && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative w-96 bg-white rounded-xl shadow-2xl p-8">
            <ImageWithFallback
              src={pauseMenuBg}
              alt=""
              className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-20"
            />
            <div className="relative z-10 flex flex-col gap-6">
              <h2 className="font-[Kkubullim] text-amber-900 text-center" style={{ fontSize: '48px' }}>
                일시정지
              </h2>

              <div className="flex flex-col gap-4">
                <button
                  onClick={togglePause}
                  className="relative h-16 flex items-center justify-center hover:scale-105 transition-transform"
                >
                  <ImageWithFallback
                    src={levelButtonBg}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '28px' }}>
                    계속하기
                  </span>
                </button>

                <button
                  onClick={handleRestart}
                  className="relative h-16 flex items-center justify-center hover:scale-105 transition-transform"
                >
                  <ImageWithFallback
                    src={replayButtonBg}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '28px' }}>
                    다시하기
                  </span>
                </button>

                <button
                  onClick={handleBackToLevels}
                  className="relative h-16 flex items-center justify-center hover:scale-105 transition-transform"
                >
                  <ImageWithFallback
                    src={pauseExitIcon}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '28px' }}>
                    레벨 선택
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md">
            <h2 className="font-[Kkubullim] text-amber-900 text-center mb-6" style={{ fontSize: '40px' }}>
              게임을 나가시겠습니까?
            </h2>
            <p className="font-[OngleipRyudung] text-amber-800 text-center mb-8" style={{ fontSize: '24px' }}>
              진행 상황이 저장되지 않습니다
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  playClickSound();
                  setShowExitConfirm(false);
                }}
                className="flex-1 relative h-14 flex items-center justify-center hover:scale-105 transition-transform"
              >
                <ImageWithFallback
                  src={levelButtonBg}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '24px' }}>
                  취소
                </span>
              </button>
              <button
                onClick={handleExitConfirm}
                className="flex-1 relative h-14 flex items-center justify-center hover:scale-105 transition-transform"
              >
                <ImageWithFallback
                  src={pauseExitIcon}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <span className="relative font-[OngleipRyudung] text-white z-10" style={{ fontSize: '24px' }}>
                  나가기
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      <canvas ref={coloredCanvasRef} className="hidden" />
    </div>
  );
}