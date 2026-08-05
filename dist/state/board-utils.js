export function createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(0));
}
export function cloneBoard(board) {
    return board.map((row) => row.slice());
}
export function createInitialCapturedCounts() {
    return { black: 0, white: 0 };
}
export function isValidPosition(boardSize, pos) {
    return (pos.col >= 0 &&
        pos.col < boardSize &&
        pos.row >= 0 &&
        pos.row < boardSize);
}
export function hasGameData(state) {
    return (state.sgfMoves.length > 0 ||
        state.handicapStones > 0 ||
        state.board.some((row) => row.some((cell) => cell !== 0)));
}
/**
 * BoardMarker 配列の深いクローン。
 * - `undefined` 入力は空配列として扱う（mode-operations.ts の呼び出し互換）
 * - `label`（LB のテキスト）も含めてコピー（marker-store.ts の呼び出し互換）
 */
export function cloneMarkers(markers) {
    if (!markers)
        return [];
    return markers.map((m) => {
        const clone = { pos: { ...m.pos }, kind: m.kind };
        if (m.label !== undefined)
            clone.label = m.label;
        return clone;
    });
}
//# sourceMappingURL=board-utils.js.map