import { useState, useEffect, useRef } from "react";
import { Heart, X } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { GameRulesButton } from "../GameRulesButton";
import {
  GameRulesModal,
  RuleSection,
  RuleList,
} from "../GameRulesModal";
import { Settings } from "../Settings";
import {
  playBackSound,
  playClickSound,
  playSelectSound,
} from "../../utils/sound";
import { saveGameRecord, getGameRecord } from "../../utils/gameRecord";
import pauseIcon from "figma:asset/8acb1e015c5c90586e07679819984941b38f74af.png";
import resumeIcon from "figma:asset/62327073bfb38b1feb704b5c6f1eb2a36789eee8.png";
import restartIcon from "figma:asset/d1a45328f3c2f5290d250ff17f71584c907a61a7.png";
import pauseMenuBg from "figma:asset/54f8a82ff3f9348da47c92cd7e8e9b17adc71522.png";
import pauseExitIcon from "figma:asset/7b6920cff9236248c28a92364a77c6df5be27012.png";
import exitIcon from "figma:asset/74b1288f91a03a19fc199ba8e3ce487eebb3c1fb.png";
import settingsIcon from "figma:asset/f50441ac52c2a907e8c436ef7897926c378fa505.png";
import cardBackground from "figma:asset/d3882e8d0074f1d54b6764ce26ed343408323313.png";
import levelButtonBg from "figma:asset/c40d55ea1f04b7d786be1a07004ba9eb2d39490d.png";
import replayButtonBg from "figma:asset/76896cc73d11fff23bc0ef71e56e9001acc1b9ee.png";
import starIcon from "figma:asset/539c2a8bf466fe0b7e46f9ccca0d7887792cfb96.png";
import checkIconYellow from "figma:asset/9de1bcc95794954679cd64a56b7bfe0db64bdca6.png";
import xIconRed from "figma:asset/6e7571d0e1cde7b66675af17f6a00a2752bfa47a.png";

interface ClassifyGameProps {
  onBack: () => void;
}

type GameState = "ready" | "playing" | "gameOver";

interface WordPair {
  word1: string;
  word2: string;
}

const WORD_PAIRS: WordPair[] = [
  { word1: "오리", word2: "우리" },
  { word1: "바람", word2: "사람" },
  { word1: "구름", word2: "그림" },
  { word1: "다리", word2: "자리" },
  { word1: "머리", word2: "무리" },
  { word1: "곰", word2: "공" },
  { word1: "압력", word2: "악력" },
  { word1: "밤", word2: "밥" },
  { word1: "눈", word2: "논" },
  { word1: "감정", word2: "강정" },
  { word1: "연구", word2: "연고" },
  { word1: "말", word2: "날" },
  { word1: "경찰", word2: "명찰" },
  { word1: "사고", word2: "사과" },
  { word1: "감독", word2: "감동" },
  { word1: "의식", word2: "이식" },
  { word1: "방안", word2: "방한" },
  { word1: "발간", word2: "발광" },
  { word1: "고리", word2: "거리" },
  { word1: "문", word2: "물" },
];

export function ClassifyGame({ onBack }: ClassifyGameProps) {
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [gameState, setGameState] =
    useState<GameState>("ready");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [recommendedLevel, setRecommendedLevel] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [shuffledWords, setShuffledWords] = useState<
    { pair: WordPair; correctWord: string }[]
  >([]);
  const [isListening, setIsListening] = useState(false);
  const [currentOptions, setCurrentOptions] = useState<
    [string, string]
  >(["", ""]);
  const [showResult, setShowResult] = useState<
    "correct" | "wrong" | null
  >(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false); // 음성 재생 중 상태
  const [currentVoiceVersion, setCurrentVoiceVersion] = useState(1); // 현재 라운드의 음성 버전
  const [targetSide, setTargetSide] = useState<'left' | 'right' | null>(null); // 레벨 3용: 어느 쪽 단어를 선택해야 하는지

  const audioContextRef = useRef<AudioContext | null>(null);
  const whiteNoiseRef = useRef<AudioBufferSourceNode | null>(null);
  const playWordTimeoutRef = useRef<number | null>(null);
  const setListeningTimeoutRef = useRef<number | null>(null);
  const resultTimeoutRef = useRef<number | null>(null);
  const noiseAudioRef = useRef<HTMLAudioElement | null>(null);
  const wordAudioRef = useRef<HTMLAudioElement | null>(null); // 음성 파일용
  const leftWordAudioRef = useRef<HTMLAudioElement | null>(null); // 레벨 3용: 왼쪽 채널 오디오
  const rightWordAudioRef = useRef<HTMLAudioElement | null>(null); // 레벨 3용: 오른쪽 채널 오디오
  const [scorePopups, setScorePopups] = useState<Array<{ id: number; points: number; x: number; y: number }>>([]);
  const scorePopupIdRef = useRef(0);
  const [heartPopups, setHeartPopups] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const heartPopupIdRef = useRef(0);
  const pausedShowResultRef = useRef<"correct" | "wrong" | null>(null); // 일시정지 시 결과 상태 저장

  // 전역 AudioContext 가져오기 (안드로이드 웹뷰 호환성 향상)
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  // 레벨별 노이즈 설정 - 레벨 2는 제거 (단어 재생 시 노이즈 사용)
  const startBackgroundNoise = (level: number) => {
    if (level === 1 || level === 2 || level === 3) return; // 모든 레벨에서 배경 노이즈 없음

    stopBackgroundNoise();
  };

  const stopBackgroundNoise = () => {
    if (noiseAudioRef.current) {
      noiseAudioRef.current.pause();
      noiseAudioRef.current.currentTime = 0;
      noiseAudioRef.current = null;
    }
  };

  // 단어 섞기
  const shuffleWords = () => {
    const shuffled = WORD_PAIRS.map((pair) => {
      const correctWord =
        Math.random() > 0.5 ? pair.word1 : pair.word2;
      return { pair, correctWord };
    }).sort(() => Math.random() - 0.5);
    setShuffledWords(shuffled);
  };

  // 레벨 3용: 두 단어를 동시에 왼쪽/오른쪽으로 재생
  const playStereoWords = (word1: string, word2: string, version?: number) => {
    stopSound();
    setIsPlayingVoice(true);

    const selectedVersion =
      version !== undefined ? version : Math.floor(Math.random() * 4) + 1;

    // 랜덤으로 왼쪽/오른쪽 결정
    const targetSideRandom: 'left' | 'right' = Math.random() > 0.5 ? 'left' : 'right';
    setTargetSide(targetSideRandom);

    const leftWord = word1;
    const rightWord = word2;

    const leftAudioFile = `sounds/classify/${encodeURIComponent(leftWord)}-${selectedVersion}.mp3`;
    const rightAudioFile = `sounds/classify/${encodeURIComponent(rightWord)}-${selectedVersion}.mp3`;

    console.log(`🎵 레벨 3 스테레오 재생: 왼쪽=${leftWord}-${selectedVersion}, 오른쪽=${rightWord}-${selectedVersion}, 타겟=${targetSideRandom}`);

    // 재시도 로직 추가
    let retryCount = 0;
    const maxRetries = 2;
    let currentAudioContext: AudioContext | null = null;

    const tryPlayStereo = () => {
      // 이전 AudioContext 정리
      if (currentAudioContext) {
        try {
          currentAudioContext.close();
        } catch (e) {
          // 무시
        }
      }

      // Web Audio API 사용
      currentAudioContext = getAudioContext();
      const audioContext = currentAudioContext;
      
      // 왼쪽 오디오
      const leftAudio = new Audio();
      leftAudio.crossOrigin = "anonymous";
      leftAudio.src = leftAudioFile;
      
      // 오른쪽 오디오
      const rightAudio = new Audio();
      rightAudio.crossOrigin = "anonymous";
      rightAudio.src = rightAudioFile;

      let leftLoaded = false;
      let rightLoaded = false;
      let bothEnded = false;
      let playAttempted = false;
      let hasError = false;

      const cleanup = () => {
        if (audioContext && audioContext.state !== 'closed') {
          try {
            audioContext.close();
          } catch (e) {
            // 무시
          }
        }
      };

      const handleError = (source: string, error: any) => {
        if (hasError) return; // 이미 에러 처리 중이면 무시
        hasError = true;
        
        console.log(`❌ ${source} 오디오 실패 (시도 ${retryCount + 1}/${maxRetries + 1}):`, error);
        cleanup();
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`🔄 재시도 중... (${retryCount}/${maxRetries})`);
          setTimeout(() => tryPlayStereo(), 100);
        } else {
          console.log(`❌ 최종 실패: 스테레오 재생`);
          setIsPlayingVoice(false);
        }
      };

      const checkBothEnded = () => {
        if (leftAudio.ended && rightAudio.ended && !bothEnded) {
          bothEnded = true;
          setIsPlayingVoice(false);
          cleanup();
        }
      };

      leftAudio.onended = checkBothEnded;
      rightAudio.onended = checkBothEnded;

      const tryPlayBoth = () => {
        if (leftLoaded && rightLoaded && !playAttempted && !hasError) {
          playAttempted = true;
          
          try {
            // Web Audio API로 패닝 설정
            const leftSource = audioContext.createMediaElementSource(leftAudio);
            const leftPanner = audioContext.createStereoPanner();
            leftPanner.pan.value = -1; // 완전 왼쪽
            leftSource.connect(leftPanner).connect(audioContext.destination);

            const rightSource = audioContext.createMediaElementSource(rightAudio);
            const rightPanner = audioContext.createStereoPanner();
            rightPanner.pan.value = 1; // 완전 오른쪽
            rightSource.connect(rightPanner).connect(audioContext.destination);

            // 동시 재생
            Promise.all([leftAudio.play(), rightAudio.play()])
              .then(() => {
                console.log('✅ 스테레오 재생 성공');
                leftWordAudioRef.current = leftAudio;
                rightWordAudioRef.current = rightAudio;
              })
              .catch((err) => {
                handleError('재생', err);
              });
          } catch (err) {
            handleError('AudioContext 설정', err);
          }
        }
      };

      leftAudio.oncanplaythrough = () => {
        if (!hasError) {
          leftLoaded = true;
          tryPlayBoth();
        }
      };

      rightAudio.oncanplaythrough = () => {
        if (!hasError) {
          rightLoaded = true;
          tryPlayBoth();
        }
      };

      leftAudio.onerror = (err) => {
        handleError('왼쪽 로드', err);
      };

      rightAudio.onerror = (err) => {
        handleError('오른쪽 로드', err);
      };

      // 타임아웃 설정 (5초 후에도 로드 안 되면 실패 처리)
      setTimeout(() => {
        if (!playAttempted && !hasError) {
          handleError('타임아웃', new Error('로딩 시간 초과'));
        }
      }, 5000);
    };

    tryPlayStereo();

    // 버전 저장
    if (version === undefined) {
      setCurrentVoiceVersion(selectedVersion);
    }
  };

  // 짧은 노이즈 재생 - Web Audio API 사용 (레벨 2용)
  const playShortNoise = () => {
    console.log(`🔊 노이 재생 시작: 0.5초 (고정)`);

    try {
      const audioContext = getAudioContext();
      
      // 항상 0.5초 고정
      const noiseDuration = 0.5;
      
      // 0.5초 분량의 white noise 버퍼 생성
      const bufferSize = audioContext.sampleRate * noiseDuration;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const output = buffer.getChannelData(0);
      
      // 랜덤 노이즈 데이터 생성
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      
      // AudioBufferSource 생성
      const whiteNoise = audioContext.createBufferSource();
      whiteNoise.buffer = buffer;
      
      // GainNode로 볼륨 조절
      const noiseGain = audioContext.createGain();
      noiseGain.gain.setValueAtTime(0.15, audioContext.currentTime); // 약한 노이즈
      
      whiteNoise.connect(noiseGain);
      noiseGain.connect(audioContext.destination);
      
      whiteNoise.start(audioContext.currentTime);
      
      // 재생 완료 후 정리
      whiteNoise.onended = () => {
        audioContext.close();
      };
      
      console.log(`✅ 0.5초 노이즈 재생`);
    } catch (error) {
      console.log('노이즈 생성 실패:', error);
    }
  };

  // 음성 재생 (버전 지정 가능) - 레벨 1, 2용
  const playWord = async (word: string, version?: number) => {
    stopSound();
    setIsPlayingVoice(true);

    const selectedVersion =
      version !== undefined ? version : Math.floor(Math.random() * 4) + 1;
    const audioFile = `sounds/classify/${encodeURIComponent(word)}-${selectedVersion}.mp3`;

    console.log(`🎵 단어게임 음성 재생 시도: ${audioFile} (버전: ${selectedVersion})`);

    // 재시도 로직 - 버블게임과 동일한 패턴
    const maxRetries = 5;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`🔄 음성 재생 재시도 ${attempt}/${maxRetries - 1}: ${audioFile}`);
      }

      const result = await new Promise<{ success: boolean }>((resolve) => {
        const audio = new Audio(audioFile);
        audio.volume = 0.7;
        
        let resolved = false;
        
        // 타임아웃 설정 (3초)
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve({ success: false });
          }
        }, 3000);
        
        // 메타데이터 로드 시
        audio.addEventListener('loadedmetadata', () => {
          audio.play()
            .then(() => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                console.log(`✅ 음성 파일 재생 성공: ${audioFile} (시도: ${attempt + 1})`);
                wordAudioRef.current = audio;
                
                // 오디오 종료 이벤트 리스너
                audio.onended = () => {
                  setIsPlayingVoice(false);
                };
                
                resolve({ success: true });
              }
            })
            .catch(() => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve({ success: false });
              }
            });
        });

        // 에러 발생 시
        audio.addEventListener('error', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({ success: false });
          }
        });
      });

      // 성공하면 즉시 반환
      if (result.success) {
        // 버전 저장 (다시듣기용 - 새로운 랜덤 버전일 때만)
        if (version === undefined) {
          setCurrentVoiceVersion(selectedVersion);
        }
        return;
      }

      // 실패 시 짧은 딜레이 후 재시도 (마지막 시도가 아닐 경우)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 모든 재시도 실패
    console.log(`❌ 음성 파일 재생 실패 (${maxRetries}회 시도): ${audioFile}`);
    setIsPlayingVoice(false);
  };

  const stopSound = () => {
    // 음성 일 정지
    if (wordAudioRef.current) {
      wordAudioRef.current.pause();
      wordAudioRef.current.currentTime = 0;
      wordAudioRef.current = null;
      setIsPlayingVoice(false);
    }

    // 레벨 3 스테레오 오디오 정지
    if (leftWordAudioRef.current) {
      leftWordAudioRef.current.pause();
      leftWordAudioRef.current.currentTime = 0;
      leftWordAudioRef.current = null;
    }
    if (rightWordAudioRef.current) {
      rightWordAudioRef.current.pause();
      rightWordAudioRef.current.currentTime = 0;
      rightWordAudioRef.current = null;
    }

    // 노이즈 정리
    if (whiteNoiseRef.current) {
      try {
        whiteNoiseRef.current.stop();
      } catch (e) {
        // 이미 정지된 경우 무시
      }
      whiteNoiseRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const startGame = (level?: number) => {
    const gameLevel = level || selectedLevel;
    setScore(0);
    setHearts(3);
    setCurrentWordIndex(0);
    setCurrentLevel(gameLevel);
    setGameState("playing");
    setIsPaused(false);
    setShowResult(null);
    shuffleWords();

    // 노이즈 시작 - gameLevel 사용
    setTimeout(() => {
      startBackgroundNoise(gameLevel);
    }, 100);
  };

  const prepareNextRound = () => {
    if (currentWordIndex >= shuffledWords.length) {
      // 모든 단어를 다 했으면 다시 섞어서 계속 진행
      shuffleWords();
      setCurrentWordIndex(0);
      return;
    }

    const currentWord = shuffledWords[currentWordIndex];
    const options: [string, string] =
      Math.random() > 0.5
        ? [currentWord.pair.word1, currentWord.pair.word2]
        : [currentWord.pair.word2, currentWord.pair.word1];

    setCurrentOptions(options);
    setIsListening(false);
    setShowResult(null);

    // 타이머 저장하여 일시정지 시 취소 가능하도록
    playWordTimeoutRef.current = window.setTimeout(() => {
      // 벨 3: 스테레오로 두 단어 동시 재생
      if (currentLevel === 3) {
        playStereoWords(currentWord.pair.word1, currentWord.pair.word2);
      } else {
        // 레벨 2: 노이즈 먼저 재생
        if (currentLevel === 2) {
          playShortNoise();
        }
        // 레벨 1, 2: 단어 음성 재생
        playWord(currentWord.correctWord);
      }
      
      // 음성이 실제로 재생된 후에 선택 가능하도록 추가 지연
      setListeningTimeoutRef.current = window.setTimeout(() => {
        setIsListening(true);
      }, 1000);
    }, 500);
  };

  // 모든 타이머 정리 함수
  const clearAllTimers = () => {
    if (playWordTimeoutRef.current !== null) {
      clearTimeout(playWordTimeoutRef.current);
      playWordTimeoutRef.current = null;
    }
    if (setListeningTimeoutRef.current !== null) {
      clearTimeout(setListeningTimeoutRef.current);
      setListeningTimeoutRef.current = null;
    }
    if (resultTimeoutRef.current !== null) {
      clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (gameState === "playing" && shuffledWords.length > 0) {
      prepareNextRound();
    }
  }, [gameState, shuffledWords, currentWordIndex]);

  // 게임 종료 시 노이즈 정지
  useEffect(() => {
    if (gameState === "gameOver" || gameState === "ready") {
      stopBackgroundNoise();
    }
  }, [gameState]);

  const handleWordChoice = (selectedWord: string, cardIndex: number) => {
    if (!isListening || showResult) return;

    playClickSound();
    setIsListening(false);
    stopSound();
    clearAllTimers(); // 타이머 정리

    const currentWord = shuffledWords[currentWordIndex];
    
    let isCorrect: boolean;
    
    if (currentLevel === 3 && targetSide) {
      // 레벨 3: 타겟 방향에 따라 정답 판정
      const leftWord = currentWord.pair.word1;
      const rightWord = currentWord.pair.word2;
      
      if (targetSide === 'left') {
        isCorrect = selectedWord === leftWord;
      } else {
        isCorrect = selectedWord === rightWord;
      }
    } else {
      // 레벨 1, 2: 기존 방식
      isCorrect = selectedWord === currentWord.correctWord;
    }

    setShowResult(isCorrect ? "correct" : "wrong");

    // 카드 위치 가져오기
    const cardElement = document.getElementById(`classify-card-${cardIndex}`);
    if (cardElement) {
      const rect = cardElement.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      if (isCorrect) {
        // 점수 팝업 추가
        setScorePopups(prev => [...prev, { id: scorePopupIdRef.current++, points: currentLevel * 10, x, y }]);
      } else {
        // 하트 팝업 추가
        setHeartPopups(prev => [...prev, { id: heartPopupIdRef.current++, x, y }]);
      }
    }

    if (isCorrect) {
      playSelectSound();
      setScore((prev) => prev + currentLevel * 10);

      resultTimeoutRef.current = window.setTimeout(() => {
        setCurrentWordIndex((prev) => prev + 1);
      }, 1000);
    } else {
      playBackSound(); // 오답 효과음
      setHearts((prev) => {
        const newHearts = prev - 1;
        if (newHearts <= 0) {
          resultTimeoutRef.current = window.setTimeout(() => {
            setGameState("gameOver");
          }, 1000);
        } else {
          resultTimeoutRef.current = window.setTimeout(() => {
            setCurrentWordIndex((prev) => prev + 1);
          }, 1000);
        }
        return newHearts;
      });
    }
  };

  const togglePause = () => {
    playClickSound();
    if (gameState !== "playing") return;

    if (!isPaused) {
      stopSound();
      clearAllTimers(); // 모든 타이머 정리
      pausedShowResultRef.current = showResult; // 결과 상태 저장
      setIsPaused(true);
    } else {
      setIsPaused(false);
    }
  };

  const handleResume = () => {
    playClickSound();
    setIsPaused(false);
    
    // 결과 표시 중이었다면 다음 라운드로 넘어가는 타이머 설정
    if (pausedShowResultRef.current) {
      resultTimeoutRef.current = window.setTimeout(() => {
        if (hearts <= 0) {
          setGameState("gameOver");
        } else {
          setCurrentWordIndex((prev) => prev + 1);
        }
      }, 500); // 0.5초 후 다음 라운드로
      pausedShowResultRef.current = null;
    } else {
      // 결과 표시 중이 아니었다면 선택 가능 상태로
      setIsListening(true);
    }
  };

  const handleRestart = () => {
    playClickSound();
    setIsPaused(false);
    stopSound();
    clearAllTimers(); // 타이머 정리
    startGame();
  };

  const handleExit = () => {
    playBackSound();
    stopSound();
    clearAllTimers(); // 타이머 정리
    onBack();
  };

  useEffect(() => {
    return () => {
      stopSound();
      stopBackgroundNoise();
      clearAllTimers(); // 컴포넌트 언마운트 시 타이머 정리
    };
  }, []);

  useEffect(() => {
    if (isPaused) {
      stopSound();
      clearAllTimers(); // 일시정지 시 타이머 정리
      if (noiseAudioRef.current) {
        noiseAudioRef.current.pause();
      }
    } else if (gameState === "playing") {
      if (noiseAudioRef.current) {
        noiseAudioRef.current.play();
      }
    }
  }, [isPaused, gameState]);

  // 게임 오버 시 기록 저장
  useEffect(() => {
    if (gameState === "gameOver") {
      saveGameRecord("classifyGame", score, currentLevel);
    }
  }, [gameState, score, currentLevel]);

  // 컴포넌트 마운트 시 추천 레벨 계산
  useEffect(() => {
    const records = getGameRecord("classifyGame");
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
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center">
          {gameState === "ready" && (
            <button
              onClick={handleExit}
              className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer"
            >
              <ImageWithFallback
                src={exitIcon}
                alt="exit"
                className="h-8 w-8 object-contain"
              />
            </button>
          )}

          {gameState === "ready" && (
            <h1 className="text-gray-700 ml-4 text-4xl">
              단어 게임
            </h1>
          )}

          {/* Playing 상태일 때 왼쪽에 일시정지 버튼과 설정 버튼 */}
          {gameState === "playing" && !isPaused && (
            <div className="flex items-center gap-2">
              <button
                onClick={togglePause}
                className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer transition-transform hover:scale-110 active:scale-95"
              >
                <ImageWithFallback
                  src={pauseIcon}
                  alt="일시정지"
                  className="h-10 w-10 object-contain"
                />
              </button>
              
              <button
                onClick={() => {
                  playClickSound();
                  setShowSettings(true);
                }}
                className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer transition-transform hover:scale-110 active:scale-95"
              >
                <ImageWithFallback
                  src={settingsIcon}
                  alt="설정"
                  className="h-10 w-10 object-contain"
                />
              </button>
            </div>
          )}

          {gameState === "playing" && isPaused && (
            <div className="w-12" />
          )}
        </div>

        {gameState === "gameOver" && <div className="w-12" />}

        {gameState === "playing" && (
          <>
            <div className="flex items-center gap-4">
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <Heart
                    key={i}
                    className={`w-7 h-7 ${
                      i < hearts
                        ? "fill-[#cd6c58] text-[#cd6c58]"
                        : "fill-gray-300 text-gray-300"
                    }`}
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
        <div className="flex-1 flex flex-col">
          <div className="mb-8 px-4">
            <p className="text-2xl text-gray-700 text-center">
              *이어폰(헤드폰) 착용 권장<br />
              들리는 단어를 듣고 올바른 단어가 적힌 카드를 선택하세요!<br />
              잘못된 단어 카드를 선택하면 하트를 잃습니다
            </p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center">
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
                  <div
                    className="absolute inset-0 flex flex-col items-start justify-center pl-8"
                    style={{
                      fontFamily: "OngleipRyudung",
                      color: "#ffffff",
                    }}
                  >
                    <div className="text-3xl">
                      레벨 1
                    </div>
                    <div className="text-2xl">
                      좌우 같은 단어
                    </div>
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
                  <div
                    className="absolute inset-0 flex flex-col items-start justify-center pl-8"
                    style={{
                      fontFamily: "OngleipRyudung",
                      color: "#ffffff",
                    }}
                  >
                    <div className="text-3xl">
                      레벨 2
                    </div>
                    <div className="text-2xl">
                      좌우 같은 단어, 노이즈
                    </div>
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
                  <div
                    className="absolute inset-0 flex flex-col items-start justify-center pl-8"
                    style={{
                      fontFamily: "OngleipRyudung",
                      color: "#ffffff",
                    }}
                  >
                    <div className="text-3xl">
                      레벨 3
                    </div>
                    <div className="text-2xl">
                      좌우 다른 단어
                    </div>
                  </div>
                </button>
              </div>

              <p className="text-2xl text-gray-700 mt-4 text-center">
                레벨을 선택하세요
              </p>

              <GameRulesButton
                onClick={() => {
                  playClickSound();
                  setShowRules(true);
                }}
                backgroundColor="#e5a652"
                textColor="#ffffff"
              />
            </div>
          </div>
        </div>
      )}

      {gameState === "playing" && (
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {/* 상태 메시지 영역 - 고정 높이 */}
          <div className="mb-4 h-10 flex items-center justify-center">
            {!isListening && !showResult && (
              <div
                className="text-3xl animate-pulse"
                style={{ color: "#e5a652" }}
              >
                음성에 집중하세요!
              </div>
            )}

            {isListening && !showResult && (
              <div
                className="text-3xl animate-pulse"
                style={{ color: "#e5a652" }}
              >
                {currentLevel === 3 && targetSide
                  ? targetSide === 'left'
                    ? '왼쪽에서 들린 단어를 선택하세요!'
                    : '오른쪽에서 들린 단어를 선택하세요!'
                  : '카드를 선택하세요!'}
              </div>
            )}

            {showResult && (
              <div className="flex items-center justify-center gap-4">
                {showResult === "correct" ? (
                  <div
                    className="text-[40px] flex items-center justify-center gap-2"
                    style={{ 
                      color: "#e5a652",
                      fontFamily: "OngleipRyudung",
                      animation: "bounceInOutClassify 1.7s ease-out"
                    }}
                  >
                    맞았습니다!
                    <ImageWithFallback 
                      src={checkIconYellow} 
                      alt="체크" 
                      style={{ width: "30px", height: "30px", objectFit: "contain" }}
                    />
                  </div>
                ) : (
                  <div
                    className="text-[40px] flex items-center justify-center gap-2"
                    style={{ 
                      color: "#cd6c58",
                      fontFamily: "OngleipRyudung",
                      animation: "shakeXClassify 0.5s ease-out"
                    }}
                  >
                    틀렸습니다!
                    <ImageWithFallback 
                      src={xIconRed} 
                      alt="엑스" 
                      style={{ width: "30px", height: "30px", objectFit: "contain" }}
                    />
                  </div>
                )}
              </div>
            )}
            
            <style>{`
              @keyframes bounceInOutClassify {
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
              
              @keyframes shakeXClassify {
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
            `}</style>
          </div>

          {/* 카드 영역 */}
          <div className="flex flex-col gap-8 mb-8">
            {currentOptions.map((word, index) => {
              // 레벨 3: targetSide에 따라 정답 결정
              let correctAnswer: string;
              if (currentLevel === 3 && targetSide) {
                const currentWord = shuffledWords[currentWordIndex];
                correctAnswer = targetSide === 'left' 
                  ? currentWord?.pair.word1 
                  : currentWord?.pair.word2;
              } else {
                correctAnswer = shuffledWords[currentWordIndex]?.correctWord;
              }
              
              const isCorrectCard =
                showResult
                      ? word === correctAnswer
                      : false;
              const isWrongCard =
                showResult
                      ? word !== correctAnswer
                      : false;

              return (
                <button
                  key={index}
                  id={`classify-card-${index}`}
                  onClick={() => handleWordChoice(word, index)}
                  disabled={!isListening || !!showResult}
                  className={`relative w-31 h-32 flex items-center justify-center text-4xl cursor-pointer transition-all bg-transparent border-none ${
                    showResult
                      ? isCorrectCard
                        ? "scale-105"
                        : "opacity-50"
                      : "hover:scale-105"
                  }`}
                  style={{
                    filter:
                      showResult && isCorrectCard
                        ? "drop-shadow(0 0 20px rgba(229, 166, 82, 0.9))"
                        : "none",
                  }}
                >
                  {/* 카드 배경 이미지 */}
                  <ImageWithFallback
                    src={cardBackground}
                    alt="card"
                    className="absolute inset-0 w-full h-full object-contain"
                  />

                  {/* 단어 텍스트 */}
                  <span
                    className="relative z-10"
                    style={{ color: "#ffffff" }}
                  >
                    {word}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 다시듣기 버튼 영역 - 고정 높이 */}
          <div className="mt-6 h-16 flex items-center justify-center">
            {isListening && !showResult && !isPlayingVoice && score >= currentLevel * 5 && (
              <button
                onClick={() => {
                  playClickSound();
                  // 점수 차감
                  const replayCost = currentLevel * 5;
                  setScore(prev => prev - replayCost);
                  const currentWord =
                    shuffledWords[currentWordIndex];
                  
                  // 레벨 3: 스테레오로 재생
                  if (currentLevel === 3) {
                    playStereoWords(currentWord.pair.word1, currentWord.pair.word2, currentVoiceVersion);
                  } else {
                    // 레벨 2: 노이즈 먼저 재생
                    if (currentLevel === 2) {
                      playShortNoise();
                    }
                    // 레벨 1, 2: 단어 음성 재생
                    playWord(currentWord.correctWord);
                  }
                }}
                className="relative hover:scale-105 active:scale-95 transition-transform"
              >
                <ImageWithFallback
                  src={replayButtonBg}
                  alt="다시듣기"
                  className="h-16 w-auto object-contain"
                />
                <span
                  className="absolute inset-0 flex items-center justify-center text-xl"
                  style={{ color: "#ffffff" }}
                >
                  다시듣기 -{currentLevel * 5}점
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {isPaused && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div
            className="p-8 max-w-sm w-full mx-4 bg-contain bg-center bg-no-repeat animate-in zoom-in-95 duration-200"
            style={{ backgroundImage: `url(${pauseMenuBg})` }}
          >
            <h2
              className="text-center mb-6 mt-4 text-4xl"
              style={{ color: "#eae4d3" }}
            >
              일시정지
            </h2>

            <div className="space-y-0">
              <button
                onClick={handleResume}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
              >
                <ImageWithFallback
                  src={resumeIcon}
                  alt="resume"
                  className="h-12 w-12 object-contain"
                />
                <span
                  className="text-3xl"
                  style={{ color: "#eae4d3" }}
                >
                  이어서
                </span>
              </button>

              <button
                onClick={handleRestart}
                className="w-full bg-transparent hover:opacity-80 py-2 px-6 transition-opacity flex items-center justify-center gap-3"
              >
                <ImageWithFallback
                  src={restartIcon}
                  alt="restart"
                  className="h-12 w-12 object-contain"
                />
                <span
                  className="text-3xl"
                  style={{ color: "#eae4d3" }}
                >
                  처음부터
                </span>
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
                <span
                  className="text-3xl"
                  style={{ color: "#eae4d3" }}
                >
                  나가기
                </span>
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
            <h2
              className="text-center mb-2 mt-4 text-4xl"
              style={{ color: "#eae4d3" }}
            >
              게임 종료!
            </h2>
            <div
              className="text-center mb-2 text-2xl"
              style={{ color: "#d4c5a0" }}
            >
              최고 기록: {getGameRecord("classifyGame")[`level${currentLevel}` as 'level1' | 'level2' | 'level3']}
            </div>
            <div
              className="text-center mb-6 text-2xl"
              style={{ color: "#eae4d3" }}
            >
              최종 점수: {score}
            </div>

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
                <span
                  className="text-3xl"
                  style={{ color: "#eae4d3" }}
                >
                  처음부터
                </span>
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
                <span
                  className="text-3xl"
                  style={{ color: "#eae4d3" }}
                >
                  나가기
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 게임 설명 모달 */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="단어 게임 설명"
        primaryColor="#e5a652"
        backgroundColor="#fef3c7"
        scrollbarColor="#e5a652"
        scrollbarTrackColor="#fef3c7"
        onCloseSound={playClickSound}
      >
        <RuleSection title="게임 방법" titleColor="#e5a652">
          <p className="mb-4">들리는 단어를 듣고 올바른 카드를 선택하세요!</p>
          <RuleList
            items={[
              "같은 단어를 다시 듣고 싶다면 '다시듣기' 버튼을 누르세요",
              "잘못된 단어 카드를 선택하면 하트가 1개 줄어듭니다",
              "하트가 모두 사라지면 게임이 종료됩니다",
            ]}
          />
        </RuleSection>

        <RuleSection title="점수" titleColor="#e5a652">
          <RuleList
            items={[
              <>
                <strong>레벨 1</strong>: 정답당 10점
              </>,
              <>
                <strong>레벨 2</strong>: 정답당 20점
              </>,
              <>
                <strong>레벨 3</strong>: 정답당 30점
              </>,
            ]}
          />
        </RuleSection>
      </GameRulesModal>

      {/* 설정 모달 */}
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
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
            animation: 'floatUpClassifyScore 1.5s ease-out forwards',
          }}
          onAnimationEnd={() => {
            setScorePopups(prev => prev.filter(p => p.id !== popup.id));
          }}
        >
          <div className="flex items-center gap-2">
            <ImageWithFallback
              src={starIcon}
              alt="star"
              style={{ width: '2.5rem', height: '2.5rem', objectFit: 'contain' }}
            />
            <div
              style={{
                fontSize: '2.5rem',
                color: '#e5a652',
                fontFamily: 'OngleipRyudung',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              +{popup.points}
            </div>
          </div>
        </div>
      ))}

      {/* 하트 감소 팝업 애니메이션 */}
      {heartPopups.map((popup) => (
        <div
          key={popup.id}
          className="fixed pointer-events-none z-50"
          style={{
            left: `${popup.x}px`,
            top: `${popup.y}px`,
            transform: 'translate(-50%, -50%)',
            animation: 'floatUpClassifyHeart 1.5s ease-out forwards',
          }}
          onAnimationEnd={() => {
            setHeartPopups(prev => prev.filter(p => p.id !== popup.id));
          }}
        >
          <div className="flex items-center gap-2">
            <Heart
              style={{ width: '2.5rem', height: '2.5rem', color: '#cd6c58', fill: '#cd6c58' }}
            />
            <div
              style={{
                fontSize: '2.5rem',
                color: '#cd6c58',
                fontFamily: 'OngleipRyudung',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              -1
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes floatUpClassifyScore {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(0px) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(-30px) scale(1.2);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(-60px) scale(1);
          }
        }

        @keyframes floatUpClassifyHeart {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(0px) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(-30px) scale(1.3);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(-60px) scale(1);
          }
        }
      `}</style>
    </div>
  );
}