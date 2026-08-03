// ============ ModeController ============
// 配置モード (black/white/alt)、消去モード、解答モード、startColor、
// answerMode などの単純な状態書込 setter を集約する。
// GameStore からこの責務を分離。
import {
  AnswerMode,
  GameState,
  PlayMode,
  StoneColor
} from '../types.js';

export class ModeController {
  constructor(private readonly state: GameState) {}

  /** 配置モード (black/white/alt) を切り替える */
  setMode(mode: PlayMode): void {
    this.state.mode = mode;
  }

  /** 消去モードをオン／オフする */
  setEraseMode(enabled: boolean): void {
    this.state.eraseMode = enabled;
  }

  /** 先手色 (黒/白) を切り替える */
  setStartColor(color: StoneColor): void {
    this.state.startColor = color;
  }

  /** 解答モードでの先手色 (黒先/白先) を切り替える */
  setAnswerMode(mode: AnswerMode): void {
    this.state.answerMode = mode;
  }

  /** バインド時の初期化: 編集モード・解答モード・消去モードを既定値に戻す */
  resetInteractionModes(): void {
    this.state.mode = 'alt';
    this.state.numberMode = false;
    this.state.eraseMode = false;
  }

  /** 現在の着手色を計算する */
  get currentColor(): StoneColor {
    if (this.state.numberMode) {
      return this.state.turn % 2 === 0
        ? this.state.startColor
        : ((3 - this.state.startColor) as StoneColor);
    }
    if (this.state.mode === 'alt') {
      return this.state.turn % 2 === 0
        ? this.state.startColor
        : ((3 - this.state.startColor) as StoneColor);
    }
    return this.state.mode === 'black' ? 1 : 2;
  }
}
