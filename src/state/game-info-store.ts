// ============ GameInfoStore ============
// 対局情報 (タイトル/対局者/コミ/結果) と state.gameInfo の相互変換、
// デフォルト値の生成を担当する。
// GameStore からこの責務を分離。
import {
  DEFAULT_CONFIG,
  GameInfo,
  GameState,
  SGFGameInfo
} from '../types.js';

export class GameInfoStore {
  constructor(private readonly state: GameState) {}

  /** state.gameInfo から表示用の GameInfo を取得 (欠損は既定値で埋める) */
  getGameInfo(): GameInfo {
    const info = this.state.gameInfo ?? this.createDefault();

    return {
      title: info.title ?? '',
      playerBlack: info.playerBlack ?? null,
      playerWhite: info.playerWhite ?? null,
      komi: info.komi ?? this.state.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
      result: info.result ?? null
    };
  }

  /** GameInfo パッチを state.gameInfo に反映する */
  updateGameInfo(patch: Partial<GameInfo>): void {
    const current = this.getGameInfo();
    const next: GameInfo = { ...current, ...patch };

    if (patch.komi !== undefined) {
      if (typeof patch.komi === 'number' && Number.isFinite(patch.komi)) {
        this.state.komi = patch.komi;
        next.komi = patch.komi;
      } else {
        next.komi = current.komi;
      }
    }

    this.state.gameInfo = {
      ...this.state.gameInfo,
      ...next,
      komi: next.komi
    };
  }

  /** state.komi を state.gameInfo.komi に同期 */
  syncKomiToGameInfo(): void {
    this.state.gameInfo = {
      ...this.state.gameInfo,
      komi: this.state.komi
    };
  }

  /** 既定値で初期化された SGFGameInfo を生成 */
  createDefault(): SGFGameInfo {
    return {
      title: '',
      playerBlack: null,
      playerWhite: null,
      komi: this.state.komi ?? DEFAULT_CONFIG.DEFAULT_KOMI,
      result: null,
      handicap: null,
      handicapStones: 0,
      handicapPositions: [],
      boardSize: this.state.boardSize,
      startColor: this.state.startColor,
      problemDiagramSet: false,
      problemDiagramBlack: [],
      problemDiagramWhite: []
    };
  }

  /** state.gameInfo を初期化する (コンストラクタで 1 度呼ばれる) */
  ensureDefaults(): void {
    if (!this.state.gameInfo) {
      this.state.gameInfo = this.createDefault();
    } else {
      this.state.gameInfo = {
        ...this.createDefault(),
        ...this.state.gameInfo,
        komi:
          this.state.gameInfo.komi ??
          this.state.komi ??
          DEFAULT_CONFIG.DEFAULT_KOMI
      };
    }
  }

  /**
   * state.gameInfo を既定値（タイトル空・対局者 null・コミ既定・結果 null）
   * にリセットする。「全消去」「対局情報リセット」ボタンから呼ばれる。
   *
   * 注: handicap / boardSize / startColor 等の SGFGameInfo 拡張フィールドも
   * createDefault() が既定化するため、SGF 読込後に呼ばれても元のメタ情報を
   * 綺麗に消せる。
   *
   * state.komi も DEFAULT_CONFIG.DEFAULT_KOMI に戻し、createDefault() と
   * 一貫した値にする。
   */
  resetToDefault(): void {
    this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
    this.state.gameInfo = this.createDefault();
  }
}
