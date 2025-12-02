import { useState, useEffect, useRef } from "react";
import { Heart, X } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { GameRulesButton } from "../GameRulesButton";
import { GameRulesModal, RuleSection, RuleList } from "../GameRulesModal";
import { playBackSound, playClickSound, playSelectSound } from "../../utils/sound";
import { saveGameRecord, getGameRecord } from "../../utils/gameRecord";
import cardBack from "figma:asset/07f6ca6f678c55dd4b1bdc34f823c55f79048c6f.png";
import pauseIcon from "figma:asset/8acb1e015c5c90586e07679819984941b38f74af.png";
import resumeIcon from "figma:asset/62327073bfb38b1feb704b5c6f1eb2a36789eee8.png";
import restartIcon from "figma:asset/d1a45328f3c2f5290d250ff17f71584c907a61a7.png";
import exitIcon from "figma:asset/74b1288f91a03a19fc199ba8e3ce487eebb3c1fb.png";
import pauseMenuBg from "figma:asset/54f8a82ff3f9348da47c92cd7e8e9b17adc71522.png";
import pauseExitIcon from "figma:asset/7b6920cff9236248c28a92364a77c6df5be27012.png";
import levelButtonBg from "figma:asset/5d455998023ef79fbbf223eaf0a0e503e73de2f2.png";
import starIcon from "figma:asset/536422266eac9485f74fff9de4a5153de25a14b7.png";
import checkIconGray from "figma:asset/2481c41f3b40adb897713a482226b3b07f990883.png";
import xIconRed from "figma:asset/6e7571d0e1cde7b66675af17f6a00a2752bfa47a.png";

// 카드 앞면 이미지들
import card1 from "figma:asset/8673ea1845ffecdef52006863288162b2f671b1a.png"; // 레몬
import card2 from "figma:asset/c2380a23830c5768c397cc2cc8d0e9fe8e4534dd.png"; // 사과
import card3 from "figma:asset/a34a7b28cda78778b3b00ea43e25524690c5e6d6.png"; // 바나나
import card4 from "figma:asset/f4c46dc415e0a212c31bea1da1949af8150fdb20.png"; // 키위
import card5 from "figma:asset/3a70aa5cb7899acdb2d5204a5c5a6b752a728b5f.png"; // 포도
import card6 from "figma:asset/a2252d94b5eff0ee53eb257810eedd0c73e67c8f.png"; // 수박
import card7 from "figma:asset/f20d676b606c7411512a30c8f04b544116334687.png"; // 딸기
import card8 from "figma:asset/edf8d2358a4479d0fd4ab731266914d9f1e4a599.png"; // 배
import card9 from "figma:asset/e25652d2d2c3d0eac0aa267916c400cab6fc127a.png"; // 체리
import card10 from "figma:asset/6b31a972dc9f5d84530a111d9cc4949126fc9233.png"; // 보라색 과일
import card11 from "figma:asset/c8a582c317c75c7a3aa96fe16aeb79dacd9a232e.png"; // 오렌지
import card12 from "figma:asset/b829233658bbfb44fbfca4cad104e0968933ee7d.png"; // 파인애플

interface MemoryGameProps {
  onBack: () => void;
}

type GameState = "ready" | "memorizing" | "playing" | "checking" | "correct" | "wrong" | "roundComplete" | "gameOver";

interface Card {
  id: number;
  pairId: number;
  isFlipped: boolean;
  isMatched: boolean;
  imageIndex: number;
}

export function MemoryGame({ onBack }: MemoryGameProps) {
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [gameState, setGameState] = useState<GameState>("ready");
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [round, setRound] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [recommendedLevel, setRecommendedLevel] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const isPausedRef = useRef(false);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [savedGameState, setSavedGameState] = useState<{
    score: number;
    hearts: number;
    round: number;
    level: number;
  } | null>(null);
  const memorizingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [heartLostInRound, setHeartLostInRound] = useState(false);
  const [currentCardIndices, setCurrentCardIndices] = useState<number[]>([]);
  const [scorePopups, setScorePopups] = useState<Array<{ id: number; points: number; x: number; y: number }>>([]);
  const scorePopupIdRef = useRef(0);
  const [heartPopups, setHeartPopups] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const heartPopupIdRef = useRef(0);

  const cardImages = [
    card1, card2, card3, card4, card5, card6,
    card7, card8, card9, card10, card11, card12,
  ];

  const getCardCount = () => {
    if (currentLevel === 1) return 8;
    if (currentLevel === 2) return 12;
    return 16;
  };

  const getPointsPerMatch = () => {
    return currentLevel * 10;
  };

  const getMaxRounds = () => {
    return Infinity; // 모든 레벨 무한 라운드
  };

  const startGame = (level: number) => {
    setScore(0);
    setHearts(3);
    setRound(0);
    setCurrentLevel(level);
    startRound(0, level);
  };

  const startRound = (roundNumber: number = round, level: number = currentLevel) => {
    const cardCount = level === 1 ? 8 : level === 2 ? 12 : 16;
    const pairCount = cardCount / 2;
    
    let selectedIndices: number[];
    
    // 하트를 잃었으면 같은 카드 사용, 잃지 않았으면 새로운 랜덤 카드
    if (heartLostInRound && currentCardIndices.length === pairCount) {
      selectedIndices = [...currentCardIndices];
    } else {
      const availableIndices = Array.from({ length: cardImages.length }, (_, i) => i);
      selectedIndices = [];
      
      for (let i = 0; i < pairCount; i++) {
        const randomIndex = Math.floor(Math.random() * availableIndices.length);
        selectedIndices.push(availableIndices[randomIndex]);
        availableIndices.splice(randomIndex, 1);
      }
      
      setCurrentCardIndices(selectedIndices);
    }
    
    // 라운드 시작 시 하트 손실 플래그 초기화
    setHeartLostInRound(false);
    
    const newCards: Card[] = [];
    for (let i = 0; i < pairCount; i++) {
      newCards.push(
        { id: i * 2, pairId: i, isFlipped: false, isMatched: false, imageIndex: selectedIndices[i] },
        { id: i * 2 + 1, pairId: i, isFlipped: false, isMatched: false, imageIndex: selectedIndices[i] }
      );
    }
    
    for (let i = newCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
    }
    
    newCards.forEach((card, index) => {
      card.id = index;
    });
    
    setCards(newCards);
    setFlippedCards([]);
    setMatchedPairs(0);
    setGameState("memorizing");
  };

  const handleCardClick = (cardId: number) => {
    if (gameState !== "playing") return;
    if (flippedCards.length >= 2) return;
    if (flippedCards.includes(cardId)) return;
    if (cards[cardId].isMatched) return;
    
    playClickSound();
    
    const newFlippedCards = [...flippedCards, cardId];
    setFlippedCards(newFlippedCards);
    
    setCards(prev => prev.map(card => 
      card.id === cardId ? { ...card, isFlipped: false } : card
    ));
    
    if (newFlippedCards.length === 2) {
      setGameState("checking");
      const [firstId, secondId] = newFlippedCards;
      const firstCard = cards[firstId];
      const secondCard = cards[secondId];
      
      if (firstCard.pairId === secondCard.pairId) {
        playSelectSound();
        setGameState("correct");
        setCards(prev => prev.map(card => 
          card.id === firstId || card.id === secondId 
            ? { ...card, isMatched: true, isFlipped: false } 
            : card
        ));
        setFlippedCards([]);
        setMatchedPairs(prev => prev + 1);
        setScore(prev => prev + getPointsPerMatch());
        
        // 점수 팝업 추가
        const cardElement = document.getElementById(`card-${cardId}`);
        if (cardElement) {
          const rect = cardElement.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          setScorePopups(prev => [...prev, { id: scorePopupIdRef.current++, points: getPointsPerMatch(), x, y }]);
        }
        
        setTimeout(() => {
          const totalPairs = getCardCount() / 2;
          if (matchedPairs + 1 >= totalPairs) {
            const maxRounds = getMaxRounds();
            if (round + 1 >= maxRounds && maxRounds !== Infinity) {
              setGameState("gameOver");
            } else {
              // 모든 카드를 뒷면으로 뒤집기
              setCards(prev => prev.map(card => ({ ...card, isFlipped: true })));
              
              setTimeout(() => {
                if (!isPausedRef.current) {
                  setRound(prev => prev + 1);
                  // 새 라운드 시작 (카드 뒷면 -> 앞면으로 전환됨)
                  startRound(round + 1, currentLevel);
                }
              }, 1200);
            }
          } else {
            setGameState("playing");
          }
        }, 1700);
      } else {
        // 하트 팝업 즉시 추가
        const cardElement = document.getElementById(`card-${cardId}`);
        if (cardElement) {
          const rect = cardElement.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          setHeartPopups(prev => [...prev, { id: heartPopupIdRef.current++, x, y }]);
        }
        
        // 하트 감소 효과음 재생
        playBackSound();
        setGameState("wrong");
        
        setTimeout(() => {
          setCards(prev => prev.map(card => 
            card.id === firstId || card.id === secondId 
              ? { ...card, isFlipped: true } 
              : card
          ));
          setFlippedCards([]);
          setHeartLostInRound(true);
          setHearts(prev => {
            const newHearts = prev - 1;
            if (newHearts <= 0) {
              setGameState("gameOver");
            } else {
              setGameState("playing");
            }
            return newHearts;
          });
        }, 1200);
      }
    }
  };

  const togglePause = () => {
    playClickSound();
    if (gameState === "ready" || gameState === "gameOver") return;
    
    if (!isPaused) {
      setSavedGameState({
        score,
        hearts,
        round,
        level: currentLevel,
      });
      setIsPaused(true);
      isPausedRef.current = true;
    } else {
      setIsPaused(false);
      isPausedRef.current = false;
    }
  };

  const handleResume = () => {
    playClickSound();
    setIsClosing(true);
    
    // 애니메이션 후 닫기
    setTimeout(() => {
      setIsPaused(false);
      isPausedRef.current = false;
      setIsClosing(false);
    }, 200);
  };

  const handleRestart = () => {
    playClickSound();
    setIsPaused(false);
    isPausedRef.current = false;
    setSavedGameState(null);
    
    // 먼저 모든 카드를 뒷면으로 뒤집기
    setCards(prev => prev.map(card => ({ ...card, isFlipped: true })));
    
    // 현재 레벨을 처음부터 다시 시작
    setTimeout(() => {
      setScore(0);
      setHearts(3);
      setRound(0);
      startRound(0, currentLevel);
    }, 800);
  };

  const handleExit = () => {
    playBackSound();
    onBack();
  };

  const handleStartPlaying = () => {
    playClickSound();
    setCards(prev => prev.map(card => ({ ...card, isFlipped: true })));
    setGameState("playing");
  };

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // 게임 오버 시 기록 저장
  useEffect(() => {
    if (gameState === "gameOver") {
      saveGameRecord("memoryGame", score, currentLevel);
    }
  }, [gameState, score, currentLevel]);

  // 컴포넌트 마운트 시 추천 레벨 계산
  useEffect(() => {
    const records = getGameRecord("memoryGame");
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

  const gridCols = currentLevel === 1 ? 4 : currentLevel === 2 ? 4 : 4;

  return (
    <div className="h-screen overflow-hidden bg-amber-50 p-4 flex flex-col pt-16">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        {gameState === "ready" && (
          <div className="flex items-center">
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
            <h2 className="text-4xl ml-4" style={{ color: '#4a4a4a' }}>카드 게임</h2>
          </div>
        )}
        {gameState === "gameOver" && (
          <div className="w-12" />
        )}
        
        {gameState !== "ready" && (
          <>
            {gameState !== "gameOver" && !isPaused && (
              <button
                onClick={togglePause}
                className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer"
              >
                <ImageWithFallback
                  src={pauseIcon}
                  alt="일시정지"
                  style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain' }}
                />
              </button>
            )}
            {(gameState === "gameOver" || isPaused) && (
              <div className="w-12" />
            )}
            
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

      {gameState === "ready" && (
        <div className="pl-14 mb-4 flex-shrink-0">
          <p className="text-2xl text-center" style={{ color: '#4a4a4a', marginLeft: '-45px' }}>
            같은 그림의 카드를 찾아 짝을 맞추세요!<br />
            잘못된 짝을 선택하면 하트를 잃습니다.
          </p>
        </div>
      )}

      {gameState === "ready" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative flex flex-col items-center justify-center">
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                onClick={() => {
                  playSelectSound();
                  setSelectedLevel(1);
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
                  <div className="text-2xl">8개 카드</div>
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
                  <div className="text-2xl">12개 카드</div>
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
                  <div className="text-2xl">16개 카드</div>
                </div>
              </button>
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
      )}

      {gameState !== "ready" && gameState !== "gameOver" && (
        <div className="flex-1 flex flex-col items-center justify-center">
          
          {/* 상태 메시지 영역 - 고정 높이 */}
          <div className="mb-4 h-8 flex items-center justify-center">
            {gameState === "memorizing" && (
              <div className="text-3xl animate-pulse" style={{ color: '#a7b7c4' }}>
                카드를 기억하세요!
              </div>
            )}
            {gameState === "correct" && (
              <div 
                className="text-[40px] flex items-center justify-center gap-2" 
                style={{ 
                  color: '#a7b7c4', 
                  fontFamily: 'OngleipRyudung',
                  animation: 'bounceInOut 1.7s ease-out'
                }}
              >
                맞았습니다!
                <ImageWithFallback 
                  src={checkIconGray} 
                  alt="체크" 
                  style={{ width: "1.875rem", height: "1.875rem", objectFit: "contain" }}
                />
              </div>
            )}
            {gameState === "wrong" && (
              <div 
                className="text-[40px] flex items-center justify-center gap-2" 
                style={{ 
                  color: '#cd6c58', 
                  fontFamily: 'OngleipRyudung',
                  animation: 'shakeX 0.5s ease-out'
                }}
              >
                틀렸습니다!
                <ImageWithFallback 
                  src={xIconRed} 
                  alt="엑스" 
                  style={{ width: "1.875rem", height: "1.875rem", objectFit: "contain" }}
                />
              </div>
            )}
          </div>
          
          <style>{`
            @keyframes bounceInOut {
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
            
            @keyframes shakeX {
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

          <div
            className="grid gap-3 w-full px-4"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              maxWidth: "25rem",
            }}
          >
            {cards.map((card) => (
              <div
                key={card.id}
                id={`card-${card.id}`}
                className={`aspect-square rounded-lg ${gameState === "playing" && !card.isMatched ? "cursor-pointer" : ""}`}
                onClick={() => handleCardClick(card.id)}
                style={{ perspective: "1000px" }}
              >
                <div
                  className={`relative w-full h-full transition-transform`}
                  style={{
                    transformStyle: "preserve-3d",
                    transform: card.isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    transitionDuration: "0.6s",
                  }}
                >
                  {/* 카드 앞면 (과일) */}
                  <div
                    className="absolute w-full h-full rounded-lg"
                    style={{
                      backfaceVisibility: "hidden",
                    }}
                  >
                    <ImageWithFallback
                      src={cardImages[card.imageIndex]}
                      alt={`카드 ${card.pairId + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                  
                  {/* 카드 뒷면 */}
                  <div
                    className="absolute w-full h-full rounded-lg"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <ImageWithFallback
                      src={cardBack}
                      alt="카드 뒷면"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 시작 버튼 영역 - 고정 높이 */}
          <div className="mt-6 h-12 flex items-center justify-center">
            {gameState === "memorizing" && (
              <button
                onClick={handleStartPlaying}
                className="relative w-48 h-16 flex items-center justify-center hover:scale-105 transition-transform mt-10"
              >
                <ImageWithFallback
                  src={levelButtonBg}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain"
                />
                <span className="relative z-10" style={{ fontFamily: 'OngleipRyudung', color: '#ffffff', fontSize: '2rem' }}>
                  시작
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 점수 팝업 애니메이션 */}
      {scorePopups.map((popup) => (
        <div
          key={popup.id}
          className="fixed pointer-events-none z-50"
          style={{
            left: `${popup.x}px`,
            top: `${popup.y}px`,
            transform: 'translate(-50%, -50%)',
            animation: 'floatUp 1.5s ease-out forwards',
          }}
          onAnimationEnd={() => {
            setScorePopups(prev => prev.filter(p => p.id !== popup.id));
          }}
        >
          <div className="flex items-center gap-2">
            <ImageWithFallback
              src={starIcon}
              alt="star"
              style={{ width: '2rem', height: '2rem', objectFit: 'contain' }}
            />
            <span 
              className="text-2xl"
              style={{ 
                color: '#a7b7c4',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              +{popup.points}
            </span>
          </div>
        </div>
      ))}

      {/* 하트 팝업 애니메이션 */}
      {heartPopups.map((popup) => (
        <div
          key={popup.id}
          className="fixed pointer-events-none z-50"
          style={{
            left: `${popup.x}px`,
            top: `${popup.y}px`,
            transform: 'translate(-50%, -50%)',
            animation: 'floatUp 1.5s ease-out forwards',
          }}
          onAnimationEnd={() => {
            setHeartPopups(prev => prev.filter(p => p.id !== popup.id));
          }}
        >
          <div className="flex items-center gap-2">
            <Heart
              style={{ 
                width: '2rem',
                height: '2rem',
                objectFit: 'contain',
                fill: '#a7b7c4',
                color: '#a7b7c4',
              }}
            />
            <span 
              className="text-2xl"
              style={{ 
                color: '#a7b7c4',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              -1
            </span>
          </div>
        </div>
      ))}

      {isPaused && (
        <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 ${isClosing ? 'animate-out fade-out duration-200' : 'animate-in fade-in duration-200'}`}>
          <div 
            className={`p-8 max-w-sm w-full mx-4 bg-contain bg-center bg-no-repeat ${isClosing ? 'animate-out zoom-out-95 duration-200' : 'animate-in zoom-in-95 duration-200'}`}
            style={{ backgroundImage: `url(${pauseMenuBg})` }}
          >
            <h2 className="text-center mb-6 mt-4 text-4xl" style={{ color: '#eae4d3' }}>일시정지</h2>
            
            <div className="space-y-0">
              {/* 이어서 버튼 */}
              <button
                onClick={handleResume}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
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
                onClick={handleRestart}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
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
                onClick={handleExit}
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

      {gameState === "gameOver" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div 
            className="p-8 max-w-sm w-full mx-4 bg-contain bg-center bg-no-repeat animate-in zoom-in-95 duration-200"
            style={{ backgroundImage: `url(${pauseMenuBg})` }}
          >
            <h2 className="text-center mb-2 mt-4 text-4xl" style={{ color: '#eae4d3' }}>
              {hearts > 0 ? "레벨 클리어!" : "게임 종료!"}
            </h2>
            <div className="text-center mb-2 text-2xl" style={{ color: '#d4c5a0' }}>
              최고 기록: {getGameRecord("memoryGame")[`level${currentLevel}` as 'level1' | 'level2' | 'level3']}
            </div>
            <div className="text-center mb-6 text-2xl" style={{ color: '#eae4d3' }}>최종 점수: {score}</div>
            
            <div className="space-y-0">
              <button
                onClick={handleRestart}
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
                onClick={handleExit}
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
      
      {/* 게임 설명 모달 */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="카드 게임 설명"
        primaryColor="#a7b7c4"
        backgroundColor="#e8edf1"
        scrollbarColor="#a7b7c4"
        scrollbarTrackColor="#e8edf1"
        onCloseSound={playClickSound}
      >
        <RuleSection title="게임 방법" titleColor="#a7b7c4">
          <p className="mb-4">뒤집힌 카드들 중에서 같은 그림의 카드를 찾아 모든 짝을 맞추세요!</p>
          <RuleList items={[
            "게임이 시작되면 모든 카드가 앞면(과일 그림)으로 보입니다",
            "카드들을 잘 기억한 후 '시작' 버튼을 누르세요",
            "카드를 2장씩 선택하여 같은 그림을 찾으세요",
            "모든 짝을 맞추면 다음 라운드로 넘어갑니다",
            "서로 다른 카드를 선택하면 하트가 1개 줄어듭니다",
            "하트가 모두 사라지면 게임이 종료됩니다"
          ]} />
        </RuleSection>

        <RuleSection title="점수" titleColor="#a7b7c4">
          <RuleList items={[
            <><strong>레벨 1</strong>: 짝당 10점</>,
            <><strong>레벨 2</strong>: 짝당 20점</>,
            <><strong>레벨 3</strong>: 짝당 30점</>
          ]} />
        </RuleSection>
      </GameRulesModal>
    </div>
  );
}