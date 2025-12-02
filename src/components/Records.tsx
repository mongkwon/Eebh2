import { Button } from "./ui/button";
import { playBackSound, playClickSound } from "../utils/sound";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import exitIcon from "figma:asset/74b1288f91a03a19fc199ba8e3ce487eebb3c1fb.png";
import starIcon from "figma:asset/bcc22c12cc1569915dbdb315501b5e8a6b904580.png";
import detailButtonBg from "figma:asset/cd8fa7fc408d44774d5fb29ff7c0832112f3cf65.png";
import categoryButtonBg from "figma:asset/0f3a9e85d51e726c933384a3bdbed562462dc638.png";
import resetButtonBg from "figma:asset/5df3b4cbf086a1930c66e187e5610601100e68d7.png";
import gameCardBg from "figma:asset/af05454781dd3d7b3a795c3bc9fa56952a1e0dd7.png";
import heartIcon from "figma:asset/6bb4b946fe5bace96d27aa95e71d0d4f7866adde.png";
import confirmModalBg from "figma:asset/51393f17970851cd85cfb423e9bca8c8cf71736a.png";
import cancelButtonBg from "figma:asset/51393f17970851cd85cfb423e9bca8c8cf71736a.png";
import { useState, useEffect } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

interface RecordsProps {
  onBack: () => void;
}

// localStorage에서 게임 기록 불러오기
const getGameRecord = (key: string) => {
  const record = localStorage.getItem(key);
  return record ? JSON.parse(record) : { highScore: 0 };
};

export function Records({ onBack }: RecordsProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showDetailView, setShowDetailView] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // 컴포넌트가 마운트될 때마다 데이터 새로고침
  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const gameRecords = [
    {
      category: "눈 게임",
      games: [
        { name: "폭탄게임", key: "bombGame", ...getGameRecord("bombGame") },
        { name: "셔플게임", key: "yabawiGame", ...getGameRecord("yabawiGame") },
        { name: "숫자게임", key: "numberGame", ...getGameRecord("numberGame") }
      ]
    },
    {
      category: "귀 게임",
      games: [
        { name: "버블게임", key: "bubbleShooter", ...getGameRecord("bubbleShooter") },
        { name: "방향게임", key: "directionGame", ...getGameRecord("directionGame") },
        { name: "단어게임", key: "classifyGame", ...getGameRecord("classifyGame") }
      ]
    },
    {
      category: "뇌 게임",
      games: [
        { name: "카드게임", key: "memoryGame", ...getGameRecord("memoryGame") },
        { name: "색칠게임", key: "coloringGame", ...getGameRecord("coloringGame") },
        { name: "순서게임", key: "clickInOrder", ...getGameRecord("clickInOrder") }
      ]
    }
  ];

  // 게임의 총점 계산 (3개 레벨 합)
  const getTotalScore = (game: any) => {
    return (game.level1 || 0) + (game.level2 || 0) + (game.level3 || 0);
  };

  // 전체 통계 계산
  const totalHighScore = gameRecords.reduce((total, category) => {
    return total + category.games.reduce((sum, game) => sum + getTotalScore(game), 0);
  }, 0);
  
  const gamesPlayed = gameRecords.reduce((total, category) => {
    return total + category.games.filter(game => getTotalScore(game) > 0).length;
  }, 0);

  // 레이더 차트 데이터 생성 - 카테고리별 총점
  const radarData = gameRecords.map(category => {
    const totalScore = category.games.reduce((sum, game) => sum + getTotalScore(game), 0);
    return {
      category: category.category.replace(' 게임', ''), // "눈", "귀", "뇌"만 표시
      score: totalScore
    };
  });

  // 최대 점수 계산 (차트 스케일용) - 최소 100
  const maxScore = Math.max(...radarData.map(d => d.score), 100);

  const handleDeleteAll = () => {
    playClickSound();
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteAll = () => {
    // 모든 게임 기록 삭제
    gameRecords.forEach(category => {
      category.games.forEach(game => {
        localStorage.removeItem(game.key);
      });
    });
    playClickSound();
    setRefreshKey(prev => prev + 1);
    setShowDeleteConfirmation(false);
  };

  const cancelDelete = () => {
    playClickSound();
    setShowDeleteConfirmation(false);
  };

  // 상세보기 화면 - 아코디언 방식
  if (showDetailView) {
    return (
      <div className="h-screen overflow-hidden bg-amber-50 p-4 flex flex-col pt-16">
        {/* Header */}
        <div className="flex items-center mb-6 flex-shrink-0">
          <button
            onClick={() => {
              playBackSound();
              setShowDetailView(false);
              setSelectedCategory(null);
            }}
            className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer"
          >
            <ImageWithFallback src={exitIcon} alt="exit" className="h-8 w-8 object-contain" />
          </button>
          <h1 className="text-gray-700 ml-4 text-4xl" style={{ fontFamily: "'OngleipRyudung', sans-serif" }}>게임별 최고 점수</h1>
        </div>

        {/* 카테고리 버튼들 + 아코디언 */}
        <div className="flex-1 flex items-start justify-center overflow-y-auto px-4 py-4 scrollbar-hide">
          <div className="max-w-2xl mx-auto space-y-1.5 w-full">
            {gameRecords.map((category, categoryIndex) => {
              const totalScore = category.games.reduce((sum, game) => sum + getTotalScore(game), 0);
              const isExpanded = selectedCategory === categoryIndex;
              // 아코디언이 펼쳐졌을 때 크기 조절
              const buttonMaxWidth = selectedCategory !== null ? '17.5rem' : '20rem';
              const fontSize = selectedCategory !== null ? 'text-2xl' : 'text-3xl';
              const cardGap = selectedCategory !== null ? 'gap-1' : 'gap-1.5';
              
              return (
                <div key={categoryIndex} className="w-full">
                  {/* 카테고리 버튼 */}
                  <button
                    onClick={() => {
                      playClickSound();
                      setSelectedCategory(isExpanded ? null : categoryIndex);
                    }}
                    className="cursor-pointer bg-transparent border-none p-0 transition-all duration-200 ease-out hover:scale-105 active:scale-95 w-full flex justify-center"
                  >
                    <div className="relative w-full" style={{ maxWidth: buttonMaxWidth }}>
                      <ImageWithFallback 
                        src={categoryButtonBg} 
                        alt={category.category} 
                        className="w-full h-auto object-contain"
                      />
                      <div 
                        className={`absolute inset-0 flex flex-row items-center justify-between text-white px-8 ${fontSize}`}
                        style={{ 
                          fontFamily: "'OngleipRyudung', sans-serif",
                          pointerEvents: 'none'
                        }}
                      >
                        <div>{category.category}</div>
                        <div>{totalScore.toLocaleString()}점</div>
                      </div>
                    </div>
                  </button>

                  {/* 아코디언 콘텐츠 */}
                  {isExpanded && (
                    <div className="mt-1.5 mb-1">
                      <div className={`flex flex-col ${cardGap} mx-auto`} style={{ maxWidth: buttonMaxWidth }}>
                        {category.games.map((game, gameIndex) => (
                          <div
                            key={gameIndex}
                            className="relative w-full"
                          >
                            <ImageWithFallback 
                              src={gameCardBg} 
                              alt={game.name} 
                              className="w-full h-auto object-contain"
                            />
                            <div 
                              className="absolute inset-0 flex flex-col items-center justify-center px-4 py-3"
                              style={{ 
                                fontFamily: "'OngleipRyudung', sans-serif"
                              }}
                            >
                              <div className="text-2xl mb-3" style={{ color: '#675c4e' }}>
                                {game.name}
                              </div>
                              <div 
                                className="flex flex-col gap-0.5 w-full px-2"
                                style={{ 
                                  color: '#675c4e'
                                }}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="text-2xl whitespace-nowrap">1레벨</div>
                                  <div className="text-xl whitespace-nowrap">{game.level1 > 0 ? game.level1.toLocaleString() : '-'}점</div>
                                </div>
                                <div className="w-full h-px" style={{ backgroundColor: '#675c4e' }}></div>
                                <div className="flex items-center justify-between w-full">
                                  <div className="text-2xl whitespace-nowrap">2레벨</div>
                                  <div className="text-xl whitespace-nowrap">{game.level2 > 0 ? game.level2.toLocaleString() : '-'}점</div>
                                </div>
                                <div className="w-full h-px" style={{ backgroundColor: '#675c4e' }}></div>
                                <div className="flex items-center justify-between w-full">
                                  <div className="text-2xl whitespace-nowrap">3레벨</div>
                                  <div className="text-xl whitespace-nowrap">{game.level3 > 0 ? game.level3.toLocaleString() : '-'}점</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 전체 초기화 버튼 */}
        <div className="flex justify-center pb-4 flex-shrink-0">
          <button
            onClick={handleDeleteAll}
            className="relative cursor-pointer bg-transparent border-none p-0 transition-transform duration-200 ease-out hover:scale-105 active:scale-95 w-[17.5rem] h-20"
          >
            <ImageWithFallback 
              src={resetButtonBg} 
              alt="전체 초기화 버튼" 
              className="w-full h-full object-contain"
            />
            <div 
              className="absolute inset-0 flex flex-col items-center justify-center text-white text-2xl"
              style={{ 
                fontFamily: "'OngleipRyudung', sans-serif",
                pointerEvents: 'none',
                lineHeight: '1.2'
              }}
            >
              <div>전체</div>
              <div>초기화</div>
            </div>
          </button>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirmation && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
            <div className="relative max-w-sm mx-4 w-full">
              <ImageWithFallback 
                src={confirmModalBg} 
                alt="확인 배경" 
                className="w-full h-auto object-contain"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                <h3 className="text-2xl mb-3" style={{ fontFamily: "'OngleipRyudung', sans-serif", color: '#675c4e' }}>게임 기록 삭제</h3>
                <p className="text-xl mb-6 text-center" style={{ fontFamily: "'OngleipRyudung', sans-serif", color: '#675c4e' }}>정말로 모든 게임의 기록을<br/>삭제하시겠습니까?</p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={cancelDelete}
                    className="relative cursor-pointer bg-transparent border-none p-0 transition-transform duration-200 ease-out hover:scale-105 active:scale-95 w-[7.5rem] h-[3.125rem]"
                  >
                    <ImageWithFallback 
                      src={cancelButtonBg} 
                      alt="취소 버튼" 
                      className="w-full h-full object-contain"
                    />
                    <div 
                      className="absolute inset-0 flex items-center justify-center text-white text-xl"
                      style={{ 
                        fontFamily: "'OngleipRyudung', sans-serif",
                        pointerEvents: 'none'
                      }}
                    >
                      취소
                    </div>
                  </button>
                  <button
                    onClick={confirmDeleteAll}
                    className="relative cursor-pointer bg-transparent border-none p-0 transition-transform duration-200 ease-out hover:scale-105 active:scale-95 w-[7.5rem] h-[3.125rem]"
                  >
                    <ImageWithFallback 
                      src={resetButtonBg} 
                      alt="삭제 버튼" 
                      className="w-full h-full object-contain"
                    />
                    <div 
                      className="absolute inset-0 flex items-center justify-center text-white text-xl"
                      style={{ 
                        fontFamily: "'OngleipRyudung', sans-serif",
                        pointerEvents: 'none'
                      }}
                    >
                      삭제
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 메인 화면 (레이더 차트)
  return (
    <div className="h-screen overflow-hidden bg-amber-50 p-4 flex flex-col pt-16">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex items-center">
          <button
            onClick={() => {
              playBackSound();
              onBack();
            }}
            className="bg-transparent hover:bg-transparent border-none p-2 cursor-pointer"
          >
            <ImageWithFallback src={exitIcon} alt="exit" className="h-8 w-8 object-contain" />
          </button>
          <h1 className="text-gray-700 ml-4 text-4xl" style={{ fontFamily: "'OngleipRyudung', sans-serif" }}>게임 기록</h1>
        </div>
      </div>

      {/* 레이더 차트 카드 */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div className="max-w-2xl w-full">
          <div className="p-5 pb-3">
            <div className="grid grid-cols-2 gap-4 text-center mb-4">
              <div>
                <div className="flex justify-center mb-2">
                  <ImageWithFallback 
                    src={heartIcon} 
                    alt="하트" 
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div className="text-gray-600 text-2xl" style={{ fontFamily: "'OngleipRyudung', sans-serif" }}>플레이한 게임</div>
                <div className="text-3xl" style={{ fontFamily: "'OngleipRyudung', sans-serif", color: '#675c4e' }}>{gamesPlayed}/9</div>
              </div>
              <div>
                <div className="flex justify-center mb-2">
                  <ImageWithFallback 
                    src={starIcon} 
                    alt="star" 
                    className="h-8 w-8 object-contain" 
                  />
                </div>
                <div className="text-gray-600 text-2xl" style={{ fontFamily: "'OngleipRyudung', sans-serif" }}>총 점수</div>
                <div className="text-3xl" style={{ fontFamily: "'OngleipRyudung', sans-serif", color: '#675c4e' }}>{totalHighScore.toLocaleString()}</div>
              </div>
            </div>
            
            {/* 레이더 차트 */}
            <div className="pt-3 pb-3">
              <div className="h-1 rounded-full mb-3 mx-auto" style={{ backgroundColor: '#675c4e', width: '90%' }}></div>
              <div className="flex items-center justify-center mb-0" style={{ transform: 'translateY(15px)' }}>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 40, bottom: 50, left: 40 }}>
                    <PolarGrid 
                      stroke="#675c4e" 
                      strokeWidth={1}
                      levels={1}
                    />
                    <PolarAngleAxis 
                      dataKey="category" 
                      tick={{ fill: '#675c4e', fontSize: 24, fontFamily: "'OngleipRyudung', sans-serif" }}
                    />
                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, maxScore]}
                      tick={false}
                    />
                    <Radar 
                      name="점수" 
                      dataKey="score" 
                      stroke="#675c4e" 
                      fill="#8b7d6b" 
                      fillOpacity={0.7}
                      strokeWidth={3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* 상세보기 버튼 */}
            <div className="pt-3 flex justify-center">
              <button
                onClick={() => {
                  playClickSound();
                  setShowDetailView(true);
                }}
                className="relative cursor-pointer bg-transparent border-none p-0 transition-transform duration-200 ease-out hover:scale-110 active:scale-95 w-[17.5rem] h-20"
              >
                <ImageWithFallback 
                  src={detailButtonBg} 
                  alt="상세보기 버튼" 
                  className="w-full h-full object-contain"
                />
                <div 
                  className="absolute inset-0 flex items-center justify-center text-white text-2xl"
                  style={{ 
                    fontFamily: "'OngleipRyudung', sans-serif",
                    pointerEvents: 'none'
                  }}
                >
                  상세보기
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}