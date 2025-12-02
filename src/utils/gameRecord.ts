// 게임 기록을 localStorage에 저장하는 유틸리티

export const saveGameRecord = (gameKey: string, score: number, level: number = 1) => {
  try {
    const existingRecord = localStorage.getItem(gameKey);
    const currentRecord = existingRecord ? JSON.parse(existingRecord) : { level1: 0, level2: 0, level3: 0 };
    
    const levelKey = `level${level}` as 'level1' | 'level2' | 'level3';
    
    // 새로운 점수가 더 높으면 업데이트
    if (score > (currentRecord[levelKey] || 0)) {
      currentRecord[levelKey] = score;
      localStorage.setItem(gameKey, JSON.stringify(currentRecord));
    }
  } catch (error) {
    console.error('Failed to save game record:', error);
  }
};

export const getGameRecord = (gameKey: string) => {
  try {
    const record = localStorage.getItem(gameKey);
    return record ? JSON.parse(record) : { level1: 0, level2: 0, level3: 0 };
  } catch (error) {
    console.error('Failed to get game record:', error);
    return { level1: 0, level2: 0, level3: 0 };
  }
};
