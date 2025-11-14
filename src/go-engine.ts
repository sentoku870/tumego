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
  playMove(state: GameState, pos: Position, color: StoneColor): MoveResult | null {
    if (!this.isValidPosition(state.boardSize, pos) || state.board[pos.row][pos.col] !== 0) {
      return null;
    }

    const board = this.cloneBoard(state.board);
    board[pos.row][pos.col] = color;

    const opponent = (3 - color) as StoneColor;
    for (const neighbor of this.getNeighbors(pos, state.boardSize)) {
      if (board[neighbor.row][neighbor.col] !== opponent) {
        continue;
      }

      const group = this.getGroup(board, neighbor, state.boardSize);
      if (this.getGroupLiberties(board, group.stones, state.boardSize).length === 0) {
        this.removeStones(board, group.stones);
      }
    }

    const selfGroup = this.getGroup(board, pos, state.boardSize);
    if (this.getGroupLiberties(board, selfGroup.stones, state.boardSize).length === 0) {
      return null;
    }

    return { board };
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
