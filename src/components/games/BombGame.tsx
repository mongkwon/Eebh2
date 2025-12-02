import { useState, useEffect, useRef, useCallback } from "react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { Heart } from "lucide-react";
import { GameRulesButton } from "../GameRulesButton";
import { GameRulesModal, RuleSection, RuleList } from "../GameRulesModal";
import { playBackSound, playClickSound, playSelectSound } from "../../utils/sound";
import { saveGameRecord, getGameRecord } from "../../utils/gameRecord";
import exitIcon from "figma:asset/74b1288f91a03a19fc199ba8e3ce487eebb3c1fb.png";
import bombImage from "figma:asset/db6a3c4c6061310860d16b4cac968a75ce7668a2.png";
import explosionImage from "figma:asset/56dd3abd053ac5bbb00ae4fb94fcb64339c04ad8.png";
import pauseMenuBg from "figma:asset/54f8a82ff3f9348da47c92cd7e8e9b17adc71522.png";
import restartIcon from "figma:asset/d1a45328f3c2f5290d250ff17f71584c907a61a7.png";
import pauseExitIcon from "figma:asset/7b6920cff9236248c28a92364a77c6df5be27012.png";
import pauseIcon from "figma:asset/8acb1e015c5c90586e07679819984941b38f74af.png";
import resumeIcon from "figma:asset/62327073bfb38b1feb704b5c6f1eb2a36789eee8.png";
import levelButtonBg from "figma:asset/a29e3c84c9c958413e3e5b27055c8415d775b5fe.png";
import scoreStarIcon from "figma:asset/539c2a8bf466fe0b7e46f9ccca0d7887792cfb96.png";
import bombScoreIcon from "figma:asset/399adba23998dd03505039248a26901c996cb91f.png";

interface BombGameProps {
  onBack: () => void;
}

interface Bomb {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  isExploding: boolean;
  explosionTime?: number; // 폭발 시작 시간 추가
  explosionBaseScale?: number; // 폭발 시 기본 크기 저장
}

interface ScoreText {
  id: number;
  x: number;
  y: number;
  value: number;
  createdAt: number;
  scale: number; // 폭탄 크기 비율 추가
}

interface HeartText {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  scale: number; // 폭탄 크기 비율 추가
}

type GameState = "ready" | "playing" | "gameOver";

export function BombGame({ onBack }: BombGameProps) {
  const [gameState, setGameState] = useState<GameState>("ready");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [currentDifficulty, setCurrentDifficulty] = useState(1); // 현재 난이도 관리
  const [recommendedLevel, setRecommendedLevel] = useState<number | null>(null);
  const [bombs, setBombs] = useState<Bomb[]>([]);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [bombsCaught, setBombsCaught] = useState(0); // 잡은 폭탄 개수 추가
  const [isPaused, setIsPaused] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [gameResetKey, setGameResetKey] = useState(0); // 게임 리셋 키 추가
  const [scoreTexts, setScoreTexts] = useState<ScoreText[]>([]); // 점수 텍스트 배열
  const [heartTexts, setHeartTexts] = useState<HeartText[]>([]); // 하트 감소 텍스트 배열

  const [renderTime, setRenderTime] = useState<number>(Date.now());
  const [pauseCount, setPauseCount] = useState(0); // 일시정지 횟수 추적

  // 🔧 id를 ref로  (state 아님)
  const nextBombIdRef = useRef(0);

  const gameLoopRef = useRef<number | null>(null);
  const lastBombTimeRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number>(0); // 일시정지 시작 시간
  const totalPausedTimeRef = useRef<number>(0); // 총 일시정지 시간
  
  // 사이클 관리를 위한 ref
  const cycleStartTimeRef = useRef<number>(0);
  const spawnTimesRef = useRef<number[]>([]);
  const nextSpawnIndexRef = useRef<number>(0);
  
  // 난이도별 설정
  const getConfig = (difficulty?: number) => {
    const level = difficulty ?? currentDifficulty;
    switch (level) {
      case 1:
        return { cycleDuration: 10000, bombsPerCycle: 10, targetScore: 100 }; // 10초에 10개
      case 2:
        return { cycleDuration: 7000, bombsPerCycle: 10, targetScore: 100 }; // 7초에 10개
      case 3:
        return { cycleDuration: 4000, bombsPerCycle: 10, targetScore: 100 }; // 4초에 10개
      default:
        return { cycleDuration: 10000, bombsPerCycle: 10, targetScore: 100 };
    }
  };

  const config = getConfig();
  const BOMB_LIFETIME = 5000; // 5초

  // 사이클 내 랜덤 생성 시간 배열 생성 (각 구간 내에서 랜덤)
  const generateSpawnTimes = (cycleDuration: number, count: number): number[] => {
    const times: number[] = [];
    const slotDuration = cycleDuration / count; // 각 구간의 길이
    
    for (let i = 0; i < count; i++) {
      // 각 구간의 시작 시간
      const slotStart = i * slotDuration;
      // 구간 내에서 랜덤한 시간 (구간의 ±40% 범위)
      const randomOffset = (Math.random() - 0.5) * slotDuration * 0.8;
      const time = slotStart + slotDuration / 2 + randomOffset;
      
      // 0과 cycleDuration 사이로 제한
      times.push(Math.max(0, Math.min(cycleDuration - 1, time)));
    }
    
    return times.sort((a, b) => a - b); // 시간 순으로 정렬
  };

  // 게임 시작
  const startGame = (level?: number) => {
    setGameState("playing");
    setScore(0);
    setHearts(3);
    setBombs([]);
    setBombsCaught(0); // 잡은 폭탄 개수 초기화
    nextBombIdRef.current = 0;        // 🔧 id 리셋
    lastBombTimeRef.current = Date.now();
    setGameResetKey(prev => prev + 1); // 게임 리셋 키 업데이트
    totalPausedTimeRef.current = 0; // 일시정지 시간 초기화
    pauseStartTimeRef.current = 0; // 일시정지 시작 시간 초기화
    
    const targetLevel = level ?? currentDifficulty;
    if (level) {
      setCurrentDifficulty(level);
    }
    
    // 사이클 시작 시간 설정
    cycleStartTimeRef.current = Date.now();
    // 생성 시간 배열 생성 (level 파라미터로 config 가져오기)
    const levelConfig = getConfig(targetLevel);
    spawnTimesRef.current = generateSpawnTimes(levelConfig.cycleDuration, levelConfig.bombsPerCycle);
    nextSpawnIndexRef.current = 0;
  };

  // 랜덤 위치 생성 (겹치지 않게)
  const getRandomPosition = (existingBombs: Bomb[]): { x: number; y: number } => {
    const margin = 10; // 10% 여백
    const minDistance = 15; // 최소 거리 (%)
    const maxAttempts = 50; // 최대 시도 횟수
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = margin + Math.random() * (100 - margin * 2);
      const y = margin + Math.random() * (100 - margin * 2);
      
      // 기존 폭탄들과의 거리 체크
      let isValidPosition = true;
      for (const bomb of existingBombs) {
        const distance = Math.sqrt(
          Math.pow(x - bomb.x, 2) + Math.pow(y - bomb.y, 2)
        );
        if (distance < minDistance) {
          isValidPosition = false;
          break;
        }
      }
      
      if (isValidPosition) {
        return { x, y };
      }
    }
    
    // 최대 시도 횟수를 과하면 그냥 랜덤 위치 반환
    return {
      x: margin + Math.random() * (100 - margin * 2),
      y: margin + Math.random() * (100 - margin * 2)
    };
  };

  // 폭탄 생성
  const spawnBomb = () => {
    // 폭탄 생성 효과음
    playBombSpawnSound();
    
    setBombs((prevBombs) => {
      const position = getRandomPosition(prevBombs);
      const id = nextBombIdRef.current++;    // 🔧 여기서만 id 증가

      const newBomb: Bomb = {
        id,
        x: position.x,
        y: position.y,
        createdAt: Date.now(),
        isExploding: false,
      };
      
      return [...prevBombs, newBomb];
    });
  };

  // 폭탄 생성 효과음
  const playBombSpawnSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // 팝업 사운드 (높은 음에서 낮은 음으로)
    const osc = audioContext.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
    
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.1);
    
    // 정리
    setTimeout(() => {
      audioContext.close();
    }, 150);
  };

  // 폭탄 클릭 (잡기)
  const catchBomb = useCallback((bombId: number, x: number, y: number, bomb: Bomb) => {
    playClickSound();
    // 현재 시간으로 정확한 scale 계
    const currentTime = Date.now();
    const bombScale = getBombScale(bomb, currentTime);
    
    // 레벨별 점수 차등: 레벨 1은 10점, 레벨 2는 20점, 레벨 3은 30점
    const pointsPerCatch = currentDifficulty * 10;
    
    setScore((prev) => {
      const newScore = prev + pointsPerCatch;
      
      return newScore;
    });
    
    setBombsCaught(prev => prev + 1); // 잡은 폭탄 개수 증가
    
    // 점수 텍스트 추가 (폭탄의 크기 비율 저장)
    const newScoreText: ScoreText = {
      id: Date.now(),
      x,
      y,
      value: pointsPerCatch,
      createdAt: Date.now(),
      scale: bombScale // 폭탄의 현재 크기 비율 저장
    };
    setScoreTexts(prev => [...prev, newScoreText]);
    
    // 1.2초 후에 점수 텍스트 제거
    setTimeout(() => {
      setScoreTexts(prev => prev.filter(text => text.id !== newScoreText.id));
    }, 1200);
    
    // 폭탄 즉시 제거
    setBombs((prev) => prev.filter((b) => b.id !== bombId));
  }, [currentDifficulty]);

  // 폭탄 폭발
  const explodeBomb = (bomb: Bomb) => {
    // 이미 폭발 중이면 무시
    if (bomb.isExploding) return;
    
    const scale = getBombScale(bomb);
    
    // 폭발 효과음 재생
    playExplosionSound();
    
    // 폭발 애니메이션 시작
    setBombs((prev) =>
      prev.map((b) =>
        b.id === bomb.id ? { ...b, isExploding: true, explosionTime: Date.now(), explosionBaseScale: getBombScale(b) } : b
      )
    );

    // 🔥 0.5초 후 하트 감소 (폭발 효과가 충분히 보인 후)
    setTimeout(() => {
      setHearts((prev) => {
        const newHearts = prev - 1;
        if (newHearts <= 0) {
          setGameState("gameOver");
          saveGameRecord("bombGame", score, currentDifficulty);
        }
        return newHearts;
      });
    }, 500);

    // 0.5초 후 폭탄 제거 + 하트 감소 텍스트 표시
    setTimeout(() => {
      // 하트 감소 텍스트 추가 (폭탄이 사라진 후)
      const newHeartText: HeartText = {
        id: Date.now(),
        x: bomb.x,
        y: bomb.y,
        createdAt: Date.now(),
        scale: scale
      };
      setHeartTexts(prev => [...prev, newHeartText]);
      
      // 1.2초 후에 하트 텍스트 제거
      setTimeout(() => {
        setHeartTexts(prev => prev.filter(text => text.id !== newHeartText.id));
      }, 1200);
      
      setBombs((prev) => prev.filter((b) => b.id !== bomb.id));
    }, 500);
  };

  // 폭발 효과음
  const playExplosionSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // 낮은 주파수 폭발음
    const osc1 = audioContext.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(150, audioContext.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
    
    const gain1 = audioContext.createGain();
    gain1.gain.setValueAtTime(0.5, audioContext.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    
    osc1.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.5);
    
    // 화이트 노이즈 추가 (폭발 느낌)
    const bufferSize = audioContext.sampleRate * 0.3;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = buffer;
    
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    noiseSource.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    
    noiseSource.start(audioContext.currentTime);
    
    // 정리
    setTimeout(() => {
      audioContext.close();
    }, 600);
  };

  // 게임 루프
  useEffect(() => {
    if (gameState !== "playing" || isPaused) return;

    const gameLoop = () => {
      const now = Date.now();
      const adjustedNow = now - totalPausedTimeRef.current;

      // 새 사이클 시작 또는 초기화
      if (cycleStartTimeRef.current === 0 || 
          spawnTimesRef.current.length === 0 || 
          nextSpawnIndexRef.current >= config.bombsPerCycle) {
        
        // 새 사이클 시작
        cycleStartTimeRef.current = adjustedNow;
        spawnTimesRef.current = generateSpawnTimes(config.cycleDuration, config.bombsPerCycle);
        nextSpawnIndexRef.current = 0;
      }

      // 현재 사이클 내 경과 시간
      const cycleElapsed = adjustedNow - cycleStartTimeRef.current;

      // 다음 폭탄 생성 시간 체크
      if (nextSpawnIndexRef.current < spawnTimesRef.current.length) {
        const nextSpawnTime = spawnTimesRef.current[nextSpawnIndexRef.current];
        if (cycleElapsed >= nextSpawnTime) {
          spawnBomb();
          nextSpawnIndexRef.current++;
        }
      }

      // 폭탄 수명 체크 (일시정지 시간 제외)
      setBombs((currentBombs) => {
        const bombsToExplode: Bomb[] = [];

        currentBombs.forEach((bomb) => {
          if (!bomb.isExploding && adjustedNow - bomb.createdAt >= BOMB_LIFETIME) {
            bombsToExplode.push(bomb);
          }
        });

        // 터져야 할 폭탄들을 폭발시킴
        bombsToExplode.forEach((bomb) => explodeBomb(bomb));

        return currentBombs;
      });

      // 잡은 폭탄 개수로 변경
      if (bombsCaught >= 100) {
        // 100개의 폭탄을 잡으면 게임 종료
        setGameState("gameOver");
        saveGameRecord("bombGame", score, currentDifficulty);
        return;
      }

      setRenderTime(now);

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, score, bombsCaught, config.cycleDuration, config.bombsPerCycle, isPaused]);

  // 컴포넌트 마운트 시 추천 레벨 계산
  useEffect(() => {
    const records = getGameRecord("bombGame");
    const scores = [
      records.level1 || 0,
      records.level2 || 0,
      records.level3 || 0
    ];
    
    // 가장 낮은 점수를 가진 레벨 찾기
    const minScore = Math.min(...scores);
    const recommendedIdx = scores.findIndex(score => score === minScore);
    setRecommendedLevel(recommendedIdx + 1);
  }, []);

  // 재시작
  const restart = () => {
    playSelectSound();
    setGameState("playing");
    setCurrentDifficulty(selectedLevel); // 원래 난이도로 리셋
    setScore(0);
    setHearts(3);
    setBombs([]);
    setBombsCaught(0); // 잡은 폭탄 개수 초기화
    nextBombIdRef.current = 0; // ID 리셋
    lastBombTimeRef.current = Date.now();
    setGameResetKey(prev => prev + 1); // 게임 리셋 키 업데이트
    totalPausedTimeRef.current = 0; // 일시정지 시간 초기화
    pauseStartTimeRef.current = 0; // 일시정지 시작 시간 초기화
    setPauseCount(0); // 일시정지 카운터 초기화
    
    // 사이클 초기화
    cycleStartTimeRef.current = 0;
    spawnTimesRef.current = [];
    nextSpawnIndexRef.current = 0;
  };

  // 폭탄의 남은 시간 계산 (0-1 사이의 비율) - 일시정지 시 제외
  const getBombTimeRatio = (bomb: Bomb): number => {
    const elapsed = (renderTime - totalPausedTimeRef.current) - bomb.createdAt;
    return Math.min(elapsed / BOMB_LIFETIME, 1);
  };

  // 폭탄 크기 계산 (마지막 1초는 줄어드는 효과) - 일시정지 시간 제외
  const getBombScale = (bomb: Bomb, currentTime?: number): number => {
    const now = currentTime !== undefined ? currentTime : renderTime;
    const elapsed = (now - totalPausedTimeRef.current) - bomb.createdAt;
    const growStartTime = 500; // 0.5초부터 커지기 시작
    const shrinkStartTime = 3000; // 3초부터 줄어들기 시작
    
    if (elapsed < growStartTime) {
      // 0~0.5초: 0.8배 유지
      return 0.8;
    } else if (elapsed < shrinkStartTime) {
      // 0.5~3초: 0.8배에서 1.3배로 커짐
      const growDuration = shrinkStartTime - growStartTime; // 2500ms
      const ratio = (elapsed - growStartTime) / growDuration;
      return 0.8 + ratio * 0.5; // 0.8 -> 1.3
    } else {
      // 3~5초: 1.3배에서 0.8배로 줄어듦
      const shrinkRatio = (elapsed - shrinkStartTime) / 2000;
      return 1.3 - shrinkRatio * 0.5; // 1.3 -> 0.8
    }
  };

  // 폭발 애니메이션 scale 계산 (폭탄의 원래 크기에서 커졌다가 작아짐)
  const getExplosionScale = (bomb: Bomb): number => {
    if (!bomb.explosionBaseScale || !bomb.explosionTime) return 1;
    
    // 폭발 애니메이션은 0.5초 동안 진행 (일시정지 시간 제외)
    const adjustedRenderTime = renderTime - totalPausedTimeRef.current;
    const elapsed = adjustedRenderTime - bomb.explosionTime;
    const explosionDuration = 500; // 0.5초
    const ratio = Math.min(elapsed / explosionDuration, 1);
    
    // 0~0.25초: 원래 크기에서 1.3배로 빠르게 커짐
    // 0.25~0.5초: 1.3배에서 0으로 빠르게 작아짐
    if (ratio < 0.5) {
      // 커지는 단계 (0~0.25초)
      const growRatio = ratio / 0.5;
      return bomb.explosionBaseScale * (1 + growRatio * 0.3);
    } else {
      // 작아지는 단계 (0.25~0.5초)
      const shrinkRatio = (ratio - 0.5) / 0.5;
      return bomb.explosionBaseScale * (1.3 - shrinkRatio * 1.3);
    }
  };

  // 폭발 애니메이션 투명도 계산
  const getExplosionOpacity = (bomb: Bomb): number => {
    if (!bomb.explosionTime) return 1;
    
    // 일시정지 시간 제외
    const adjustedRenderTime = renderTime - totalPausedTimeRef.current;
    const elapsed = adjustedRenderTime - bomb.explosionTime;
    const explosionDuration = 500; // 0.5초
    const ratio = Math.min(elapsed / explosionDuration, 1);
    
    // 0~0.5초: 처음부터 끝까지 점점 투명해짐
    return 1 - ratio;
  };

  return (
    <div className="h-screen overflow-hidden bg-amber-50 p-4 flex flex-col pt-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center">
          {/* Ready 상태일 때만 뒤로가 버튼 */}
          {gameState === "ready" && (
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
                style={{ width: '2rem', height: '2rem', objectFit: 'contain' }}
              />
            </button>
          )}
          
          {gameState === "ready" && (
            <h1 className="text-gray-700 ml-4 text-4xl" style={{ fontFamily: "OngleipRyudung" }}>
              폭탄 게임
            </h1>
          )}
          
          {/* Playing 상태일 때 왼쪽에 일시정지 버튼 */}
          {gameState === "playing" && !isPaused && (
            <button
              onClick={() => {
                playClickSound();
                setIsPaused(true);
                pauseStartTimeRef.current = Date.now();
              }}
              className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer"
            >
              <ImageWithFallback
                src={pauseIcon}
                alt="pause"
                style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain' }}
              />
            </button>
          )}
          
          {gameState === "playing" && isPaused && (
            <div className="w-12" />
          )}
          
          {gameState === "gameOver" && (
            <div className="w-12" />
          )}
        </div>
        
        {gameState === "gameOver" && (
          <div className="w-12" />
        )}
        
        {/* Playing 상태일 때만 하트와 점수 표시 */}
        {gameState === "playing" && (
          <>
            <div className="flex items-center gap-4">
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <Heart
                    key={i}
                    style={{
                      width: '1.75rem',
                      height: '1.75rem',
                      fill: i < hearts ? '#cd6c58' : '#d1d5db',
                      color: i < hearts ? '#cd6c58' : '#d1d5db'
                    }}
                  />
                ))}
              </div>
              
              <div className="bg-white/80 px-6 py-2 rounded-lg">
                <span className="text-2xl">점수: {score}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Ready 상태일 때 게임 설명 */}
      {gameState === "ready" && (
        <p className="text-2xl text-gray-700 text-center mb-4">
          여기저기 나타나는 폭탄을 잡으세요!<br />
          시간이 지나면 폭탄이 터지고 하트를 잃습니다.
        </p>
      )}

      {/* Ready Screen - 레벨 선택 */}
      {gameState === "ready" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="relative flex flex-col items-center justify-center">
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                onClick={() => {
                  playSelectSound();
                  setSelectedLevel(1);
                  startGame();
                }}
                className="relative hover:scale-105 active:scale-95 transition-transform w-2/3 mx-auto cursor-pointer"
                style={recommendedLevel === 1 ? {
                  animation: 'buttonPulse 1.5s ease-in-out infinite'
                } : undefined}
              >
                <ImageWithFallback
                  src={levelButtonBg}
                  alt="레벨 1"
                  className="w-full h-auto object-contain"
                />
                <div className="absolute inset-0 flex flex-col items-start justify-center pl-8" style={{ fontFamily: 'OngleipRyudung', color: '#ffffff' }}>
                  <div className="text-3xl">레벨 1</div>
                  <div className="text-2xl">느림</div>
                </div>
              </button>
              
              <button
                onClick={() => {
                  playSelectSound();
                  setSelectedLevel(2);
                  startGame(2);
                }}
                className="relative hover:scale-105 active:scale-95 transition-transform w-2/3 mx-auto cursor-pointer"
                style={recommendedLevel === 2 ? {
                  animation: 'buttonPulse 1.5s ease-in-out infinite'
                } : undefined}
              >
                <ImageWithFallback
                  src={levelButtonBg}
                  alt="레벨 2"
                  className="w-full h-auto object-contain"
                />
                <div className="absolute inset-0 flex flex-col items-start justify-center pl-8" style={{ fontFamily: 'OngleipRyudung', color: '#ffffff' }}>
                  <div className="text-3xl">레벨 2</div>
                  <div className="text-2xl">보통</div>
                </div>
              </button>
              
              <button
                onClick={() => {
                  playSelectSound();
                  setSelectedLevel(3);
                  startGame(3);
                }}
                className="relative hover:scale-105 active:scale-95 transition-transform w-2/3 mx-auto cursor-pointer"
                style={recommendedLevel === 3 ? {
                  animation: 'buttonPulse 1.5s ease-in-out infinite'
                } : undefined}
              >
                <ImageWithFallback
                  src={levelButtonBg}
                  alt="레벨 3"
                  className="w-full h-auto object-contain"
                />
                <div className="absolute inset-0 flex flex-col items-start justify-center pl-8" style={{ fontFamily: 'OngleipRyudung', color: '#ffffff' }}>
                  <div className="text-3xl">레벨 3</div>
                  <div className="text-2xl">빠름</div>
                </div>
              </button>
            </div>
            
            <p className="text-2xl text-gray-700 mt-4">레벨을 선택하세요</p>
            
            <GameRulesButton
              onClick={() => {
                playClickSound();
                setShowRules(true);
              }}
              backgroundColor="#4e7557"
              textColor="#ffffff"
            />
          </div>
        </div>
      )}

      {/* Game Screen */}
      {gameState === "playing" && (
        <div className="flex-1 flex flex-col relative">
          {/* 게임 안내 텍스트 */}
          <div className="text-center mb-3 flex-col justify-center flex-shrink-0" style={{ height: '5rem' }}>
            <div style={{ height: '2rem' }} className="flex items-center justify-center">
              <p className="text-gray-700 text-3xl">폭탄을 잡으세요!</p>
            </div>
          </div>
          
          <div className="flex-1 relative overflow-hidden">
            {!isPaused && bombs.map((bomb) => {
              const timeRatio = getBombTimeRatio(bomb);
              // 폭탄 크기: 시간이 지날수록 0.6배에서 1.5배로 커짐
              const scale = bomb.isExploding ? getExplosionScale(bomb) : getBombScale(bomb);
              
              // 폭탄이 생성된 지 300ms 이내일 때만 애니메이션 적용 (일시정지 시간 고려)
              const bombAge = (renderTime - totalPausedTimeRef.current) - bomb.createdAt;
              const shouldAnimate = bombAge < 300;

              return (
                <div
                  key={bomb.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${bomb.x}%`,
                    top: `${bomb.y}%`,
                    transition: bomb.isExploding ? "transform 0.5s ease-out" : "none",
                  }}
                >
                  {!bomb.isExploding ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        catchBomb(bomb.id, bomb.x, bomb.y, bomb);
                      }}
                      className="relative cursor-pointer hover:scale-110 transition-transform"
                      style={{
                        transform: `scale(${scale})`,
                        animation: shouldAnimate ? 'bombPopIn 0.3s ease-out' : 'none',
                      }}
                    >
                      <style>{`
                        @keyframes bombPopIn {
                          0% { 
                            transform: scale(0.3);
                            opacity: 0.5;
                          }
                          50% {
                            transform: scale(${scale * 1.15});
                          }
                          100% { 
                            transform: scale(${scale});
                            opacity: 1;
                          }
                        }
                      `}</style>
                      <ImageWithFallback
                        key={`bomb-${bomb.id}-${bomb.createdAt}`}
                        src={`${bombImage}?t=${bomb.createdAt}`}
                        alt="bomb"
                        style={{ width: '5rem', height: '5rem', objectFit: 'contain', pointerEvents: 'none' }}
                      />
                      
                      {/* 점수 텍스트 */}
                      {bomb.showScoreText && bomb.scoreValue && (
                        <div 
                          className="absolute pointer-events-none z-30 flex items-center gap-1"
                          style={{
                            left: '50%',
                            bottom: '100%',
                            transform: 'translateX(-50%)',
                            animation: 'floatUp 1.2s ease-out forwards',
                          }}
                        >
                          <style>{`
                            @keyframes floatUp {
                              0% { 
                                transform: translateX(-50%) translateY(0px); 
                                opacity: 1; 
                              }
                              100% { 
                                transform: translateX(-50%) translateY(-40px); 
                                opacity: 0; 
                              }
                            }
                          `}</style>
                          <span style={{
                            fontSize: '48px',
                            fontWeight: 'bold',
                            color: '#4e7557',
                            textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                          }}>
                            +{bomb.scoreValue}
                          </span>
                          <ImageWithFallback
                            src={bombScoreIcon}
                            alt="score"
                            className="w-10 h-10 object-contain"
                          />
                        </div>
                      )}
                    </button>
                  ) : (
                    <div
                      className="pointer-events-none"
                      style={{
                        transform: `scale(${scale})`,
                        opacity: getExplosionOpacity(bomb),
                      }}
                    >
                      <img
                        key={`explosion-${bomb.explosionTime}-${pauseCount}`}
                        src={`${explosionImage}?t=${bomb.explosionTime}&p=${pauseCount}`}
                        alt="explosion"
                        style={{ width: '6rem', height: '6rem', objectFit: 'contain' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* 점수 텍스트 표시 */}
            {scoreTexts.map(text => {
              // 오른쪽 끝(80% 이상)에서는 왼쪽으로 표시
              const isRightEdge = text.x > 80;
              const translateX = isRightEdge ? '-100%' : '-50%';
              
              return (
              <div
                key={text.id}
                className="absolute pointer-events-none z-30 flex items-center gap-1"
                style={{
                  left: `${text.x}%`,
                  top: `${text.y}%`,
                  transform: `translate(${translateX}, -50%) scale(${text.scale})`,
                  animation: 'floatUp 1.2s ease-out forwards',
                }}
              >
                <style>{`
                  @keyframes floatUp {
                    0% { 
                      transform: translate(${translateX}, -50%) scale(${text.scale}) translateY(0px); 
                      opacity: 1; 
                    }
                    100% { 
                      transform: translate(${translateX}, -50%) scale(${text.scale}) translateY(-40px); 
                      opacity: 0; 
                    }
                  }
                `}</style>
                <ImageWithFallback
                  src={bombScoreIcon}
                  alt="score"
                  className="w-10 h-10 object-contain"
                />
                <span style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: '#4e7557',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                }}>
                  +{text.value}
                </span>
              </div>
              );
            })}
            
            {/* 하트 감소 텍스트 표시 */}
            {heartTexts.map(text => (
              <div
                key={text.id}
                className="absolute pointer-events-none z-30 flex items-center gap-1"
                style={{
                  left: `${text.x}%`,
                  top: `${text.y}%`,
                  transform: `translate(-50%, -50%) scale(${text.scale})`,
                  animation: 'floatUpHeart 1.2s ease-out forwards',
                }}
              >
                <style>{`
                  @keyframes floatUpHeart {
                    0% { 
                      transform: translate(-50%, -50%) scale(${text.scale}) translateY(0px); 
                      opacity: 1; 
                    }
                    100% { 
                      transform: translate(-50%, -50%) scale(${text.scale}) translateY(-40px); 
                      opacity: 0; 
                    }
                  }
                `}</style>
                <Heart 
                  className="w-10 h-10"
                  style={{ fill: '#4e7557', color: '#4e7557' }}
                />
                <span style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: '#4e7557',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                }}>
                  -1
                </span>
              </div>
            ))}
          </div>
          
          {/* Pause Menu Overlay */}
          {isPaused && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
              <div 
                className="p-8 max-w-sm w-full mx-4 bg-contain bg-center bg-no-repeat animate-in zoom-in-95 duration-200"
                style={{ backgroundImage: `url(${pauseMenuBg})` }}
              >
                <h2 className="text-center mb-8 mt-4 text-4xl" style={{ color: '#eae4d3' }}>일시정지</h2>
                
                <div className="space-y-0">
                  <button
                    onClick={() => {
                      playClickSound();
                      totalPausedTimeRef.current = totalPausedTimeRef.current + (Date.now() - pauseStartTimeRef.current);
                      setPauseCount(prev => prev + 1); // 일시정지 카운터 증가
                      setIsPaused(false);
                    }}
                    className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
                  >
                    <ImageWithFallback
                      src={resumeIcon}
                      alt="resume"
                      className="h-12 w-12 object-contain"
                    />
                    <span className="text-3xl" style={{ color: '#eae4d3' }}>이어서</span>
                  </button>

                  <button
                    onClick={() => {
                      playSelectSound();
                      setIsPaused(false);
                      restart();
                    }}
                    className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
                  >
                    <ImageWithFallback
                      src={restartIcon}
                      alt="restart"
                      className="h-12 w-12 object-contain"
                    />
                    <span className="text-3xl" style={{ color: '#eae4d3' }}>처음부터</span>
                  </button>

                  <button
                    onClick={() => {
                      playBackSound();
                      setIsPaused(false);
                      onBack();
                    }}
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
      )}

      {/* Game Over Screen */}
      {gameState === "gameOver" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div 
            className="p-8 max-w-md w-full mx-4 bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${pauseMenuBg})` }}
          >
            <h2 className="text-center mb-2 mt-4 text-4xl" style={{ color: '#eae4d3' }}>게임 종료!</h2>
            <div className="text-center mb-2 text-2xl" style={{ color: '#d4c5a0' }}>
              최고 기록: {getGameRecord("bombGame")[`level${currentDifficulty}` as 'level1' | 'level2' | 'level3']}
            </div>
            <div className="text-center mb-6 text-2xl" style={{ color: '#eae4d3' }}>최종 점수: {score}</div>
            
            <div className="space-y-0">
              <button
                onClick={restart}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
              >
                <ImageWithFallback
                  src={restartIcon}
                  alt="restart"
                  className="h-12 w-12 object-contain flex-shrink-0"
                />
                <span className="text-3xl whitespace-nowrap" style={{ color: '#eae4d3' }}>처음부터</span>
              </button>

              <button
                onClick={() => {
                  playBackSound();
                  onBack();
                }}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
              >
                <ImageWithFallback
                  src={pauseExitIcon}
                  alt="exit"
                  className="h-12 w-12 object-contain flex-shrink-0"
                />
                <span className="text-3xl whitespace-nowrap" style={{ color: '#eae4d3' }}>나가기</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 게임 설명 모달 */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="폭탄 게임 설명"
        primaryColor="#4e7557"
        backgroundColor="#d4e9d8"
        scrollbarColor="#4e7557"
        scrollbarTrackColor="#d4e9d8"
        onCloseSound={playClickSound}
      >
        <RuleSection title="게임 방법" titleColor="#4e7557">
          <RuleList items={[
            "화면 곳곳에 랜덤하게 나타나는 폭탄을 선택해서 잡으세요!",
            "시간이 지나 폭탄이 터면 하트가 1개 줄어듭니다",
            "하트가 모두 사라지거나 100개의 폭탄을 잡으면 게임이 종료됩니다"
          ]} />
        </RuleSection>

        <RuleSection title="점수" titleColor="#4e7557">
          <RuleList items={[
            <><strong>레벨 1</strong>: 폭탄당 10점</>,
            <><strong>레벨 2</strong>: 폭탄당 20점</>,
            <><strong>레벨 3</strong>: 폭탄당 30점</>
          ]} />
        </RuleSection>
      </GameRulesModal>
    </div>
  );
}