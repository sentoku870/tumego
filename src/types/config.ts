// ============ 設定定数 ============
import { Board, BooleanPreference, DeviceProfile, PanelPosition, Position, RulesMode } from './domain.js';

// ============ エンジン関連 ============
export interface MoveResult {
  readonly board: Board;
  readonly captured: Position[];
  /**
   * If a simple ko was created by the last move, this marks the forbidden
   * point for the opponent's immediate reply. `null` means no ko restriction.
   */
  readonly koPoint?: Position | null;
}

// ============ 設定定数 ============
export interface GameConfig {
  readonly CELL_SIZE: number;
  readonly MARGIN: number;
  readonly STONE_RADIUS: number;
  readonly STAR_RADIUS: number;
  readonly MAX_BOARD_SIZE: number;
  readonly MIN_BOARD_SIZE: number;
  readonly DEFAULT_BOARD_SIZE: number;
  readonly DEFAULT_KOMI: number;
  readonly COORD_FONT_RATIO: number;
  readonly MOVE_NUM_FONT_RATIO: number;
  /** 座標ラベル X 軸オフセット（盤外側） */
  readonly COORD_LABEL_OFFSET_X: number;
  /** 座標ラベル Y 軸オフセット（盤外側） */
  readonly COORD_LABEL_OFFSET_Y: number;
  /** モバイル判定の window.innerWidth 閾値 (px) */
  readonly MOBILE_BREAKPOINT: number;
  /** 横レイアウト・モバイル時の予約幅 (px) */
  readonly MOBILE_HORIZONTAL_RESERVED: number;
  /** 横レイアウト・デスクトップ時の予約幅 (px) */
  readonly DESKTOP_HORIZONTAL_RESERVED: number;
  /** QR データサイズしきい値 (SGF 文字数） */
  readonly QR_DATA_SMALL: number;
  readonly QR_DATA_MEDIUM: number;
  readonly QR_DATA_LARGE: number;
  /** QR コード画像サイズ (URL クエリ) */
  readonly QR_IMAGE_SMALL: string;
  readonly QR_IMAGE_MEDIUM: string;
  readonly QR_IMAGE_LARGE: string;
  /** 解答シーケンス番号表示: 数字描画の背景円半径係数 */
  readonly MOVE_NUM_BG_RADIUS_RATIO: number;
  /** 解答シーケンス番号表示: 黒枠の余白 (px) */
  readonly MOVE_NUM_BORDER_MARGIN: number;
  /** 解答シーケンス番号表示: 数字のフォントサイズ係数 */
  readonly MOVE_NUM_FONT_SCALE: number;
  /** 解答シーケンス番号表示: 数字のストローク幅係数 */
  readonly MOVE_NUM_STROKE_RATIO: number;
  /** 直前手のハイライト半径オフセット (px) */
  readonly LAST_MOVE_HIGHLIGHT_OFFSET: number;
  /** マーカー描画の基本半径 (px) — 石の内側に収まるよう STONE_RADIUS 未満 */
  readonly MARKER_RADIUS: number;
  /** マーカー枠線の太さ (px) */
  readonly MARKER_STROKE_WIDTH: number;
  /** 盤面保存時にコピー対象とする CSS 変数名 */
  readonly BOARD_CAPTURE_CSS_VARS: readonly string[];
}

// ============ 設定 ============
export interface Preferences {
  edit: { rulesMode: RulesMode };
  solve: {
    showCapturedStones: boolean;
    enableFullReset: boolean;
    highlightLastMove: BooleanPreference;
    showSolutionMoveNumbers: BooleanPreference;
    /** 盤面マーカーを表示するか */
    showMarkers: BooleanPreference;
    /** 同一交点に複数のマーカーを重ねられるか */
    allowMultiMarker: BooleanPreference;
  };
  ui: {
    deviceProfile: DeviceProfile;
    /** 横レイアウト時のパネルと碁盤の左右配置 */
    panelPosition: PanelPosition;
  };
}

// ============ 定数 ============
export const DEFAULT_CONFIG: GameConfig = {
  CELL_SIZE: 60,
  MARGIN: 30,
  STONE_RADIUS: 26,
  STAR_RADIUS: 4,
  MAX_BOARD_SIZE: 19,
  MIN_BOARD_SIZE: 9,
  DEFAULT_BOARD_SIZE: 9,
  DEFAULT_KOMI: 6.5,
  COORD_FONT_RATIO: 0.28,
  MOVE_NUM_FONT_RATIO: 0.4,
  COORD_LABEL_OFFSET_X: 20,
  COORD_LABEL_OFFSET_Y: 15,
  MOBILE_BREAKPOINT: 768,
  MOBILE_HORIZONTAL_RESERVED: 250,
  DESKTOP_HORIZONTAL_RESERVED: 350,
  QR_DATA_SMALL: 800,
  QR_DATA_MEDIUM: 1500,
  QR_DATA_LARGE: 2500,
  QR_IMAGE_SMALL: '300x300',
  QR_IMAGE_MEDIUM: '400x400',
  QR_IMAGE_LARGE: '500x500',
  MOVE_NUM_BG_RADIUS_RATIO: 1.15,
  MOVE_NUM_BORDER_MARGIN: 2,
  MOVE_NUM_FONT_SCALE: 1.20,
  MOVE_NUM_STROKE_RATIO: 0.22,
  LAST_MOVE_HIGHLIGHT_OFFSET: 5,
  MARKER_RADIUS: 22,
  MARKER_STROKE_WIDTH: 3,
  BOARD_CAPTURE_CSS_VARS: ['--board', '--line', '--star', '--coord', '--black', '--white', '--accent'],
} as const;
