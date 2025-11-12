// ============ メインゲームエンジン ============
import { DEFAULT_CONFIG } from './types.js';
export class GoEngine {
    constructor(state) {
        this.state = state;
    }
    // 履歴管理の設定
    setHistoryManager(historyManager) {
        this.historyManager = historyManager;
    }
    // ============ 着手処理 ============
    tryMove(pos, color, record = true) {
        if (!this.isValidPosition(pos) || this.state.board[pos.row][pos.col] !== 0) {
            return false;
        }
        const newBoard = this.cloneBoard();
        newBoard[pos.row][pos.col] = color;
        // 隣接相手石の捕獲処理
        const opponent = (3 - color);
        for (const neighbor of this.getNeighbors(pos)) {
            if (newBoard[neighbor.row][neighbor.col] === opponent) {
                const group = this.getGroup(newBoard, neighbor);
                if (this.getGroupLiberties(newBoard, group.stones).length === 0) {
                    this.removeStones(newBoard, group.stones);
                }
            }
        }
        // 自殺手チェック
        const selfGroup = this.getGroup(newBoard, pos);
        if (this.getGroupLiberties(newBoard, selfGroup.stones).length === 0) {
            return false;
        }
        // 着手を適用
        this.applyMove(newBoard, pos, color, record);
        return true;
    }
    // ============ 盤面管理 ============
    initBoard(size) {
        // 履歴保存（既存データがある場合）
        if (this.hasGameData()) {
            this.saveToHistory(`${this.state.boardSize}路盤（${this.state.sgfMoves.length}手）`);
        }
        this.state.boardSize = size;
        this.state.board = Array.from({ length: size }, () => Array(size).fill(0));
        this.resetGameState();
    }
    setMoveIndex(idx) {
        idx = Math.max(0, Math.min(idx, this.state.sgfMoves.length));
        // 盤面をリセット
        this.state.board = Array.from({ length: this.state.boardSize }, () => Array(this.state.boardSize).fill(0));
        this.state.history = [];
        this.state.turn = 0;
        // 置石を配置
        if (this.state.handicapPositions.length > 0) {
            this.state.handicapPositions.forEach(pos => {
                if (this.isValidPosition(pos)) {
                    this.state.board[pos.row][pos.col] = 1; // 黒石
                }
            });
        }
        if (this.state.whiteSetupPositions.length > 0) {
            this.state.whiteSetupPositions.forEach(pos => {
                if (this.isValidPosition(pos)) {
                    this.state.board[pos.row][pos.col] = 2; // 白石
                }
            });
        }
        // 指定された手数まで着手を再生
        for (let i = 0; i < idx; i++) {
            const move = this.state.sgfMoves[i];
            this.tryMove(move, move.color, false);
        }
        this.state.history = [];
        this.state.sgfIndex = idx;
        if (this.state.numberMode) {
            this.state.turn = Math.max(0, idx - this.state.numberStartIndex);
        }
        else {
            this.state.turn = idx;
        }
    }
    // ============ 手番管理 ============
    getCurrentColor() {
        if (this.state.numberMode) {
            return this.state.turn % 2 === 0 ? this.state.startColor : (3 - this.state.startColor);
        }
        if (this.state.mode === 'alt') {
            return this.state.turn % 2 === 0 ? this.state.startColor : (3 - this.state.startColor);
        }
        return this.state.mode === 'black' ? 1 : 2;
    }
    startNumberMode(color) {
        this.state.numberMode = true;
        this.state.startColor = color;
        this.state.numberStartIndex = this.state.sgfMoves.length;
        this.state.sgfIndex = this.state.sgfMoves.length;
        this.state.turn = 0;
        this.state.history = [];
    }
    // ============ グループと呼吸点 ============
    getGroup(board, pos) {
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
            this.getNeighbors(current)
                .filter(neighbor => board[neighbor.row][neighbor.col] === color)
                .forEach(neighbor => stack.push(neighbor));
        }
        return { stones, libs: this.getGroupLiberties(board, stones).length };
    }
    getGroupLiberties(board, stones) {
        const liberties = new Set();
        for (const stone of stones) {
            this.getNeighbors(stone)
                .filter(neighbor => board[neighbor.row][neighbor.col] === 0)
                .forEach(liberty => liberties.add(`${liberty.col},${liberty.row}`));
        }
        return Array.from(liberties).map(key => {
            const [col, row] = key.split(',').map(Number);
            return { col, row };
        });
    }
    getNeighbors(pos) {
        return [
            { col: pos.col - 1, row: pos.row },
            { col: pos.col + 1, row: pos.row },
            { col: pos.col, row: pos.row - 1 },
            { col: pos.col, row: pos.row + 1 }
        ].filter(neighbor => this.isValidPosition(neighbor));
    }
    // ============ ユーティリティ ============
    isValidPosition(pos) {
        return pos.col >= 0 && pos.col < this.state.boardSize &&
            pos.row >= 0 && pos.row < this.state.boardSize;
    }
    cloneBoard() {
        return this.state.board.map(row => row.slice());
    }
    removeStones(board, stones) {
        stones.forEach(stone => {
            board[stone.row][stone.col] = 0;
        });
    }
    applyMove(newBoard, pos, color, record) {
        this.state.history.push(this.cloneBoard());
        this.state.board = newBoard;
        this.state.turn++;
        if (record) {
            this.state.sgfMoves = this.state.sgfMoves.slice(0, this.state.sgfIndex);
            this.state.sgfMoves.push({ col: pos.col, row: pos.row, color });
            this.state.sgfIndex = this.state.sgfMoves.length;
        }
    }
    resetGameState() {
        this.state.history = [];
        this.state.turn = 0;
        this.state.sgfMoves = [];
        this.state.sgfIndex = 0;
        this.state.numberStartIndex = 0;
        this.state.eraseMode = false;
        this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI;
        this.state.handicapStones = 0;
        this.state.handicapPositions = [];
        this.state.whiteSetupPositions = [];
    }
    hasGameData() {
        return this.state.sgfMoves.length > 0 ||
            this.state.handicapStones > 0 ||
            this.state.whiteSetupPositions.length > 0 ||
            this.state.board.some(row => row.some(cell => cell !== 0));
    }
    saveToHistory(description) {
        // 履歴管理機能
        if (this.historyManager) {
            this.historyManager.save(description, this.state);
        }
        else {
            console.log(`履歴保存: ${description}`);
        }
    }
    // ============ 置石設定 ============
    setHandicap(stones) {
        if (this.hasGameData()) {
            this.saveToHistory(`置石変更前（${this.state.handicapStones}子）`);
        }
        if (stones === 'even') {
            // 互先（コミあり）
            this.initBoard(this.state.boardSize);
            this.state.handicapStones = 0;
            this.state.handicapPositions = [];
            this.state.whiteSetupPositions = [];
            this.state.komi = DEFAULT_CONFIG.DEFAULT_KOMI; // 6.5目
            this.state.startColor = 1; // 黒先
            return;
        }
        if (stones === 0) {
            // 先（コミなし）
            this.initBoard(this.state.boardSize);
            this.state.handicapStones = 0;
            this.state.handicapPositions = [];
            this.state.whiteSetupPositions = [];
            this.state.komi = 0; // コミなし
            this.state.startColor = 1; // 黒先
            return;
        }
        // 置石局の設定
        this.initBoard(this.state.boardSize);
        const handicapPositions = this.getHandicapPositions(this.state.boardSize, stones);
        console.log(`置石設定: ${stones}子, 位置:`, handicapPositions);
        // 置石を配置
        handicapPositions.forEach(pos => {
            if (this.isValidPosition(pos)) {
                this.state.board[pos.row][pos.col] = 1; // 黒石
                console.log(`置石配置: (${pos.col}, ${pos.row})`);
            }
        });
        this.state.handicapStones = stones;
        this.state.handicapPositions = handicapPositions;
        this.state.whiteSetupPositions = [];
        this.state.komi = 0; // 置石局はコミ0目
        this.state.startColor = 2; // 白番から開始
        this.state.turn = 0;
    }
    getHandicapPositions(boardSize, stones) {
        const positions = [];
        if (boardSize === 19) {
            // 19路盤の星の位置（黒視点）
            const starPoints = {
                topRight: { col: 15, row: 3 }, // 右上
                topLeft: { col: 3, row: 3 }, // 左上
                bottomRight: { col: 15, row: 15 }, // 右下
                bottomLeft: { col: 3, row: 15 }, // 左下
                center: { col: 9, row: 9 }, // 天元
                leftSide: { col: 3, row: 9 }, // 左辺
                rightSide: { col: 15, row: 9 }, // 右辺
                topSide: { col: 9, row: 3 }, // 上辺
                bottomSide: { col: 9, row: 15 } // 下辺
            };
            // 正しい置石パターン
            switch (stones) {
                case 2:
                    // 2子局: 右上・左下
                    positions.push(starPoints.topRight, starPoints.bottomLeft);
                    break;
                case 3:
                    // 3子局: 右上・左下・右下（左上を空ける）
                    positions.push(starPoints.topRight, starPoints.bottomLeft, starPoints.bottomRight);
                    break;
                case 4:
                    // 4子局: 四隅
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft);
                    break;
                case 5:
                    // 5子局: 四隅+天元
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.center);
                    break;
                case 6:
                    // 6子局: 四隅+左右辺
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide);
                    break;
                case 7:
                    // 7子局: 四隅+左右辺+天元
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide, starPoints.center);
                    break;
                case 8:
                    // 8子局: 四隅+左右辺+上下辺
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide, starPoints.topSide, starPoints.bottomSide);
                    break;
                case 9:
                    // 9子局: 全部
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide, starPoints.topSide, starPoints.bottomSide, starPoints.center);
                    break;
            }
        }
        else if (boardSize === 13) {
            // 13路盤の星の位置
            const starPoints = {
                topRight: { col: 9, row: 3 },
                topLeft: { col: 3, row: 3 },
                bottomRight: { col: 9, row: 9 },
                bottomLeft: { col: 3, row: 9 },
                center: { col: 6, row: 6 },
                leftSide: { col: 3, row: 6 },
                rightSide: { col: 9, row: 6 },
                topSide: { col: 6, row: 3 },
                bottomSide: { col: 6, row: 9 }
            };
            switch (stones) {
                case 2:
                    positions.push(starPoints.topRight, starPoints.bottomLeft);
                    break;
                case 3:
                    positions.push(starPoints.topRight, starPoints.bottomLeft, starPoints.bottomRight);
                    break;
                case 4:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft);
                    break;
                case 5:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.center);
                    break;
                case 6:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide);
                    break;
                case 7:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide, starPoints.center);
                    break;
                case 8:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide, starPoints.topSide, starPoints.bottomSide);
                    break;
                case 9:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide, starPoints.topSide, starPoints.bottomSide, starPoints.center);
                    break;
            }
        }
        else if (boardSize === 9) {
            // 9路盤の星の位置
            const starPoints = {
                topRight: { col: 6, row: 2 },
                topLeft: { col: 2, row: 2 },
                bottomRight: { col: 6, row: 6 },
                bottomLeft: { col: 2, row: 6 },
                center: { col: 4, row: 4 },
                leftSide: { col: 2, row: 4 },
                rightSide: { col: 6, row: 4 },
                topSide: { col: 4, row: 2 },
                bottomSide: { col: 4, row: 6 }
            };
            switch (stones) {
                case 2:
                    positions.push(starPoints.topRight, starPoints.bottomLeft);
                    break;
                case 3:
                    positions.push(starPoints.topRight, starPoints.bottomLeft, starPoints.bottomRight);
                    break;
                case 4:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft);
                    break;
                case 5:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.center);
                    break;
                case 6:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide);
                    break;
                case 7:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide, starPoints.center);
                    break;
                case 8:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide, starPoints.topSide, starPoints.bottomSide);
                    break;
                case 9:
                    positions.push(starPoints.topRight, starPoints.topLeft, starPoints.bottomRight, starPoints.bottomLeft, starPoints.leftSide, starPoints.rightSide, starPoints.topSide, starPoints.bottomSide, starPoints.center);
                    break;
            }
        }
        console.log(`${boardSize}路盤 ${stones}子局の置石位置:`, positions);
        return positions;
    }
    // ============ 公開メソッド ============
    getState() {
        return this.state;
    }
    undo() {
        if (this.state.numberMode) {
            this.state.sgfIndex = Math.max(this.state.numberStartIndex, this.state.sgfIndex - 1);
            this.setMoveIndex(this.state.sgfIndex);
            return true;
        }
        else if (this.state.turn > 0) {
            this.state.turn = Math.max(0, this.state.turn - 1);
            this.state.sgfIndex = Math.max(0, this.state.sgfIndex - 1);
            this.state.sgfMoves = this.state.sgfMoves.slice(0, this.state.sgfIndex);
            if (this.state.history[this.state.turn]) {
                this.state.board = this.cloneBoard2D(this.state.history[this.state.turn]);
            }
            else {
                this.state.board = Array.from({ length: this.state.boardSize }, () => Array(this.state.boardSize).fill(0));
                if (this.state.handicapPositions.length > 0) {
                    this.state.handicapPositions.forEach(pos => {
                        if (this.isValidPosition(pos)) {
                            this.state.board[pos.row][pos.col] = 1;
                        }
                    });
                }
                if (this.state.whiteSetupPositions.length > 0) {
                    this.state.whiteSetupPositions.forEach(pos => {
                        if (this.isValidPosition(pos)) {
                            this.state.board[pos.row][pos.col] = 2;
                        }
                    });
                }
            }
            this.state.history = this.state.history.slice(0, this.state.turn + 1);
            return true;
        }
        return false;
    }
    cloneBoard2D(board) {
        return board.map(row => row.slice());
    }
}
//# sourceMappingURL=go-engine.js.map