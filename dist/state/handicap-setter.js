// ============ 置石ロジック ============
// 「even / no-komi / fixed」の3モードを区別して置石を配置する。
// GameStore 内部で state.board / state.gameInfo を直接更新する。
import { DEFAULT_CONFIG, } from "../types.js";
import { hasGameData, isValidPosition } from "./board-utils.js";
export class HandicapSetter {
    constructor(state, engine, history, modeOps, cache) {
        this.state = state;
        this.engine = engine;
        this.history = history;
        this.modeOps = modeOps;
        this.cache = cache;
    }
    /**
     * 置石を適用する一連の処理（テンプレートメソッド）。
     * 履歴保存 → 盤面リセット → 置石配置 → メタデータ更新 → キャッシュ無効化。
     */
    apply(stones) {
        if (this.hasGameData()) {
            this.saveToHistory(`置石設定前（${this.state.handicapStones}子）`);
        }
        const context = this.createContext(stones);
        this.resetBoard(context);
        this.placeStones(context);
        this.updateMetadata(context);
        this.cache.invalidate();
    }
    // ============================================================
    // Internal
    // ============================================================
    createContext(stones) {
        if (stones === "even") {
            return { mode: "even", stones: 0, positions: [] };
        }
        const numeric = Number(stones);
        if (!Number.isFinite(numeric) || numeric < 0) {
            throw new Error(`無効な置石数: ${stones}`);
        }
        if (numeric === 0) {
            return { mode: "no-komi", stones: 0, positions: [] };
        }
        const positions = this.engine.generateHandicapPositions(this.state.boardSize, numeric);
        return { mode: "fixed", stones: numeric, positions };
    }
    resetBoard(_context) {
        this.modeOps.initBoard(this.state.boardSize, { skipHistory: true });
    }
    placeStones(context) {
        if (context.mode !== "fixed") {
            return;
        }
        context.positions.forEach((pos) => {
            if (isValidPosition(this.state.boardSize, pos)) {
                this.state.board[pos.row][pos.col] = 1;
            }
        });
    }
    updateMetadata(context) {
        if (context.mode === "even") {
            this.state.handicapStones = 0;
            this.state.handicapPositions = [];
            this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
            this.state.startColor = 1;
            this.state.gameInfo = {
                ...this.state.gameInfo,
                handicap: null,
                handicapStones: 0,
                handicapPositions: [],
                startColor: this.state.startColor,
            };
            this.syncKomiToGameInfo();
            return;
        }
        if (context.mode === "no-komi") {
            this.state.handicapStones = 0;
            this.state.handicapPositions = [];
            this.state.komi = 0;
            this.state.startColor = 1;
            this.state.gameInfo = {
                ...this.state.gameInfo,
                handicap: null,
                handicapStones: 0,
                handicapPositions: [],
                startColor: this.state.startColor,
            };
            this.syncKomiToGameInfo();
            return;
        }
        this.state.handicapStones = context.stones;
        this.state.handicapPositions = context.positions.map((pos) => ({ ...pos }));
        this.state.komi = 0;
        this.state.startColor = 2;
        this.state.turn = 0;
        this.state.gameInfo = {
            ...this.state.gameInfo,
            handicap: context.stones,
            handicapStones: context.stones,
            handicapPositions: context.positions.map((pos) => ({ ...pos })),
            startColor: this.state.startColor,
        };
        this.syncKomiToGameInfo();
    }
    syncKomiToGameInfo() {
        this.state.gameInfo = {
            ...this.state.gameInfo,
            komi: this.state.komi,
        };
    }
    saveToHistory(label) {
        this.history.save(label, this.state);
    }
    hasGameData() {
        return hasGameData(this.state);
    }
}
//# sourceMappingURL=handicap-setter.js.map