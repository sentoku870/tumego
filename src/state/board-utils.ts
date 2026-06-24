import { Board, CapturedCounts, CellState, GameState, Position } from "../types.js";

export function createEmptyBoard(size: number): Board {
  return Array.from({ length: size }, () => Array<CellState>(size).fill(0));
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

export function createInitialCapturedCounts(): CapturedCounts {
  return { black: 0, white: 0 };
}

export function isValidPosition(boardSize: number, pos: Position): boolean {
  return (
    pos.col >= 0 &&
    pos.col < boardSize &&
    pos.row >= 0 &&
    pos.row < boardSize
  );
}

export function hasGameData(state: GameState): boolean {
  return (
    state.sgfMoves.length > 0 ||
    state.handicapStones > 0 ||
    state.board.some((row) => row.some((cell) => cell !== 0))
  );
}
