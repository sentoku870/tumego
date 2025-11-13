export class VariationNavigator {
    constructor(state) {
        this.state = state;
    }
    // ============ 現在位置の情報取得 ============
    getCurrentPosition() {
        if (!this.state.gameTree)
            return null;
        const currentNode = this.state.gameTree.currentNode;
        const path = this.state.gameTree.currentPath;
        // 現在の手数を計算
        let moveNumber = 0;
        for (const node of path) {
            if (node.move)
                moveNumber++;
        }
        // 利用可能な分岐を取得
        const availableBranches = this.getAvailableBranches(currentNode);
        // 現在の経路情報
        const currentPath = this.buildCurrentPath(path);
        // 次の手の候補
        const nextMoves = this.getNextMoveCandidates(currentNode);
        // 総手数（現在選択されているパスの）
        const totalMoves = this.getTotalMovesInCurrentPath();
        return {
            moveNumber,
            totalMoves,
            availableBranches,
            currentPath,
            nextMoves
        };
    }
    // ============ 分岐選択処理 ============
    selectVariation(branchIndex) {
        if (!this.state.gameTree)
            return false;
        const currentNode = this.state.gameTree.currentNode;
        // 次の手として選択可能な分岐か確認
        if (!currentNode.children[branchIndex])
            return false;
        // 新しいノードを現在ノードに設定
        const newNode = currentNode.children[branchIndex];
        this.state.gameTree.currentNode = newNode;
        // 経路を更新
        this.updateCurrentPath();
        return true;
    }
    // ============ 自動進行制御 ============
    getDefaultNextMove() {
        if (!this.state.gameTree)
            return null;
        const currentNode = this.state.gameTree.currentNode;
        if (currentNode.children.length === 0) {
            return null; // 終端
        }
        // メインラインを優先
        const mainLineChild = currentNode.children.find(child => child.mainLine);
        if (mainLineChild) {
            return mainLineChild;
        }
        // メインラインがない場合は最初の子
        return currentNode.children[0];
    }
    // ============ 進行方向管理 ============
    canGoForward() {
        if (!this.state.gameTree)
            return false;
        return this.state.gameTree.currentNode.children.length > 0;
    }
    canGoBack() {
        if (!this.state.gameTree)
            return false;
        return this.state.gameTree.currentNode.parent !== undefined;
    }
    // 次の手に進む（選択された分岐ラインに沿って）
    moveForward() {
        const nextNode = this.getDefaultNextMove();
        if (!nextNode)
            return false;
        this.state.gameTree.currentNode = nextNode;
        this.updateCurrentPath();
        return true;
    }
    // 前の手に戻る
    moveBack() {
        if (!this.canGoBack())
            return false;
        this.state.gameTree.currentNode = this.state.gameTree.currentNode.parent;
        this.updateCurrentPath();
        return true;
    }
    // ============ 分岐情報構築 ============
    getAvailableBranches(node) {
        if (node.children.length <= 1)
            return [];
        return node.children.map((child, index) => {
            const moveCount = this.countMovesInBranch(child);
            const isMainLine = child.mainLine || false;
            const isCurrentPath = false; // 次の手の候補なので現在は false
            let label = '';
            if (child.label) {
                label = child.label;
            }
            else if (child.move) {
                const letters = 'ABCDEFGHJKLMNOPQRSTUV';
                const col = letters[child.move.col] || '?';
                const row = this.state.boardSize - child.move.row;
                const colorMark = child.move.color === 1 ? '●' : '○';
                label = `${colorMark}${col}${row}`;
            }
            else {
                label = `変化${index + 1}`;
            }
            return {
                nodeId: child.id,
                branchIndex: index,
                label,
                description: child.comment || '',
                moveCount,
                isMainLine,
                isCurrentPath
            };
        });
    }
    buildCurrentPath(path) {
        const result = [];
        let moveNumber = 0;
        for (let i = 0; i < path.length; i++) {
            const node = path[i];
            if (node.move) {
                moveNumber++;
                const isMainLine = node.mainLine || false;
                const branchIndex = node.parent ?
                    node.parent.children.indexOf(node) : 0;
                let description = '';
                if (node.label) {
                    description = node.label;
                }
                else if (node.move) {
                    const letters = 'ABCDEFGHJKLMNOPQRSTUV';
                    const col = letters[node.move.col] || '?';
                    const row = this.state.boardSize - node.move.row;
                    const colorMark = node.move.color === 1 ? '●' : '○';
                    description = `${colorMark}${col}${row}`;
                }
                result.push({
                    nodeId: node.id,
                    moveNumber,
                    isMainLine,
                    branchIndex,
                    description,
                    totalMoves: this.countMovesInBranch(node)
                });
            }
        }
        return result;
    }
    getNextMoveCandidates(node) {
        return node.children
            .filter(child => child.move)
            .map(child => ({ col: child.move.col, row: child.move.row }));
    }
    getTotalMovesInCurrentPath() {
        if (!this.state.gameTree)
            return 0;
        // 現在の経路の最後のノードから終端まで数える
        let count = 0;
        let currentNode = this.state.gameTree.currentNode;
        while (currentNode) {
            if (currentNode.move)
                count++;
            currentNode = currentNode.children[0]; // 最初の子を辿る
        }
        return count;
    }
    countMovesInBranch(node) {
        let count = 0;
        let currentNode = node;
        while (currentNode) {
            if (currentNode.move)
                count++;
            currentNode = currentNode.children[0]; // 最初の子を辿る
        }
        return count;
    }
    updateCurrentPath() {
        if (!this.state.gameTree)
            return;
        const path = [];
        let node = this.state.gameTree.currentNode;
        while (node) {
            path.unshift(node);
            node = node.parent;
        }
        this.state.gameTree.currentPath = path;
    }
    // ============ UI用データ生成 ============
    generateNavigationData() {
        const position = this.getCurrentPosition();
        if (!position) {
            return {
                currentMove: 0,
                totalMoves: 0,
                hasNext: false,
                hasPrev: false,
                branches: [],
                pathDisplay: 'メインライン'
            };
        }
        // 経路表示文字列を生成
        const pathDisplay = this.generatePathDisplay(position.currentPath);
        return {
            currentMove: position.moveNumber,
            totalMoves: position.totalMoves,
            hasNext: this.canGoForward(),
            hasPrev: this.canGoBack(),
            branches: position.availableBranches,
            pathDisplay
        };
    }
    generatePathDisplay(path) {
        if (path.length === 0)
            return 'ルート';
        const segments = [];
        let currentSegment = '';
        let lastBranchIndex = 0;
        for (const step of path) {
            if (step.branchIndex !== lastBranchIndex && currentSegment) {
                segments.push(currentSegment);
                currentSegment = '';
            }
            if (step.isMainLine) {
                currentSegment = currentSegment || 'メイン';
            }
            else {
                currentSegment = currentSegment || `変化${step.branchIndex + 1}`;
            }
            lastBranchIndex = step.branchIndex;
        }
        if (currentSegment) {
            segments.push(currentSegment);
        }
        return segments.join(' → ') || 'メインライン';
    }
}
//# sourceMappingURL=variation-navigator.js.map