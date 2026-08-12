// ============ state-factory.js ============
// テスト用 GameState ファクトリの集約。
//
// 背景: テストファイル 21 箇所で createState() / createBoard() が
// 個別に重複定義されており、わずかな差異で保守性を損なっている。
// 本モジュールは「デフォルト値の基準」を提供することで、
// 段階的な移行（将来 PR）の土台とする。
//
// 既存テストは本モジュールに強制移行しない。テストごとに必要な
// フィールドが異なるため、移行は慎重なレビューを伴う。

import { DEFAULT_CONFIG } from '../../dist/types.js';

/** 空の盤面を作成する */
export function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

/**
 * テスト用のデフォルト GameState を生成する。
 *
 * 既存テストの createState() と互換のあるデフォルト値を採用：
 * - boardSize: 9
 * - mode: 'alt'
 * - eraseMode: false
 * - startColor: 1 (黒先)
 * - answerMode: 'black'
 * - komi: DEFAULT_CONFIG.DEFAULT_KOMI (6.5)
 * - handicapStones: 0
 *
 * @param overrides 部分上書きするフィールド
 */
export function createDefaultState(overrides = {}) {
  const boardSize = overrides.boardSize ?? 9;
  return {
    boardSize,
    board: createEmptyBoard(boardSize),
    mode: 'alt',
    eraseMode: false,
    history: [],
    turn: 0,
    sgfMoves: [],
    numberMode: false,
    startColor: 1,
    sgfIndex: 0,
    numberStartIndex: 0,
    komi: DEFAULT_CONFIG.DEFAULT_KOMI,
    handicapStones: 0,
    handicapPositions: [],
    answerMode: 'black',
    problemDiagramSet: false,
    problemDiagramBlack: [],
    problemDiagramWhite: [],
    sgfLoadedFromExternal: false,
    capturedCounts: { black: 0, white: 0 },
    gameInfo: {
      title: '',
      black: '',
      white: '',
      komi: DEFAULT_CONFIG.DEFAULT_KOMI,
      result: ''
    },
    markers: [],
    rootMarkers: [],
    nodeMarkers: [],
    markerMode: false,
    activeMarkerKind: null,
    activeMarkerLabel: null,
    koPoint: null,
    ...overrides
  };
}
