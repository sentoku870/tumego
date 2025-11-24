// ============ メインゲームエンジン ============
import {
  GameState,
  Position,
  StoneColor,
  GroupInfo,
  Board,
  MoveResult
} from './types.js';

/**
 * Pure go board logic. All state mutations are delegated to {@link GameStore}.
 */
export class GoEngine {
  /**
   * Tracks the current ko point (if any) between consecutive moves. This keeps
   * the engine behavior aligned with the simple ko tests even when callers do
   * not persist ko metadata on their own state objects.
   */
  private koPoint: Position | null = null;

  playMove(
    state: GameState,
    pos: Position,
    color: StoneColor,
    boardOverride?: Board
  ): MoveResult | null {
    const board = boardOverride ?? this.cloneBoard(state.board);

    const applied = this.tryApplyMove(board, state.boardSize, pos, color);
    if (!applied) {
      return null;
    }

    this.koPoint = applied.koPoint;

    return { board, koPoint: this.koPoint, captured: applied.captured };
  }

  generateHandicapPositions(boardSize: number, stones: number): Position[] {
    const patterns = this.getHandicapPatterns(boardSize);
    if (!patterns) {
      return [];
    }

    const positions = patterns[stones];
    if (!positions) {
      return [];
    }

    return positions.map(pos => ({ ...pos }));
  }

  private tryApplyMove(
    board: Board,
    boardSize: number,
    pos: Position,
    color: StoneColor
  ): { board: Board; koPoint: Position | null; captured: Position[] } | null {
    if (!this.isValidPosition(boardSize, pos) || board[pos.row][pos.col] !== 0) {
      return null;
    }

    // Simple ko: if the position matches the current ko point, the move is illegal.
    if (this.koPoint && this.positionsEqual(this.koPoint, pos)) {
      return null;
    }

    board[pos.row][pos.col] = color;

    const opponent = (3 - color) as StoneColor;
    const captured: Position[] = [];

    // Capture any opponent groups with zero liberties after the placement.
    for (const neighbor of this.getNeighbors(pos, boardSize)) {
      if (board[neighbor.row][neighbor.col] !== opponent) {
        continue;
      }

      const group = this.getGroup(board, neighbor, boardSize);
      if (group.libs === 0) {
        captured.push(...group.stones);
      }
    }

    if (captured.length > 0) {
      this.removeStones(board, captured);
    }

    // Suicide check for the newly placed stone's group after captures.
    const selfGroup = this.getGroup(board, pos, boardSize);
    if (selfGroup.libs === 0) {
      // Illegal suicide; no state updates.
      return null;
    }

    // Determine ko: only when a single stone was captured and the new group
    // has exactly one liberty (the captured point), the opponent cannot
    // immediately recapture.
    const koPoint =
      captured.length === 1 && selfGroup.libs === 1 ? captured[0] : null;

    return { board, koPoint, captured };
  }

  private cloneBoard(board: Board): Board {
    return board.map(row => row.slice());
  }

  private removeStones(board: Board, stones: Position[]): void {
    stones.forEach(stone => {
      board[stone.row][stone.col] = 0;
    });
  }

  private getGroup(board: Board, pos: Position, boardSize: number): GroupInfo {
    const color = board[pos.row][pos.col];
    const visited = new Set<string>();
    const stones: Position[] = [];
    const stack: Position[] = [pos];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const key = `${current.col},${current.row}`;
      if (visited.has(key)) continue;

      visited.add(key);
      stones.push(current);

      this.getNeighbors(current, boardSize)
        .filter(neighbor => board[neighbor.row][neighbor.col] === color)
        .forEach(neighbor => stack.push(neighbor));
    }

    return { stones, libs: this.getGroupLiberties(board, stones, boardSize).length };
  }

  private getGroupLiberties(board: Board, stones: Position[], boardSize: number): Position[] {
    const liberties = new Set<string>();

    for (const stone of stones) {
      this.getNeighbors(stone, boardSize)
        .filter(neighbor => board[neighbor.row][neighbor.col] === 0)
        .forEach(liberty => liberties.add(`${liberty.col},${liberty.row}`));
    }

    return Array.from(liberties).map(key => {
      const [col, row] = key.split(',').map(Number);
      return { col, row };
    });
  }

  private getNeighbors(pos: Position, boardSize: number): Position[] {
    return [
      { col: pos.col - 1, row: pos.row },
      { col: pos.col + 1, row: pos.row },
      { col: pos.col, row: pos.row - 1 },
      { col: pos.col, row: pos.row + 1 }
    ].filter(neighbor => this.isValidPosition(boardSize, neighbor));
  }

  private isValidPosition(boardSize: number, pos: Position): boolean {
    return pos.col >= 0 && pos.col < boardSize && pos.row >= 0 && pos.row < boardSize;
  }

  private positionsEqual(a: Position, b: Position): boolean {
    return a.col === b.col && a.row === b.row;
  }

  private getHandicapPatterns(boardSize: number): Record<number, Position[]> | null {
    if (boardSize === 19) {
      const stars = this.createStarPoints(9, 3, 15);
      return {
        2: [stars.topRight, stars.bottomLeft],
        3: [stars.topRight, stars.bottomLeft, stars.bottomRight],
        4: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft],
        5: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.center],
        6: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide],
        7: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide, stars.center],
        8: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide, stars.topSide, stars.bottomSide],
        9: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide, stars.topSide, stars.bottomSide, stars.center]
      };
    }

    if (boardSize === 13) {
      const stars = this.createStarPoints(6, 3, 9);
      return {
        2: [stars.topRight, stars.bottomLeft],
        3: [stars.topRight, stars.bottomLeft, stars.bottomRight],
        4: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft],
        5: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.center],
        6: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide],
        7: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide, stars.center],
        8: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide, stars.topSide, stars.bottomSide],
        9: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide, stars.topSide, stars.bottomSide, stars.center]
      };
    }

    if (boardSize === 9) {
      const stars = this.createStarPoints(4, 2, 6);
      return {
        2: [stars.topRight, stars.bottomLeft],
        3: [stars.topRight, stars.bottomLeft, stars.bottomRight],
        4: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft],
        5: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.center],
        6: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide],
        7: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide, stars.center],
        8: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide, stars.topSide, stars.bottomSide],
        9: [stars.topRight, stars.topLeft, stars.bottomRight, stars.bottomLeft, stars.leftSide, stars.rightSide, stars.topSide, stars.bottomSide, stars.center]
      };
    }

    return null;
  }

  private createStarPoints(center: number, near: number, far: number) {
    return {
      topRight: { col: far, row: near },
      topLeft: { col: near, row: near },
      bottomRight: { col: far, row: far },
      bottomLeft: { col: near, row: far },
      center: { col: center, row: center },
      leftSide: { col: near, row: center },
      rightSide: { col: far, row: center },
      topSide: { col: center, row: near },
      bottomSide: { col: center, row: far }
    } as const;
  }
}
