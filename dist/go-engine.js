/**
 * Pure go board logic. All state mutations are delegated to {@link GameStore}.
 */
export class GoEngine {
    playMove(state, pos, color, boardOverride) {
        const board = boardOverride !== null && boardOverride !== void 0 ? boardOverride : this.cloneBoard(state.board);
        if (!this.tryApplyMove(board, state.boardSize, pos, color)) {
            return null;
        }
        return { board };
    }
    generateHandicapPositions(boardSize, stones) {
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
    tryApplyMove(board, boardSize, pos, color) {
        if (!this.isValidPosition(boardSize, pos) || board[pos.row][pos.col] !== 0) {
            return false;
        }
        board[pos.row][pos.col] = color;
        const opponent = (3 - color);
        for (const neighbor of this.getNeighbors(pos, boardSize)) {
            if (board[neighbor.row][neighbor.col] !== opponent) {
                continue;
            }
            const group = this.getGroup(board, neighbor, boardSize);
            if (this.getGroupLiberties(board, group.stones, boardSize).length === 0) {
                this.removeStones(board, group.stones);
            }
        }
        const selfGroup = this.getGroup(board, pos, boardSize);
        if (this.getGroupLiberties(board, selfGroup.stones, boardSize).length === 0) {
            board[pos.row][pos.col] = 0;
            return false;
        }
        return true;
    }
    cloneBoard(board) {
        return board.map(row => row.slice());
    }
    removeStones(board, stones) {
        stones.forEach(stone => {
            board[stone.row][stone.col] = 0;
        });
    }
    getGroup(board, pos, boardSize) {
        const color = board[pos.row][pos.col];
        const visited = new Set();
        const stones = [];
        const stack = [pos];
        while (stack.length > 0) {
            const current = stack.pop();
            const key = `${current.col},${current.row}`;
            if (visited.has(key))
                continue;
            visited.add(key);
            stones.push(current);
            this.getNeighbors(current, boardSize)
                .filter(neighbor => board[neighbor.row][neighbor.col] === color)
                .forEach(neighbor => stack.push(neighbor));
        }
        return { stones, libs: this.getGroupLiberties(board, stones, boardSize).length };
    }
    getGroupLiberties(board, stones, boardSize) {
        const liberties = new Set();
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
    getNeighbors(pos, boardSize) {
        return [
            { col: pos.col - 1, row: pos.row },
            { col: pos.col + 1, row: pos.row },
            { col: pos.col, row: pos.row - 1 },
            { col: pos.col, row: pos.row + 1 }
        ].filter(neighbor => this.isValidPosition(boardSize, neighbor));
    }
    isValidPosition(boardSize, pos) {
        return pos.col >= 0 && pos.col < boardSize && pos.row >= 0 && pos.row < boardSize;
    }
    getHandicapPatterns(boardSize) {
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
    createStarPoints(center, near, far) {
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
        };
    }
}
//# sourceMappingURL=go-engine.js.map