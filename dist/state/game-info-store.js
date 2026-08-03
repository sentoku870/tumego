// ============ GameInfoStore ============
// 対局情報 (タイトル/対局者/コミ/結果) と state.gameInfo の相互変換、
// デフォルト値の生成を担当する。
// GameStore からこの責務を分離。
import { DEFAULT_CONFIG } from '../types.js';
export class GameInfoStore {
    constructor(state) {
        this.state = state;
    }
    /** state.gameInfo から表示用の GameInfo を取得 (欠損は既定値で埋める) */
    getGameInfo() {
        var _a, _b, _c, _d, _e, _f, _g;
        const info = (_a = this.state.gameInfo) !== null && _a !== void 0 ? _a : this.createDefault();
        return {
            title: (_b = info.title) !== null && _b !== void 0 ? _b : '',
            playerBlack: (_c = info.playerBlack) !== null && _c !== void 0 ? _c : null,
            playerWhite: (_d = info.playerWhite) !== null && _d !== void 0 ? _d : null,
            komi: (_f = (_e = info.komi) !== null && _e !== void 0 ? _e : this.state.komi) !== null && _f !== void 0 ? _f : DEFAULT_CONFIG.DEFAULT_KOMI,
            result: (_g = info.result) !== null && _g !== void 0 ? _g : null
        };
    }
    /** GameInfo パッチを state.gameInfo に反映する */
    updateGameInfo(patch) {
        const current = this.getGameInfo();
        const next = { ...current, ...patch };
        if (patch.komi !== undefined) {
            if (typeof patch.komi === 'number' && Number.isFinite(patch.komi)) {
                this.state.komi = patch.komi;
                next.komi = patch.komi;
            }
            else {
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
    syncKomiToGameInfo() {
        this.state.gameInfo = {
            ...this.state.gameInfo,
            komi: this.state.komi
        };
    }
    /** 既定値で初期化された SGFGameInfo を生成 */
    createDefault() {
        var _a;
        return {
            title: '',
            playerBlack: null,
            playerWhite: null,
            komi: (_a = this.state.komi) !== null && _a !== void 0 ? _a : DEFAULT_CONFIG.DEFAULT_KOMI,
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
    ensureDefaults() {
        var _a, _b;
        if (!this.state.gameInfo) {
            this.state.gameInfo = this.createDefault();
        }
        else {
            this.state.gameInfo = {
                ...this.createDefault(),
                ...this.state.gameInfo,
                komi: (_b = (_a = this.state.gameInfo.komi) !== null && _a !== void 0 ? _a : this.state.komi) !== null && _b !== void 0 ? _b : DEFAULT_CONFIG.DEFAULT_KOMI
            };
        }
    }
}
//# sourceMappingURL=game-info-store.js.map