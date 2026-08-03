// ============ SGF メタデータ抽出ヘルパ ============
// SGF 文字列から各種メタデータ (GN, SZ, KM, HA, PB, PW, RE, PL) を
// 正規表現で抽出する純粋関数群。
import { SGFGameInfo } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

interface MetadataOverrides {
  gameInfo: SGFGameInfo;
}

/**
 * SGF 文字列からメタデータを抽出して gameInfo にマージする。
 * 元の gameInfo の値は上書きしない (存在しない場合のみ埋める)。
 */
export function extractMetadata(rawText: string, initial: SGFGameInfo): SGFGameInfo {
  const info: SGFGameInfo = { ...initial };

  const titleMatch = rawText.match(/GN\[([^\]]*)\]/i);
  if (titleMatch && !info.title) {
    info.title = titleMatch[1] || '';
  }

  const sizeMatch = rawText.match(/SZ\[(\d+)\]/i);
  if (sizeMatch) {
    info.boardSize = parseInt(sizeMatch[1], 10);
  }

  const komiMatch = rawText.match(/KM\[([^\]]+)\]/i);
  if (komiMatch) {
    const parsedKomi = parseFloat(komiMatch[1]);
    info.komi = Number.isNaN(parsedKomi) ? null : parsedKomi;
  }

  const handicapMatch = rawText.match(/HA\[([^\]]+)\]/i);
  if (handicapMatch) {
    const parsedHandicap = parseInt(handicapMatch[1], 10);
    info.handicap = Number.isNaN(parsedHandicap) ? null : parsedHandicap;
    info.handicapStones = Number.isNaN(parsedHandicap) ? 0 : parsedHandicap;
  }

  const playerBlackMatch = rawText.match(/PB\[([^\]]*)\]/i);
  if (playerBlackMatch && info.playerBlack === null) {
    info.playerBlack = playerBlackMatch[1] || null;
  }

  const playerWhiteMatch = rawText.match(/PW\[([^\]]*)\]/i);
  if (playerWhiteMatch && info.playerWhite === null) {
    info.playerWhite = playerWhiteMatch[1] || null;
  }

  const resultMatch = rawText.match(/RE\[([^\]]*)\]/i);
  if (resultMatch && info.result === null) {
    info.result = resultMatch[1] || null;
  }

  return info;
}

/**
 * 既定値で初期化された SGFGameInfo を作成する。
 */
export function createDefaultGameInfo(): SGFGameInfo {
  return {
    title: '',
    komi: DEFAULT_CONFIG.DEFAULT_KOMI,
    handicap: null,
    handicapStones: 0,
    handicapPositions: [],
    startColor: 1,
    problemDiagramSet: false,
    problemDiagramBlack: [],
    problemDiagramWhite: [],
    playerBlack: null,
    playerWhite: null,
    result: null
  };
}

/**
 * SGF の着手文字列 (B/W) を StoneColor に変換する。
 */
export function sgfColorToStoneColor(sgfColor: string): 1 | 2 {
  return sgfColor.toUpperCase() === 'B' ? 1 : 2;
}
