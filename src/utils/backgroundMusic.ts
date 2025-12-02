// 배경음악 관리 시스템

// ===== 설정 =====
const USE_AUDIO_FILE = true; // MP3 파일 사용

// sound.ts의 볼륨 관리 함수 import
import { setMusicVolume as saveMusicVolume } from './sound';

// 각 화면별 음악 파일 경로
export const MUSIC_TRACKS = {
  main_1: "music/main1.mp3",
  main_2: "music/main2.mp3",
  credits: "music/credits.mp3",
  // 눈 게임 (카테고리 0)
  game_0_0: "music/bomb.mp3",      // 폭탄 게임
  game_0_1: "music/shuffle.mp3",   // 셔플 게임
  game_0_2: "music/number.mp3",    // 숫자 게임
  // 귀 게임 (카테고리 1)
  game_1_0: "music/bubble.mp3",    // 버블 게임
  game_1_1: "music/direction.mp3", // 방향 게임
  game_1_2: "music/classify.mp3",  // 단어 게임
  // 뇌 게임 (카테고리 2)
  game_2_0: "music/card.mp3",      // 카드 게임
  game_2_1: "music/coloring.mp3",  // 색칠 게임
  game_2_2: "music/order.mp3",     // 순서 게임
};

type MusicKey = keyof typeof MUSIC_TRACKS;

// ===== 현재 방식: Web Audio API =====
let audioContext: AudioContext | null = null;
let currentMusicKey: MusicKey | null = null;
let masterGain: GainNode | null = null;
let isPlaying = false;
let oscillators: OscillatorNode[] = [];
let musicLoopTimeout: NodeJS.Timeout | null = null;
let currentVolume: number = 0.3;
let isMusicEnabled: boolean = true; // 음악 활성화 상태

// ===== 파일 방식: HTML5 Audio =====
let audioElements: Map<MusicKey, HTMLAudioElement> = new Map();
let currentAudioElement: HTMLAudioElement | null = null;
let mainMenuMusicIndex: number = 1; // 메인메뉴 음악 인덱스 (1 또는 2)
let lastMusicKey: MusicKey | null = null; // 마지막으로 재생하려던 음악 기억
let isUnmuted: boolean = false; // 음소거 해제 여부

// 로컬스토리지에서 음악 설정 불러오기
function loadMusicSettings() {
  try {
    const saved = localStorage.getItem('musicEnabled');
    if (saved !== null) {
      isMusicEnabled = saved === 'true';
    }
  } catch (error) {
    console.error('Error loading music settings:', error);
  }
}

// 로컬스토리지에 음악 설정 저장하기
function saveMusicSettings() {
  try {
    localStorage.setItem('musicEnabled', isMusicEnabled.toString());
  } catch (error) {
    console.error('Error saving music settings:', error);
  }
}

// 초기화 시 설정 불러오기
loadMusicSettings();

function createBackgroundMusic(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// 음악 키 생성 헬퍼
export function getMusicKey(screen: 'main' | 'credits' | 'game', categoryIndex?: number, gameIndex?: number): MusicKey {
  if (screen === 'main') {
    return `main_${mainMenuMusicIndex}` as MusicKey;
  }
  if (screen === 'credits') {
    return 'credits';
  }
  return `game_${categoryIndex}_${gameIndex}` as MusicKey;
}

// 특정 음악 재생
export function playMusic(musicKey: MusicKey, volume: number = currentVolume) {
  // 음악이 비활성화되어 있으면 재생하지 않음
  if (!isMusicEnabled) {
    return;
  }
  
  // 'main'을 'main_1' 또는 'main_2'로 변환
  let actualMusicKey = musicKey;
  if (musicKey === 'main' as any) {
    actualMusicKey = `main_${mainMenuMusicIndex}` as MusicKey;
  }
  
  currentVolume = volume;
  
  // 메인메뉴 음악의 경우, 같은 계열의 음악이면 그대로 유지
  const isSameMainMusic = (
    (currentMusicKey === 'main_1' || currentMusicKey === 'main_2') && 
    (actualMusicKey === 'main_1' || actualMusicKey === 'main_2') &&
    isPlaying
  );
  
  // 같은 음악이 이미 재생 중이면 그대로 유지
  if (currentMusicKey === actualMusicKey && isPlaying) {
    return;
  }
  
  // 메인메뉴 음악 계열이면 그대로 유지
  if (isSameMainMusic) {
    return;
  }
  
  stopMusic();
  
  currentMusicKey = actualMusicKey;
  lastMusicKey = actualMusicKey; // 마지막 음악 기억
  
  if (USE_AUDIO_FILE) {
    playAudioFile(actualMusicKey, currentVolume);
    return;
  }
  
  // Web Audio API 사용
  playGeneratedMusic(actualMusicKey, currentVolume);
}

// MP3 파일 재생
function playAudioFile(musicKey: MusicKey, volume: number) {
  if (!audioElements.has(musicKey)) {
    const audio = new Audio(MUSIC_TRACKS[musicKey]);
    
    // 에러 핸들링: 파일이 없으면 조용히 무시
    audio.addEventListener('error', () => {
      console.log(`음악 파일 로드 실패: ${musicKey}`);
      audioElements.delete(musicKey);
    });
    
    // 메인메뉴 음악은 한 곡이 끝나면 다음 곡으로 자동 전환
    if (musicKey === 'main_1' || musicKey === 'main_2') {
      audio.loop = false;
      audio.addEventListener('ended', () => {
        mainMenuMusicIndex = mainMenuMusicIndex === 1 ? 2 : 1;
        const nextKey = `main_${mainMenuMusicIndex}` as MusicKey;
        currentMusicKey = null;
        playMusic(nextKey, currentVolume);
      });
    } else {
      audio.loop = true;
    }
    
    // 음소거 해제 여부에 따라 볼륨 설정
    audio.volume = isUnmuted ? volume : 0;
    audioElements.set(musicKey, audio);
  }
  
  currentAudioElement = audioElements.get(musicKey)!;
  currentAudioElement.volume = isUnmuted ? volume : 0;
  
  currentAudioElement.play()
    .then(() => {
      console.log(`✅ 음악 재생 성공: ${musicKey}`);
      // 자동재생 성공 시 음소거 해제
      if (!isUnmuted) {
        isUnmuted = true;
        currentAudioElement!.volume = volume;
      }
    })
    .catch(err => {
      console.log(`⚠️ 음악 자동재생 차단됨 - 음소거 모드로 재시도: ${musicKey}`);
      // 자동재생 실패 시 음소거 상태로 재시도
      currentAudioElement!.muted = true;
      currentAudioElement!.play()
        .then(() => {
          console.log(`✅ 음소거 모드로 음악 재생 성공: ${musicKey}`);
        })
        .catch(() => {
          console.log(`❌ 음소거 모드로도 재생 실패: ${musicKey}`);
          audioElements.delete(musicKey);
        });
    });
  isPlaying = true;
}

// Web Audio API로 생성된 음악 재생 (화면별 다른 멜로디)
function playGeneratedMusic(musicKey: MusicKey, volume: number) {
  if (isPlaying) return;
  
  const ctx = createBackgroundMusic();
  
  masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);
  
  // 화면에 따라 다른 멜로디 선택
  const melodyData = getMelodyForScreen(musicKey);
  
  let melodyTime = ctx.currentTime;
  let bassTime = ctx.currentTime;
  
  function playMelodyLoop() {
    if (!isPlaying || !masterGain || !audioContext) return;
    
    melodyData.melody.forEach((note, index) => {
      const osc = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      
      osc.type = melodyData.waveType;
      osc.frequency.value = note.freq;
      
      gain.gain.setValueAtTime(0, melodyTime + index * note.duration);
      gain.gain.linearRampToValueAtTime(0.15, melodyTime + index * note.duration + 0.1);
      gain.gain.linearRampToValueAtTime(0, melodyTime + index * note.duration + note.duration - 0.1);
      
      osc.connect(gain);
      gain.connect(masterGain!);
      
      osc.start(melodyTime + index * note.duration);
      osc.stop(melodyTime + index * note.duration + note.duration);
      
      oscillators.push(osc);
    });
    
    const totalDuration = melodyData.melody.reduce((sum, note) => sum + note.duration, 0);
    melodyTime += totalDuration;
    
    musicLoopTimeout = setTimeout(playMelodyLoop, totalDuration * 1000);
  }
  
  function playBassLoop() {
    if (!isPlaying || !masterGain || !audioContext) return;
    
    melodyData.bass.forEach((note, index) => {
      const osc = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      
      gain.gain.setValueAtTime(0, bassTime + index * note.duration);
      gain.gain.linearRampToValueAtTime(0.2, bassTime + index * note.duration + 0.1);
      gain.gain.linearRampToValueAtTime(0, bassTime + index * note.duration + note.duration - 0.1);
      
      osc.connect(gain);
      gain.connect(masterGain!);
      
      osc.start(bassTime + index * note.duration);
      osc.stop(bassTime + index * note.duration + note.duration);
      
      oscillators.push(osc);
    });
    
    const totalDuration = melodyData.bass.reduce((sum, note) => sum + note.duration, 0);
    bassTime += totalDuration;
    
    musicLoopTimeout = setTimeout(playBassLoop, totalDuration * 1000);
  }
  
  isPlaying = true;
  playMelodyLoop();
  playBassLoop();
}

// 화면별 멜로디 데이터
function getMelodyForScreen(musicKey: MusicKey) {
  // 메인 화면 - 편안한 C Major
  if (musicKey === 'main_1') {
    return {
      waveType: 'sine' as OscillatorType,
      melody: [
        { freq: 523.25, duration: 2 },   // C5
        { freq: 587.33, duration: 2 },   // D5
        { freq: 659.25, duration: 2 },   // E5
        { freq: 587.33, duration: 2 },   // D5
        { freq: 523.25, duration: 2 },   // C5
        { freq: 440.00, duration: 2 },   // A4
        { freq: 493.88, duration: 2 },   // B4
        { freq: 523.25, duration: 2 },   // C5
      ],
      bass: [
        { freq: 130.81, duration: 4 },   // C3
        { freq: 146.83, duration: 4 },   // D3
        { freq: 130.81, duration: 4 },   // C3
        { freq: 110.00, duration: 4 },   // A2
      ]
    };
  }
  
  // 안력 게임 (카테고리 0) - 밝고 경쾌한 G Major
  if (musicKey.startsWith('game_0_')) {
    return {
      waveType: 'triangle' as OscillatorType,
      melody: [
        { freq: 783.99, duration: 1.5 },   // G5
        { freq: 880.00, duration: 1.5 },   // A5
        { freq: 987.77, duration: 1.5 },   // B5
        { freq: 880.00, duration: 1.5 },   // A5
        { freq: 783.99, duration: 1.5 },   // G5
        { freq: 659.25, duration: 1.5 },   // E5
        { freq: 783.99, duration: 1.5 },   // G5
        { freq: 659.25, duration: 1.5 },   // E5
      ],
      bass: [
        { freq: 196.00, duration: 3 },   // G3
        { freq: 164.81, duration: 3 },   // E3
        { freq: 196.00, duration: 3 },   // G3
        { freq: 146.83, duration: 3 },   // D3
      ]
    };
  }
  
  // 청력 게임 (카테고리 1) - 신비로운 A Minor
  if (musicKey.startsWith('game_1_')) {
    return {
      waveType: 'sine' as OscillatorType,
      melody: [
        { freq: 440.00, duration: 2 },   // A4
        { freq: 523.25, duration: 2 },   // C5
        { freq: 587.33, duration: 2 },   // D5
        { freq: 659.25, duration: 2 },   // E5
        { freq: 587.33, duration: 2 },   // D5
        { freq: 523.25, duration: 2 },   // C5
        { freq: 493.88, duration: 2 },   // B4
        { freq: 440.00, duration: 2 },   // A4
      ],
      bass: [
        { freq: 110.00, duration: 4 },   // A2
        { freq: 130.81, duration: 4 },   // C3
        { freq: 146.83, duration: 4 },   // D3
        { freq: 98.00, duration: 4 },    // G2
      ]
    };
  }
  
  // 기억력 게임 (카테고리 2) - 집중력 있는 D Major
  if (musicKey.startsWith('game_2_')) {
    return {
      waveType: 'square' as OscillatorType,
      melody: [
        { freq: 587.33, duration: 1.5 },   // D5
        { freq: 659.25, duration: 1.5 },   // E5
        { freq: 739.99, duration: 1.5 },   // F#5
        { freq: 783.99, duration: 1.5 },   // G5
        { freq: 739.99, duration: 1.5 },   // F#5
        { freq: 659.25, duration: 1.5 },   // E5
        { freq: 587.33, duration: 1.5 },   // D5
        { freq: 523.25, duration: 1.5 },   // C5
      ],
      bass: [
        { freq: 146.83, duration: 3 },   // D3
        { freq: 196.00, duration: 3 },   // G3
        { freq: 174.61, duration: 3 },   // F3
        { freq: 146.83, duration: 3 },   // D3
      ]
    };
  }
  
  // 테스트하기 (카테고리 3) - 긴장감 있는 E Minor
  if (musicKey.startsWith('game_3_')) {
    return {
      waveType: 'sawtooth' as OscillatorType,
      melody: [
        { freq: 659.25, duration: 1.5 },   // E5
        { freq: 739.99, duration: 1.5 },   // F#5
        { freq: 783.99, duration: 1.5 },   // G5
        { freq: 880.00, duration: 1.5 },   // A5
        { freq: 783.99, duration: 1.5 },   // G5
        { freq: 739.99, duration: 1.5 },   // F#5
        { freq: 659.25, duration: 1.5 },   // E5
        { freq: 587.33, duration: 1.5 },   // D5
      ],
      bass: [
        { freq: 164.81, duration: 3 },   // E3
        { freq: 196.00, duration: 3 },   // G3
        { freq: 220.00, duration: 3 },   // A3
        { freq: 246.94, duration: 3 },   // B3
      ]
    };
  }
  
  // 기본값 (메인과 동일)
  return getMelodyForScreen('main_1');
}

export function stopMusic() {
  isPlaying = false;
  
  // Web Audio API 정리
  if (musicLoopTimeout) {
    clearTimeout(musicLoopTimeout);
    musicLoopTimeout = null;
  }
  
  oscillators.forEach(osc => {
    try {
      osc.stop();
    } catch (e) {
      // Already stopped
    }
  });
  oscillators = [];
  
  // HTML5 Audio 정리
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
  }
  
  currentMusicKey = null;
}

export function setMusicVolume(volume: number) {
  // 현재 볼륨 저장 (먼저)
  currentVolume = volume;
  
  // 재생 중인 Web Audio API 볼륨 업데이트
  if (masterGain && audioContext) {
    masterGain.gain.setValueAtTime(volume, audioContext.currentTime);
  }
  
  // 재생 중인 HTML5 Audio 볼륨 업데이트 (실시간 반영)
  if (currentAudioElement && !currentAudioElement.muted) {
    currentAudioElement.volume = volume;
  }
  
  // 볼륨 설정 저장
  saveMusicVolume(volume);
}

export function isMusicPlaying(): boolean {
  return isPlaying;
}

export function getCurrentMusicKey(): MusicKey | null {
  return currentMusicKey;
}

export function setMusicEnabled(enabled: boolean) {
  isMusicEnabled = enabled;
  
  if (!isMusicEnabled) {
    stopMusic();
  } else {
    // 음악을 다시 켤 때, 마지막으로 재생하려던 음악이 있으면 재생
    if (lastMusicKey && !isPlaying) {
      playMusic(lastMusicKey, currentVolume);
    }
  }
  
  // 설정 저장
  saveMusicSettings();
}

export function getMusicEnabled(): boolean {
  return isMusicEnabled;
}

export function getMusicVolume(): number {
  return currentVolume;
}

export function setUnmuted(unmuted: boolean) {
  isUnmuted = unmuted;
  
  if (!isUnmuted) {
    stopMusic();
  } else {
    // 음소거 해제 시 현재 재생 중인 오디오가 있으면 muted 해제 및 볼륨 복원
    if (currentAudioElement) {
      currentAudioElement.muted = false;
      currentAudioElement.volume = currentVolume;
      console.log('🔊 음소거 해제 및 볼륨 복원:', currentVolume);
    }
    
    // 음악을 다시 켤 때, 마지막으로 재생하려던 음악이 있으면 재생
    if (lastMusicKey && !isPlaying) {
      playMusic(lastMusicKey, currentVolume);
    }
  }
}

export function getUnmuted(): boolean {
  return isUnmuted;
}