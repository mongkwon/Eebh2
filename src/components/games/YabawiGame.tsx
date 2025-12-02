import { useState, useRef, useEffect } from "react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { GameRulesButton } from "../GameRulesButton";
import { GameRulesModal, RuleSection, RuleList } from "../GameRulesModal";
import { playBackSound, playClickSound, playSelectSound, playShuffleSound } from "../../utils/sound";
import { saveGameRecord, getGameRecord } from "../../utils/gameRecord";
import { Heart } from "lucide-react";
import exitIcon from "figma:asset/74b1288f91a03a19fc199ba8e3ce487eebb3c1fb.png";
import ballImage from "figma:asset/cd58ebe3b7a36a9bbf64d3324c781239846d915c.png";
import cupImage from "figma:asset/59f0329e74a07937f9c78e77b2fd1f3d1330de7c.png";
import pauseIcon from "figma:asset/8acb1e015c5c90586e07679819984941b38f74af.png";
import resumeIcon from "figma:asset/62327073bfb38b1feb704b5c6f1eb2a36789eee8.png";
import restartIcon from "figma:asset/d1a45328f3c2f5290d250ff17f71584c907a61a7.png";
import pauseMenuBg from "figma:asset/54f8a82ff3f9348da47c92cd7e8e9b17adc71522.png";
import pauseExitIcon from "figma:asset/7b6920cff9236248c28a92364a77c6df5be27012.png";
import levelButtonBg from "figma:asset/a29e3c84c9c958413e3e5b27055c8415d775b5fe.png";
import bombScoreIcon from "figma:asset/399adba23998dd03505039248a26901c996cb91f.png";
import checkIconGreen from "figma:asset/fc6012aff6e638c650bfda3422b1fa6d6fad7f6e.png";
import xIconRed from "figma:asset/6e7571d0e1cde7b66675af17f6a00a2752bfa47a.png";

interface YabawiGameProps {
  onBack: () => void;
}

type GameState = "levelSelect" | "showBall" | "coverBall" | "shuffling" | "guess" | "correct" | "wrong" | "gameOver" | "rememberBall";

interface CupData {
  id: number;
  currentIndex: number;
}

interface ScoreText {
  id: number;
  x: number;
  y: number;
  value: number;
  createdAt: number;
}

interface HeartText {
  id: number;
  x: number;
  y: number;
  createdAt: number;
}

export function YabawiGame({ onBack }: YabawiGameProps) {
  const [gameState, setGameState] = useState<GameState>("levelSelect");
  const [ballCupId, setBallCupId] = useState(0); // 공이 들어있는 컵의 ID
  const [cups, setCups] = useState<CupData[]>([]);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [problemNumber, setProblemNumber] = useState(0);
  const [selectedCupId, setSelectedCupId] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [currentDifficulty, setCurrentDifficulty] = useState(1); // 현재 난이도 관리
  const [recommendedLevel, setRecommendedLevel] = useState<number | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false); // 레벨업 메시지 표시
  const [scoreTexts, setScoreTexts] = useState<ScoreText[]>([]); // 점수 텍스트 배열
  const [heartTexts, setHeartTexts] = useState<HeartText[]>([]); // 하트 감소 텍스트 배열
  const [cupSize, setCupSize] = useState({ width: 96, height: 115 }); // 실제 컵 크기 저장
  const [containerSize, setContainerSize] = useState({ width: 672, height: 448 }); // 실제 컨테이너 크기 저장
  
  // 컵 크기 측정을 위한 ref
  const cupRef = useRef<HTMLButtonElement>(null);
  // 컨테이너 크기 측정을 위한 ref
  const containerRef = useRef<HTMLDivElement>(null);

  // 섞기 관련 ref
  const shuffleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const shuffleDataRef = useRef<{
    shuffleCount: number;
    shuffleStep: number;
    currentCups: CupData[];
    cupCount: number; // 컵 개수 추가
    problemNumber: number; // 문제 번호 추가
  } | null>(null);
  const isPausedRef = useRef(false); // isPaused 상태를 ref로 관리
  const gameTimersRef = useRef<NodeJS.Timeout[]>([]); // 모든 게임 타이머 관리
  const pausedStateRef = useRef<{
    gameState: GameState;
    remainingTime: number;
    totalTime: number;
    pausedAt: number;
    problemNumber: number; // 문제 번호 추가
    ballCupId: number; // 공 위치 추가
    cups: CupData[]; // 컵 상태 추가
  } | null>(null); // 일시정지 시 상태 저장
  const lastBallPositionRef = useRef<number | null>(null); // 이전 공의 위치 저장
  const isRestartingRef = useRef(false); // 재시작 중인지 확인하는 플래그

  // 난이도별 컵 개수
  const getCupCount = (diff?: number) => {
    const targetDifficulty = diff ?? currentDifficulty;
    switch (targetDifficulty) {
      case 1:
        return 3;
      case 2:
        return 4;
      case 3:
        return 5;
      default:
        return 3;
    }
  };

  const cupCount = getCupCount();
  const totalProblems = Infinity; // 무한 문제로 변경
  
  // 반응형 Y 포지션 계산
  const getPopupYPosition = () => {
    const width = window.innerWidth;
    if (width < 640) {
      return -35; // 모바일
    } else if (width < 768) {
      return -7; // sm
    } else {
      return -7; // md 이상
    }
  };
  
  // 반응형 간격 계산 (컨테이너 크기 기반)
  const getCupGap = () => {
    if (currentDifficulty === 1) {
      // 레벨 1: 컨테이너 너비의 15% (매우 넓게)
      return containerSize.width * 0.15;
    } else {
      // 레벨 2, 3: 컨테이너 너비의 3% (좁게)
      return containerSize.width * 0.03;
    }
  };
  
  const cupGap = getCupGap();
  const rowGap = containerSize.height * 0.11; // 컨테이너 높이의 11%

  // 라운드에 따른 섞기 속도 계산 함수 (400ms에서 시작하여 30ms씩 감소, 최소 190ms)
  const getShuffleSpeed = (currentProblemNumber: number) => {
    return Math.max(190, 400 - currentProblemNumber * 30);
  };

  // 두 줄 배치 계산
  const getRowAndCol = (index: number) => {
    const topRowCount = Math.ceil(cupCount / 2);
    if (index < topRowCount) {
      return { row: 0, col: index };
    } else {
      return { row: 1, col: index - topRowCount };
    }
  };

  const getPosition = (index: number) => {
    const { row, col } = getRowAndCol(index);
    const topRowCount = Math.ceil(cupCount / 2);
    const bottomRowCount = cupCount - topRowCount;
    
    // 각 줄의 컵 개수
    const rowCount = row === 0 ? topRowCount : bottomRowCount;
    
    // 실제 컵 크기와 간격을 픽셀로 계산
    const totalRowWidth = rowCount * cupSize.width + (rowCount - 1) * cupGap;
    
    // 줄의 시작 X 위치 (픽셀)
    const rowStartX = (containerSize.width - totalRowWidth) / 2;
    
    // 개별 컵 X 위치 (픽셀 -> 퍼센트)
    const xPx = rowStartX + col * (cupSize.width + cupGap);
    const x = (xPx / containerSize.width) * 100;
    
    // Y 위치 계산 (컨테이너 높이 aspect-[3/2] = 448px)
    const totalHeight = 2 * cupSize.height + rowGap;
    const startY = (containerSize.height - totalHeight) / 2;
    const yPx = startY + row * (cupSize.height + rowGap);
    const y = (yPx / containerSize.height) * 100;
    
    return { x, y };
  };

  // 게임 시작
  const startGame = (difficulty: number) => {
    setCurrentDifficulty(difficulty);
    startProblem(difficulty);
  };

  // 문제 시작
  const startProblem = (targetDifficulty?: number, nextProblemNumber?: number, keepBallPosition?: boolean) => {
    const diff = targetDifficulty ?? currentDifficulty;
    const count = getCupCount(diff);
    const currentProblemNum = nextProblemNumber ?? problemNumber;
    
    // 이전 섞기 데이터 완전히 초기화
    shuffleDataRef.current = null;
    
    // 의 위치 결정
    let newBallCupId: number;
    if (keepBallPosition) {
      // 공이 들어있던 컵의 최종 위치(currentIndex)를 찾음
      const ballCup = cups.find(cup => cup.id === ballCupId);
      if (ballCup) {
        // 그 위치(currentIndex)를 새 공의 위치로 사용
        // 컵을 초기화하면 id와 currentIndex가 같아지므로,
        // ballCup.currentIndex가 새로운 ballCupId가 됨
        newBallCupId = ballCup.currentIndex;
      } else {
        // 찾을 수 없으면 랜덤 (안전장치)
        newBallCupId = Math.floor(Math.random() * count);
      }
    } else {
      // 새로운 랜덤 위치
      newBallCupId = Math.floor(Math.random() * count);
    }
    setBallCupId(newBallCupId);
    
    // 컵 초기화 (id와 currentIndex가 같아짐)
    const initialCups: CupData[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      currentIndex: i,
    }));
    setCups(initialCups);
    setSelectedCupId(null);
    
    if (keepBallPosition) {
      // 공의 위치를 유지하는 경우: 바로 섞기 시작 (공 보여주기 생략)
      setGameState("coverBall");
      
      // 1초 대기 후 섞기 시작
      const timer = setTimeout(() => {
        if (isPausedRef.current) return;
        shuffleCups(initialCups, diff, currentProblemNum);
      }, 1000);
      gameTimersRef.current.push(timer);
    } else {
      // 새 게임 시작: 공 보여주기
      setGameState("coverBall");
      
      // 1초 대기 후 공 보여주기 시작
      const timer0 = setTimeout(() => {
        if (isPausedRef.current) return;
        // 공 보여주기 (1.5초)
        setGameState("showBall");
        
        const timer1 = setTimeout(() => {
          if (isPausedRef.current) return;
          setGameState("coverBall");
          
          // 1초 후 섞기 시작
          const timer2 = setTimeout(() => {
            if (isPausedRef.current) return;
            // 컵 초기화가 완료된 상태로 섞기 시작
            shuffleCups(initialCups, diff, currentProblemNum);
          }, 1000);
          gameTimersRef.current.push(timer2);
        }, 1500);
        gameTimersRef.current.push(timer1);
      }, 1000);
      gameTimersRef.current.push(timer0);
    }
  };

  //  섞기
  const shuffleCups = (initialCups: CupData[], diff: number, problemNum: number) => {
    setGameState("shuffling");
    
    // 섞기 횟수 (난이도에 따라 증가)
    const shuffleCount = 5 + diff * 2;
    
    // ref에 섞기 데이터 저장
    shuffleDataRef.current = {
      shuffleCount,
      shuffleStep: 0,
      currentCups: [...initialCups],
      cupCount: initialCups.length, // 컵 개수 추가
      problemNumber: problemNum, // 문제 번호 추가
    };

    performShuffleStep();
  };

  const performShuffleStep = () => {
    // 일시정지 상태일 때는 실행하지 않음
    if (isPausedRef.current) {
      return;
    }
    
    const data = shuffleDataRef.current;
    if (!data) return;

    if (data.shuffleStep >= data.shuffleCount) {
      // 섞기 완료
      shuffleTimerRef.current = setTimeout(() => {
        if (!isPausedRef.current) {
          setGameState("guess");
          shuffleDataRef.current = null;
        }
      }, 500);
      gameTimersRef.current.push(shuffleTimerRef.current);
      return;
    }
    
    // 랜덤하게 두 컵을 선택
    const idx1 = Math.floor(Math.random() * data.cupCount);
    let idx2 = Math.floor(Math.random() * data.cupCount);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * data.cupCount);
    }
    
    // 두 컵의 위치를 교환 (불변성 유지)
    const newCups = data.currentCups.map(cup => {
      if (cup.currentIndex === idx1) {
        return { ...cup, currentIndex: idx2 };
      } else if (cup.currentIndex === idx2) {
        return { ...cup, currentIndex: idx1 };
      }
      return cup;
    });
    
    data.currentCups = newCups;
    data.shuffleStep++;
    shuffleDataRef.current = data;
    setCups(newCups);
    
    // 점수에 따른 섞기 속도 계산
    const shuffleSpeed = getShuffleSpeed(data.problemNumber);
    
    // 컵 섞는 효과음 재생 (속도에 따라 다르게)
    playShuffleSound(shuffleSpeed);
    
    shuffleTimerRef.current = setTimeout(performShuffleStep, shuffleSpeed);
    gameTimersRef.current.push(shuffleTimerRef.current);
  };

  // 일시정지 상태 변경 감지
  useEffect(() => {
    isPausedRef.current = isPaused; // ref 업데이트
    
    if (isPaused) {
      // 일시정지: 모든 타이머 정리 및 현재 상태 저장
      if (shuffleTimerRef.current) {
        clearTimeout(shuffleTimerRef.current);
        shuffleTimerRef.current = null;
      }
      gameTimersRef.current.forEach(timer => clearTimeout(timer));
      gameTimersRef.current = [];
      
      // 현재 cups 상태를 shuffleDataRef에 저장 (일시정지 시점의 정확한 위치)
      if (shuffleDataRef.current && gameState === "shuffling") {
        shuffleDataRef.current.currentCups = [...cups];
      }
    } else if (!isPaused && !isRestartingRef.current) {
      // 재개 (재시작 중이 아닐 때만)
      if (gameState === "shuffling" && shuffleDataRef.current && !shuffleTimerRef.current) {
        // 섞기 재시작: 저장된 상태로 복원하고 다음 섞기 단계로 진행
        // transition 시간(500ms)을 보장하기 위해 500ms 대기 후 다음 스텝 진행
        const timer = setTimeout(() => {
          performShuffleStep();
        }, 500);
        gameTimersRef.current.push(timer);
      } else if (gameState === "correct") {
        // 정답 상태에서 재개: 즉시 다음 단계로
        setGameState("coverBall");
        const timer = setTimeout(() => {
          const nextProblem = problemNumber + 1;
          if (nextProblem >= totalProblems) {
            setGameState("gameOver");
          } else {
            setProblemNumber(nextProblem);
            startProblem(undefined, nextProblem, true); // keepBallPosition: true 추가
          }
        }, 500);
        gameTimersRef.current.push(timer);
      } else if (gameState === "wrong") {
        // 오답 상태에서 재개: 즉시 다음 단계로
        setGameState("coverBall");
        const timer = setTimeout(() => {
          if (hearts <= 0) {
            setGameState("gameOver");
          } else {
            startProblem(undefined, problemNumber, true); // keepBallPosition: true 추가
          }
        }, 500);
        gameTimersRef.current.push(timer);
      } else if (gameState === "showBall") {
        // 공 보여주기 상태에서 재개: 즉시 다음 단계로
        setGameState("coverBall");
        const timer = setTimeout(() => {
          shuffleCups(cups, currentDifficulty, problemNumber);
        }, 1000);
        gameTimersRef.current.push(timer);
      } else if (gameState === "coverBall") {
        // 덮기 상태에서 재개: 즉시 섞기 시작
        const timer = setTimeout(() => {
          shuffleCups(cups, currentDifficulty, problemNumber);
        }, 100);
        gameTimersRef.current.push(timer);
      } else if (gameState === "rememberBall") {
        // 공의 위치를 기억하세요 상에서 재개: 즉시 다음 단계로
        setGameState("coverBall");
        const timer = setTimeout(() => {
          const nextProblem = problemNumber + 1;
          const totalProblems = 30; // 총 문제 수
          
          if (nextProblem >= totalProblems) {
            setGameState("gameOver");
          } else {
            setProblemNumber(nextProblem);
            startProblem(undefined, nextProblem);
          }
        }, 500);
        gameTimersRef.current.push(timer);
      }
    }
  }, [isPaused]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current) {
        clearTimeout(shuffleTimerRef.current);
      }
      gameTimersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // 컵 선택
  const selectCup = (cupId: number) => {
    if (gameState !== "guess") return;
    
    setSelectedCupId(cupId);
    
    // 0.1초 후 선택 표시 제거 (커졌다가 작아지는 효과)
    setTimeout(() => {
      setSelectedCupId(null);
    }, 100);
    
    // 클릭한 컵의 위치 가져오기
    const cupElement = document.getElementById(`cup-${cupId}`);
    let popupX = window.innerWidth / 2;
    let scorePopupY = window.innerHeight / 2;
    let heartPopupY = window.innerHeight / 2;
    
    if (cupElement) {
      const rect = cupElement.getBoundingClientRect();
      popupX = rect.left + rect.width / 2;
      scorePopupY = rect.top - 80; // 컵 위쪽에 표시 (정답)
      heartPopupY = rect.top - 20; // 컵 가까이 표시 (오답)
    }
    
    // 정 확인
    if (cupId === ballCupId) {
      // 정답
      playSelectSound();
      setGameState("correct");
      
      // 레벨별 점수 차등: 레벨 1은 10점, 레벨 2는 20점, 레벨 3은 30점
      const pointsPerCorrect = currentDifficulty * 10;
      setScore(score + pointsPerCorrect);
      
      // 점수 텍스트 추가
      const newScoreTexts: ScoreText[] = [
        ...scoreTexts,
        {
          id: Date.now(),
          x: popupX,
          y: scorePopupY,
          value: pointsPerCorrect,
          createdAt: Date.now(),
        },
      ];
      setScoreTexts(newScoreTexts);
      
      // 2 후 점수 텍스트 제거
      setTimeout(() => {
        setScoreTexts(prev => prev.filter(text => text.id !== newScoreTexts[newScoreTexts.length - 1].id));
      }, 2000);
      
      // 1.8초 후 컵을 내리고 다음 문제로 (맞았습니다 메시지를 충분히 보여줌)
      const timer1 = setTimeout(() => {
        if (isPausedRef.current) return;
        setGameState("coverBall");
        
        const timer2 = setTimeout(() => {
          if (isPausedRef.current) return;
          const nextProblem = problemNumber + 1;
          
          if (nextProblem >= totalProblems) {
            setGameState("gameOver");
          } else {
            setProblemNumber(nextProblem);
            startProblem(undefined, nextProblem, true);
          }
        }, 500);
        gameTimersRef.current.push(timer2);
      }, 1800);
      gameTimersRef.current.push(timer1);
    } else {
      // 오답
      playClickSound();
      setGameState("wrong");
      const newHearts = hearts - 1;
      setHearts(newHearts);
      
      // 하트 감소 텍스트 추가
      const newHeartTexts: HeartText[] = [
        ...heartTexts,
        {
          id: Date.now(),
          x: popupX,
          y: heartPopupY,
          createdAt: Date.now(),
        },
      ];
      setHeartTexts(newHeartTexts);
      
      // 2초 후 하트 감소 텍스트 제거
      setTimeout(() => {
        setHeartTexts(prev => prev.filter(text => text.id !== newHeartTexts[newHeartTexts.length - 1].id));
      }, 2000);
      
      // 1.8초 후 컵을 내리고 다음 문제로 (틀렸습니다 메시지를 충분히 보여줌)
      const timer1 = setTimeout(() => {
        if (isPausedRef.current) return;
        setGameState("coverBall");
        
        const timer2 = setTimeout(() => {
          if (isPausedRef.current) return;
          if (newHearts <= 0) {
            setGameState("gameOver");
          } else {
            startProblem(undefined, problemNumber, true);
          }
        }, 500);
        gameTimersRef.current.push(timer2);
      }, 1800);
      gameTimersRef.current.push(timer1);
    }
  };

  // 재시작
  const restart = () => {
    playSelectSound();
    
    // ref 먼저 업데이트 (useEffect 실행 전)
    isPausedRef.current = false;
    isRestartingRef.current = true;
    
    // 모든 타이머 정리
    if (shuffleTimerRef.current) {
      clearTimeout(shuffleTimerRef.current);
      shuffleTimerRef.current = null;
    }
    gameTimersRef.current.forEach(timer => clearTimeout(timer));
    gameTimersRef.current = [];
    
    // 섞기 데이터 초기화
    shuffleDataRef.current = null;
    
    // 상태 초기화 (batch update)
    setIsPaused(false);
    setHearts(3);
    setScore(0);
    setProblemNumber(0);
    setScoreTexts([]);
    setHeartTexts([]);
    setGameState("coverBall");
    
    // 다음 프레임에서 새 게임 시작 (모든 상태 업데이트 후)
    setTimeout(() => {
      startProblem(currentDifficulty, 0);
      isRestartingRef.current = false;
    }, 0);
  };

  // 컵을 인덱스 순서대로 정렬
  const sortedCups = [...cups].sort((a, b) => a.currentIndex - b.currentIndex);

  // 컵 크기 측정
  useEffect(() => {
    if (cupRef.current) {
      const rect = cupRef.current.getBoundingClientRect();
      setCupSize({ width: rect.width, height: rect.height });
    }
  }, [cups]);

  // 컨테이너 크기 측정
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    }
  }, [cups]);

  // 게임 오버 시 기록 저장
  useEffect(() => {
    if (gameState === "gameOver" && score > 0) {
      saveGameRecord("yabawiGame", score, currentDifficulty);
    }
  }, [gameState, score, currentDifficulty]);

  // 컴포넌트 마운트 시 추천 레벨 계산
  useEffect(() => {
    const records = getGameRecord("yabawiGame");
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

  return (
    <div className="h-screen overflow-hidden bg-amber-50 p-4 flex flex-col pt-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center">
          {gameState === "levelSelect" || gameState === "gameOver" ? (
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
          ) : (
            <button
              onClick={() => {
                playClickSound();
                setIsPaused(true);
              }}
              className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer"
            >
              <ImageWithFallback
                src={pauseIcon}
                alt="pause"
                className="h-10 w-10 object-contain"
              />
            </button>
          )}
          {(gameState === "levelSelect" || gameState === "gameOver") && (
            <h1 className="text-gray-700 ml-4 text-4xl" style={{ fontFamily: 'OngleipRyudung' }}>
              셔플 게임
            </h1>
          )}
        </div>
        
        {/* Playing 일 때 하와 점수 표시 */}
        {gameState !== "levelSelect" && gameState !== "gameOver" && (
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
        )}
        
        {gameState === "levelSelect" || gameState === "gameOver" ? (
          <div className="w-12" />
        ) : null}
      </div>

      {/* Level Select Screen */}
      {gameState === "levelSelect" && (
        <>
          {/* 게임 설명 */}
          <p className="text-2xl text-gray-700 text-center mb-4">
            공이 어느 컵 아래에 있는지 찾으세요!<br />
            공이 있는 컵을 찾지 못하면 하트를 잃습니다.
          </p>

          {/* Difficulty Selection */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative flex flex-col items-center justify-center">
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button
                  onClick={() => {
                    playSelectSound();
                    setCurrentDifficulty(1);
                    startGame(1);
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
                    <div className="text-2xl">3개의 컵</div>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    playSelectSound();
                    setCurrentDifficulty(2);
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
                    <div className="text-2xl">4개의 컵</div>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    playSelectSound();
                    setCurrentDifficulty(3);
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
                    <div className="text-2xl">5개의 컵</div>
                  </div>
                </button>
              </div>
              
              <p className="text-2xl md:text-3xl text-gray-700 mt-4">레벨을 선택하세요</p>
              
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
        </>
      )}

      {/* Game Screen */}
      {(gameState === "showBall" || gameState === "coverBall" || gameState === "shuffling" || gameState === "guess" || gameState === "correct" || gameState === "wrong" || gameState === "rememberBall") && (
        <div className="flex-1 flex flex-col">
          {/* Score and Progress - 고정 높이 */}
          <div className="text-center mb-6 flex flex-col justify-center flex-shrink-0" style={{ minHeight: '7.5rem' }}>
            <div className="flex flex-col items-center justify-center gap-2">
              {gameState === "showBall" && (
                <p className="text-gray-700 text-3xl">공의 위치를 기억하세요!</p>
              )}
              {gameState === "shuffling" && (
                <p className="text-gray-700 text-3xl">컵을 섞고 있습니다...</p>
              )}
              {gameState === "guess" && (
                <p className="text-gray-700 text-3xl">공이 어느 컵 아래에 있을까요?</p>
              )}
              {gameState === "correct" && (
                <>
                  <div 
                    key={Date.now()}
                    className="text-[40px] flex items-center justify-center gap-2" 
                    style={{ 
                      color: '#4e7557', 
                      fontFamily: 'OngleipRyudung',
                      animation: 'bounceInOutYabawi 1.7s ease-out'
                    }}
                  >
                    맞았습니다!
                    <ImageWithFallback 
                      src={checkIconGreen} 
                      alt="체크" 
                      style={{ width: "1.875rem", height: "1.875rem", objectFit: "contain" }}
                    />
                  </div>
                  <p className="text-gray-700 text-3xl">공의 위치를 기억하세요!</p>
                </>
              )}
              {gameState === "wrong" && (
                <>
                  <div 
                    key={Date.now()}
                    className="text-[40px] flex items-center justify-center gap-2" 
                    style={{ 
                      color: '#dc2626', 
                      fontFamily: 'OngleipRyudung',
                      animation: 'shakeXYabawi 0.5s ease-out'
                    }}
                  >
                    틀렸습니다!
                    <ImageWithFallback 
                      src={xIconRed} 
                      alt="엑스" 
                      style={{ width: "1.875rem", height: "1.875rem", objectFit: "contain" }}
                    />
                  </div>
                  <p className="text-gray-700 text-3xl">공의 위치를 기억하세요!</p>
                </>
              )}
              {gameState === "rememberBall" && (
                <p className="text-gray-700 text-3xl">공의 위치를 기억하세요!</p>
              )}
            </div>
          </div>

          {/* Game Area - absolute positioning으로 중앙 정렬 */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className="relative max-w-2xl w-full aspect-[3/2] mx-auto" ref={containerRef}>
              {cups.map((cup) => {
                const { x, y } = getPosition(cup.currentIndex);
                const shuffleSpeed = getShuffleSpeed(problemNumber);
                const transitionDuration = `${shuffleSpeed}ms`;
                
                return (
                  <div
                    key={cup.id}
                    className="absolute"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transition: gameState === "shuffling" ? `all ${transitionDuration} ease-in-out` : "none",
                    }}
                  >
                    {/* Ball (show when state is showBall, rememberBall, or when showing answer) */}
                    {(gameState === "showBall" || gameState === "coverBall" || gameState === "correct" || gameState === "wrong" || gameState === "rememberBall") && cup.id === ballCupId && (
                      <div className="absolute left-1/2 transform -translate-x-1/2 z-0" style={{ bottom: '0.5rem', width: '4.6875rem', aspectRatio: '1' }}>
                        {/* 공 이미지 - 튕기는 애니메이션 */}
                        <div className="relative w-full h-full" style={{
                          animation: (gameState === "showBall" || gameState === "correct" || gameState === "wrong" || gameState === "rememberBall") 
                            ? "bounce 0.5s ease-in-out infinite" 
                            : "none"
                        }}>
                          <ImageWithFallback
                            src={ballImage}
                            alt="ball"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        
                        <style>{`
                          @keyframes bounce {
                            0%, 100% {
                              transform: translateY(0);
                            }
                            50% {
                              transform: translateY(-10px);
                            }
                          }
                        `}</style>
                      </div>
                    )}
                    
                    {/* Cup */}
                    <button
                      id={`cup-${cup.id}`}
                      ref={cup.id === 0 ? cupRef : undefined}
                      onClick={() => selectCup(cup.id)}
                      disabled={gameState !== "guess"}
                      className={`relative z-10 ${
                        gameState === "guess" ? "cursor-pointer hover:scale-110" : ""
                      } ${
                        selectedCupId === cup.id ? "scale-110" : ""
                      }`}
                      style={{
                        width: '7rem',
                        aspectRatio: '5/6',
                        transition: "transform 0.3s ease-in-out",
                        transform: ((gameState === "showBall" || gameState === "correct" || gameState === "wrong" || gameState === "rememberBall") && cup.id === ballCupId)
                          ? `translateY(-5rem) ${selectedCupId === cup.id ? "scale(1.1)" : ""}` 
                          : selectedCupId === cup.id ? "scale(1.1)" : "",
                      }}
                    >
                      <ImageWithFallback
                        src={cupImage}
                        alt="cup"
                        className="w-full h-full object-contain"
                      />
                      
                      {/* Selection indicator */}
                      {gameState === "guess" && selectedCupId === cup.id && (
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
                      )}
                    </button>
                  </div>
                );
              })}
              
              {/* 점수 텍스트 표시 */}
              {scoreTexts.map(text => (
                <div
                  key={text.id}
                  className="fixed pointer-events-none z-30 flex items-center gap-1"
                  style={{
                    left: `${text.x}px`,
                    top: `${text.y}px`,
                    transform: 'translate(-50%, -50%)',
                    animation: 'scorePopup 1.5s ease-out forwards',
                  }}
                >
                  <style>{`
                    @keyframes scorePopup {
                      0% { 
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.5);
                      }
                      20% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1.1);
                      }
                      30% {
                        transform: translate(-50%, -50%) scale(1);
                      }
                      70% {
                        opacity: 1;
                        transform: translate(-50%, -70px) scale(1);
                      }
                      100% { 
                        opacity: 0;
                        transform: translate(-50%, -90px) scale(0.8);
                      }
                    }
                  `}</style>
                  <ImageWithFallback
                    src={bombScoreIcon}
                    alt="score"
                    className="w-8 h-8 object-contain"
                  />
                  <span style={{
                    fontSize: '36px',
                    fontWeight: 'bold',
                    color: '#4e7557',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    +{text.value}
                  </span>
                </div>
              ))}
              
              {/* 하트 감소 텍스트 표시 */}
              {heartTexts.map(text => (
                <div
                  key={text.id}
                  className="fixed pointer-events-none z-30 flex items-center gap-1"
                  style={{
                    left: `${text.x}px`,
                    top: `${text.y}px`,
                    transform: 'translate(-50%, -50%)',
                    animation: 'heartPopup 1.5s ease-out forwards',
                  }}
                >
                  <style>{`
                    @keyframes heartPopup {
                      0% { 
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.5);
                      }
                      20% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1.1);
                      }
                      30% {
                        transform: translate(-50%, -50%) scale(1);
                      }
                      70% {
                        opacity: 1;
                        transform: translate(-50%, -70px) scale(1);
                      }
                      100% { 
                        opacity: 0;
                        transform: translate(-50%, -90px) scale(0.8);
                      }
                    }
                  `}</style>
                  <Heart
                    className="w-8 h-8"
                    style={{ fill: '#4e7557', color: '#4e7557' }}
                  />
                  <span style={{
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: '#4e7557',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    -1
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === "gameOver" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div 
            className="p-8 max-w-sm w-full mx-4 bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${pauseMenuBg})` }}
          >
            <h2 className="text-center mb-2 mt-4 text-4xl" style={{ color: '#eae4d3' }}>게임 종료!</h2>
            <div className="text-center mb-2 text-2xl" style={{ color: '#d4c5a0' }}>
              최고 기록: {getGameRecord("yabawiGame")[`level${currentDifficulty}` as 'level1' | 'level2' | 'level3']}
            </div>
            <div className="text-center mb-6 text-2xl" style={{ color: '#eae4d3' }}>
              최종 점수: {score}
              {hearts > 0 && (
                <div className="mt-2">모든 문제를 완료했습니다! 🎉</div>
              )}
              {hearts === 0 && (
                <div className="mt-2">하트를 모두 소진했습니다.</div>
              )}
            </div>
            
            <div className="space-y-0">
              <button
                onClick={restart}
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

      {/* Pause Dialog */}
      {isPaused && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div 
            className="p-8 max-w-sm w-full mx-4 bg-contain bg-center bg-no-repeat animate-in zoom-in-95 duration-200"
            style={{ backgroundImage: `url(${pauseMenuBg})` }}
          >
            <h2 className="text-center mb-6 mt-4 text-4xl" style={{ fontFamily: 'OngleipRyudung', color: '#eae4d3' }}>일시정지</h2>
            
            <div className="space-y-0" style={{ fontFamily: 'OngleipRyudung' }}>
              {/* 이어서 버튼 */}
              <button
                onClick={() => {
                  playSelectSound();
                  setIsPaused(false);
                }}
                className="w-full bg-transparent py-2 px-6 transition-all duration-200 flex items-center justify-center gap-3 hover:scale-110"
              >
                <ImageWithFallback
                  src={resumeIcon}
                  alt="resume"
                  className="h-12 w-12 object-contain"
                />
                <span className="text-3xl" style={{ color: '#eae4d3' }}>이어서</span>
              </button>

              {/* 처음부터 버튼 */}
              <button
                onClick={() => {
                  restart();
                }}
                className="w-full bg-transparent py-2 px-6 transition-all duration-200 flex items-center justify-center gap-3 hover:scale-110"
              >
                <ImageWithFallback
                  src={restartIcon}
                  alt="restart"
                  className="h-12 w-12 object-contain"
                />
                <span className="text-3xl" style={{ color: '#eae4d3' }}>처음부터</span>
              </button>

              {/* 나가기 버튼 */}
              <button
                onClick={() => {
                  playBackSound();
                  onBack();
                }}
                className="w-full bg-transparent py-2 px-6 transition-all duration-200 flex items-center justify-center gap-3 hover:scale-110"
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

      {/* Level Up Screen */}
      {showLevelUp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-12 max-w-md w-full mx-4 text-center animate-in zoom-in-95 duration-200">
            <h2 className="text-gray-700 mb-4 text-5xl">🎉</h2>
            <p className="text-gray-700 mb-2 text-3xl">모든 문제를 완료했습니다!</p>
            <p className="text-gray-600 text-2xl">난이도 {currentDifficulty + 1}로 이동합니다...</p>
          </div>
        </div>
      )}
      
      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes bounceInOutYabawi {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          20% {
            opacity: 1;
            transform: scale(1.1);
          }
          30%, 100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes shakeXYabawi {
          0%, 100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-8px);
          }
          75% {
            transform: translateX(8px);
          }
        }
        
        @keyframes buttonPulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
      `}</style>
      
      {/* 게임 설명 모달 */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="셔플 게임 설명"
        primaryColor="#4e7557"
        backgroundColor="#d4e9d8"
        scrollbarColor="#4e7557"
        scrollbarTrackColor="#d4e9d8"
        onCloseSound={playClickSound}
      >
        <RuleSection title="게임 방법" titleColor="#4e7557">
          <p className="mb-4">컵이 섞이는 동안 공의 위치를 추적하여 공이 들어있는 컵을 찾으세요!</p>
          <RuleList items={[
            "게임이 시작되면 공이 어느 컵 아래에 있는지 보여줍니.",
            "섞는 동안 공이 있는 컵을 잘 따라갑니다.",
            "섞기가 끝나면 공이 들어있다고 생각하는 컵을 선택하세요.",
            "잘못된 컵을 선택하면 하트가 1개 줄어듭니다",
            "하트가 모두 사라지거나 100문제를 완료하면 게임이 종료됩니다"
          ]} />
        </RuleSection>

        <RuleSection title="점수" titleColor="#4e7557">
          <RuleList items={[
            <><strong>레벨 1</strong>: 정답당 10점</>,
            <><strong>레벨 2</strong>: 정답당 20점</>,
            <><strong>레벨 3</strong>: 정답당 30점</>
          ]} />
        </RuleSection>
      </GameRulesModal>
    </div>
  );
}