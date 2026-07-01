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
//# sourceMappingURL=board-utils.js.map