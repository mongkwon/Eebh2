import { Button } from "./ui/button";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { playClickSound, playSelectSound } from "../utils/sound";
import { useState, useEffect } from "react";

import settingsIcon from "figma:asset/f50441ac52c2a907e8c436ef7897926c378fa505.png";
import eyeGameImage from "figma:asset/26384e5070001773ecdd00a276581db36dab93ab.png";
import earGameImage from "figma:asset/cb3ff545f21b905d3b831c0f35c52531b19aa0e2.png";
import brainGameImage from "figma:asset/4ece2f551ec8cafe4d1e5357cfabd5058b8baf0c.png";
import heartGameImage from "figma:asset/02c9835d22d8877f7a0fc712cab1474d338372f5.png";

interface MainMenuProps {
  onSelectCategory: (categoryIndex: number) => void;
  onOpenSettings: () => void;
  onOpenRecords: () => void;
}

const categories = [
  {
    id: 1,
    name: "눈 게임",
    image: eyeGameImage
  },
  {
    id: 2,
    name: "귀 게임",
    image: earGameImage
  },
  {
    id: 3,
    name: "뇌 게임",
    image: brainGameImage
  },
  {
    id: 4,
    name: "테스트하기",
    image: heartGameImage
  }
];

// localStorage에서 게임 기록 불러오기
const getGameRecord = (key: string) => {
  const record = localStorage.getItem(key);
  return record ? JSON.parse(record) : { level1: 0, level2: 0, level3: 0 };
};

// 게임의 총점 계산 (3개 레벨 합)
const getTotalScore = (game: any) => {
  return (game.level1 || 0) + (game.level2 || 0) + (game.level3 || 0);
};

// 카테고리별 총점 계산
const getCategoryScores = () => {
  const eyeGames = ['bombGame', 'yabawiGame', 'numberGame'];
  const earGames = ['bubbleShooter', 'directionGame', 'classifyGame'];
  const brainGames = ['memoryGame', 'coloringGame', 'clickInOrder'];

  const eyeScore = eyeGames.reduce((sum, key) => sum + getTotalScore(getGameRecord(key)), 0);
  const earScore = earGames.reduce((sum, key) => sum + getTotalScore(getGameRecord(key)), 0);
  const brainScore = brainGames.reduce((sum, key) => sum + getTotalScore(getGameRecord(key)), 0);

  return [eyeScore, earScore, brainScore];
};

// 가장 낮은 점수의 카테고리 인덱스 반환
const getLowestScoreCategory = () => {
  const scores = getCategoryScores();
  const minScore = Math.min(...scores);
  const lowestIndices = scores
    .map((score, index) => (score === minScore ? index : -1))
    .filter(index => index !== -1);
  
  // 같은 점수가 여러 개면 랜덤으로 선택
  return lowestIndices[Math.floor(Math.random() * lowestIndices.length)];
};

export function MainMenu({ onSelectCategory, onOpenSettings, onOpenRecords }: MainMenuProps) {
  const [recommendedCategory, setRecommendedCategory] = useState<number | null>(null);

  useEffect(() => {
    // 컴포넌트 마운트 시 추천 카테고리 계산
    setRecommendedCategory(getLowestScoreCategory());
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-amber-50 flex flex-col">
      {/* Header with Settings button and Title */}
      <div className="relative flex justify-center items-center pt-20 px-4 flex-shrink-0">
        <h1 className="text-5xl text-center" style={{ fontFamily: "'KkuBulLim', cursive", color: "#4a4a4a" }}>눈귀뇌하트</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            playClickSound();
            onOpenSettings();
          }}
          className="absolute right-4 bg-transparent hover:bg-transparent border-none p-2 w-16 h-16 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
        >
          <ImageWithFallback src={settingsIcon} alt="설정" className="w-full h-full object-contain" />
        </Button>
      </div>

      {/* Game Category Buttons - 화면 중앙에 배치 */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8 mt-4">
        <div className="max-w-xs w-full space-y-2">
          {categories.map((category, index) => (
            <div key={category.id} className="relative">
              <button
                onClick={() => {
                  playSelectSound();
                  // 4번째 카테고리(테스트하기/하트)는 기록 화면으로 이동
                  if (index === 3) {
                    onOpenRecords();
                  } else {
                    onSelectCategory(index);
                  }
                }}
                className={`w-full transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
                  index === 0 || index === 1 || index === 2 || index === 3
                    ? 'bg-transparent border-none p-0' 
                    : 'aspect-[16/6] rounded-2xl overflow-hidden relative shadow-xl'
                }`}
                style={index < 3 && index === recommendedCategory ? {
                  animation: 'buttonPulse 1.5s ease-in-out infinite'
                } : undefined}
              >
                {index === 0 || index === 1 || index === 2 || index === 3 ? (
                  // 모든 게임 - 이미지 자체가 버튼
                  <ImageWithFallback
                    src={category.image}
                    alt={category.name}
                    className="w-2/3 h-auto object-contain mx-auto"
                  />
                ) : (
                  // 나머지 게임들 - 기존 스타일
                  <>
                    <ImageWithFallback
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <h2 className="text-white drop-shadow-lg">{category.name}</h2>
                    </div>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}