// ============ マーカー専用 Store ============
// 盤面マーカー (○△□×/ラベル) の配置・トグル・永続化を担当する。
// GameState.markers / rootMarkers / nodeMarkers / markerMode / activeMarker*
// を操作するすべてのロジックを集約し、GameStore から分離する。
//
// マーカー配置/削除の副作用として、アクティブラベル (LB) の自動進行と
// 消去モードの自動解除を行う。
import { nextMarkerLetter } from '../types/index.js';
import { isValidPosition, cloneMarkers } from './board-utils.js';
export class MarkerStore {
    constructor(state) {
        this.state = state;
    }
    // ============================================================
    // 初期化 (GameStore コンストラクタから呼ばれる)
    // ============================================================
    /** state のマーカー関連フィールドにデフォルト値を設定する */
    ensureDefaults() {
        if (!this.state.markers) {
            this.state.markers = [];
        }
        if (this.state.activeMarkerLabel === undefined) {
            this.state.activeMarkerLabel = null;
        }
        if (!this.state.rootMarkers) {
            this.state.rootMarkers = [];
        }
        if (!this.state.nodeMarkers) {
            this.state.nodeMarkers = [];
        }
    }
    // ============================================================
    // 公開: マーカーモードとアクティブ種別の制御
    // ============================================================
    /**
     * マーカーモードのオン/オフとアクティブ種別をまとめて切り替える。
     *
     * 副作用: \`state.eraseMode\` が true の場合は自動的に false へ戻す
     * （マーカーモードと消去モードは排他。両方 ON は UI 不整合になるため）。
     */
    setMarkerModeDisablingErase(kind, label = null) {
        this.state.activeMarkerKind = kind;
        this.state.activeMarkerLabel = kind === 'LB' ? label : null;
        this.state.markerMode = kind !== null;
        if (this.state.eraseMode) {
            this.state.eraseMode = false;
        }
    }
    // ============================================================
    // 公開: マーカーの配置・削除
    // ============================================================
    /** アクティブ種別のマーカーを pos にトグル配置する。 */
    toggleMarker(pos, allowMulti = false) {
        var _a;
        const kind = this.state.activeMarkerKind;
        if (!kind)
            return false;
        if (!isValidPosition(this.state.boardSize, pos))
            return false;
        const label = (_a = this.state.activeMarkerLabel) !== null && _a !== void 0 ? _a : undefined;
        const existing = this.findMarkerAt(pos, kind, label);
        if (existing) {
            this.removeMarkerAt(pos, kind, label);
            return false;
        }
        if (!allowMulti) {
            const any = this.findMarkerAt(pos);
            if (any && !allowMulti) {
                this.removeMarkerAt(pos, any.kind, any.label);
            }
        }
        this.addMarkerAt(pos, kind, label);
        return true;
    }
    /** 明示的にマーカーを追加（同種がすでにある場合は何もしない） */
    addMarker(pos, kind, label) {
        if (!isValidPosition(this.state.boardSize, pos))
            return false;
        return this.addMarkerAt(pos, kind, label);
    }
    /** 指定種別のマーカーを削除。kind を省略すると pos の全マーカーを削除 */
    removeMarker(pos, kind, label) {
        if (!isValidPosition(this.state.boardSize, pos))
            return false;
        if (kind === undefined) {
            const before = this.state.markers.length;
            this.state.markers = this.state.markers.filter((m) => m.pos.col !== pos.col || m.pos.row !== pos.row);
            const changed = this.state.markers.length !== before;
            if (changed)
                this.persistMarkersToCurrentNode();
            return changed;
        }
        return this.removeMarkerAt(pos, kind, label);
    }
    /** 表示中ノードのマーカーを全消去 */
    clearMarkers() {
        if (this.state.markers.length === 0)
            return;
        this.state.markers = [];
        this.persistMarkersToCurrentNode();
    }
    // ============================================================
    // 公開: 永続スロット同期
    // ============================================================
    /**
     * sgfIndex に応じて state.markers を rootMarkers / nodeMarkers から復元する。
     * sgfIndex が変わったとき (setMoveIndex, undo, restoreHistorySnapshot 等) に呼ばれる。
     */
    syncToCurrentNode() {
        if (this.state.sgfIndex === 0) {
            this.state.markers = cloneMarkers(this.state.rootMarkers);
        }
        else {
            const slot = this.state.sgfIndex - 1;
            const slotMarkers = this.state.nodeMarkers[slot];
            this.state.markers = slotMarkers ? cloneMarkers(slotMarkers) : [];
        }
    }
    /** SGF パース結果から復元した問題図レベル/着手ノード別のマーカーをセット */
    setNodeMarkers(rootMarkers, nodeMarkers) {
        this.state.rootMarkers = rootMarkers.map((m) => ({ pos: { ...m.pos }, kind: m.kind }));
        this.state.nodeMarkers = nodeMarkers.map((group) => group.map((m) => ({ pos: { ...m.pos }, kind: m.kind })));
        this.syncToCurrentNode();
    }
    // ============================================================
    // Internal
    // ============================================================
    findMarkerAt(pos, kind, label) {
        return this.state.markers.find((m) => m.pos.col === pos.col &&
            m.pos.row === pos.row &&
            (kind === undefined || m.kind === kind) &&
            (label === undefined || m.label === label));
    }
    /**
     * 指定種別のマーカーを pos に追加する。
     *
     * 副作用:
     * - 永続スロット (rootMarkers / nodeMarkers) へ書き戻す
     * - LB 種別のとき \`activeMarkerLabel\` を次の文字へ自動進行
     *   （同じ文字の連続配置を防ぐ）
     */
    addMarkerAt(pos, kind, label) {
        const exists = this.state.markers.some((m) => m.pos.col === pos.col &&
            m.pos.row === pos.row &&
            m.kind === kind &&
            m.label === label);
        if (exists)
            return false;
        const marker = { pos: { col: pos.col, row: pos.row }, kind };
        if (label !== undefined)
            marker.label = label;
        this.state.markers.push(marker);
        this.persistMarkersToCurrentNode();
        if (kind === 'LB' && label) {
            this.state.activeMarkerLabel = nextMarkerLetter(label);
        }
        return true;
    }
    removeMarkerAt(pos, kind, label) {
        const before = this.state.markers.length;
        this.state.markers = this.state.markers.filter((m) => !(m.pos.col === pos.col &&
            m.pos.row === pos.row &&
            m.kind === kind &&
            (label === undefined || m.label === label)));
        const changed = this.state.markers.length !== before;
        if (changed)
            this.persistMarkersToCurrentNode();
        return changed;
    }
    /**
     * 表示中のマーカー一覧を、現在の sgfIndex に対応する永続スロットに書き戻す。
     * sgfIndex === 0 は問題図レベル（rootMarkers）、それ以降は nodeMarkers[sgfIndex - 1]。
     */
    persistMarkersToCurrentNode() {
        const clone = cloneMarkers(this.state.markers);
        if (this.state.sgfIndex === 0) {
            this.state.rootMarkers = clone;
        }
        else {
            const slot = this.state.sgfIndex - 1;
            this.state.nodeMarkers[slot] = clone;
        }
    }
}
//# sourceMappingURL=marker-store.js.map