export class TreeNavigator {
    constructor(state) {
        this.state = state;
    }
    // ============ ツリー構造生成 ============
    generateTree() {
        if (!this.state.gameTree)
            return null;
        const rootNode = this.state.gameTree.rootNode;
        const currentNode = this.state.gameTree.currentNode;
        return this.buildTreeNode(rootNode, null, 0, currentNode);
    }
    buildTreeNode(sgfNode, parent, depth, currentSGFNode) {
        const moveNumber = this.calculateMoveNumber(sgfNode, parent);
        const isCurrent = sgfNode === currentSGFNode;
        const treeNode = {
            id: `tree_${sgfNode.id}`,
            nodeId: sgfNode.id,
            moveNumber,
            move: sgfNode.move,
            label: this.generateNodeLabel(sgfNode, moveNumber),
            description: sgfNode.comment || '',
            isMainLine: sgfNode.mainLine || false,
            isCurrent,
            depth,
            children: [],
            parent: parent || undefined,
            isExpanded: depth < 3 || this.isOnCurrentPath(sgfNode, currentSGFNode), // 最初3階層まで展開
            hasChildren: sgfNode.children.length > 0
        };
        // 子ノードを再帰的に構築
        treeNode.children = sgfNode.children.map(child => this.buildTreeNode(child, treeNode, depth + 1, currentSGFNode));
        return treeNode;
    }
    calculateMoveNumber(sgfNode, parent) {
        if (!sgfNode.move)
            return parent ? parent.moveNumber : 0;
        return parent ? parent.moveNumber + 1 : 1;
    }
    generateNodeLabel(sgfNode, moveNumber) {
        // このメソッドは元のラベル生成ロジックを維持し、
        // 丸い手番表示はrenderTreeNodeで行う
        if (!sgfNode.move) {
            return sgfNode.label || 'ルート';
        }
        const letters = 'ABCDEFGHJKLMNOPQRSTUV';
        const col = letters[sgfNode.move.col] || '?';
        const row = this.state.boardSize - sgfNode.move.row;
        // const colorSymbol = sgfNode.move.color === 1 ? '●' : '○'; // ここでは使わない
        let label = `${col}${row}`; // 手数は別途表示するので、ここでは座標のみ
        if (sgfNode.label) {
            label += ` (${sgfNode.label})`;
        }
        return label;
    }
    isOnCurrentPath(sgfNode, currentSGFNode) {
        let node = currentSGFNode;
        while (node) {
            if (node === sgfNode)
                return true;
            node = node.parent;
        }
        return false;
    }
    // ============ HTML生成とDOM更新のためのメソッドを追加 ============
    // ツリーの内容をDOMコンテナにレンダリング
    updateTreeContent(container, treeRoot) {
        container.innerHTML = this.generateTreeHTML(treeRoot);
    }
    // 生成したツリーHTMLにイベントリスナーをアタッチ
    attachTreeEventListeners(container, selectNodeCallback) {
        // 展開/折りたたみアイコンのイベント
        container.querySelectorAll('.tree-expand-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const nodeId = e.target.dataset.nodeId;
                if (nodeId && this.state.gameTree) {
                    const currentTree = this.generateTree(); // 最新のツリーデータを再生成
                    if (currentTree && this.toggleNode(nodeId.replace('tree_', ''), currentTree)) { // 'tree_' を削除
                        this.updateTreeContent(container, currentTree); // DOMを更新
                        this.attachTreeEventListeners(container, selectNodeCallback); // イベントリスナーを再アタッチ
                        this.scrollToCurrentNode(container); // 現在ノードにスクロール
                    }
                }
            });
        });
        // ノードラベルのクリックイベント (ノード選択)
        container.querySelectorAll('.tree-node-label, .move-number-circle').forEach(element => {
            element.addEventListener('click', (e) => {
                const targetNode = e.target;
                let nodeId;
                // 親要素を辿ってdata-node-idを探す
                let currentElement = targetNode;
                while (currentElement && !nodeId) {
                    nodeId = currentElement.dataset.nodeId;
                    currentElement = currentElement.parentElement;
                }
                if (nodeId) {
                    selectNodeCallback(nodeId); // UIControllerのselectNodeByIdを呼び出す
                }
            });
        });
        // 「全て折りたたむ」「全て展開」ボタンのイベント
        const collapseAllBtn = container.querySelector('#tree-collapse-all');
        const expandAllBtn = container.querySelector('#tree-expand-all');
        if (collapseAllBtn) {
            collapseAllBtn.addEventListener('click', () => {
                if (this.state.gameTree) {
                    const currentTree = this.generateTree();
                    if (currentTree) {
                        this.collapseAll(currentTree);
                        this.updateTreeContent(container, currentTree);
                        this.attachTreeEventListeners(container, selectNodeCallback);
                        this.scrollToCurrentNode(container);
                    }
                }
            });
        }
        if (expandAllBtn) {
            expandAllBtn.addEventListener('click', () => {
                if (this.state.gameTree) {
                    const currentTree = this.generateTree();
                    if (currentTree) {
                        this.expandAll(currentTree);
                        this.updateTreeContent(container, currentTree);
                        this.attachTreeEventListeners(container, selectNodeCallback);
                        this.scrollToCurrentNode(container);
                    }
                }
            });
        }
    }
    // 現在のノードまでツリービューをスクロール
    scrollToCurrentNode(container) {
        const currentElement = container.querySelector('.tree-node.current');
        if (currentElement) {
            currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    // ツリーの内容をクリア
    clear(container) {
        container.innerHTML = '<div class="tree-empty">ツリーデータがありません</div>';
    }
    // ツリー構造全体をHTML文字列として生成
    generateTreeHTML(treeNode) {
        if (!treeNode)
            return '<div class="tree-empty">ツリーデータがありません</div>';
        return `
      <div class="tree-container">
        <div class="tree-header">
          <strong>🌳 手順ツリー</strong>
          <div>
            <button class="tree-collapse-all" id="tree-collapse-all">全て折りたたむ</button>
            <button class="tree-expand-all" id="tree-expand-all">全て展開</button>
          </div>
        </div>
        <div class="tree-content">
          ${this.renderTreeNode(treeNode)}
        </div>
      </div>
    `;
    }
    renderTreeNode(node) {
        const isCurrentClass = node.isCurrent ? ' current' : '';
        const isMainLineClass = node.isMainLine ? ' main-line' : '';
        const hasChildrenClass = node.hasChildren ? ' has-children' : '';
        const expandedClass = node.isExpanded ? ' expanded' : '';
        const expandIcon = node.hasChildren ?
            (node.isExpanded ? '▼' : '▶') : ' '; // 空白で揃える
        // 手番を表すクラス
        const moveColorClass = node.move ? (node.move.color === 1 ? 'black-move-circle' : 'white-move-circle') : '';
        // ルートノードの最初のアイコン
        const rootIcon = node.moveNumber === 0 && node.children.length > 0 ? `<span class="tree-expand-icon" data-node-id="${node.nodeId}">+</span>` : '';
        let nodeHTML = `
      <div class="tree-node${isCurrentClass}${isMainLineClass}${hasChildrenClass}${expandedClass}"
           data-node-id="${node.nodeId}" 
           data-depth="${node.depth}"
           style="--tree-depth: ${node.depth};"> <!-- CSS変数を追加 -->
        <div class="tree-node-content">
          ${node.moveNumber === 0 ? rootIcon : ''} <!-- ルートノードのみ+アイコン -->
    `;
        if (node.moveNumber > 0) { // ルートノード以外で手数を表示
            nodeHTML += `
          <div class="move-number-circle ${moveColorClass}${node.isCurrent ? ' current-move-circle' : ''}" data-node-id="${node.nodeId}">
            ${node.moveNumber}
          </div>
      `;
        }
        else if (node.moveNumber === 0 && !node.children.length) { // 手数のないルートノードで子ノードがない場合
            nodeHTML += `<span class="tree-expand-placeholder">●</span>`;
        }
        if (node.moveNumber > 0) { // ルートノード以外でラベルを表示
            nodeHTML += `
          <span class="tree-node-label" data-node-id="${node.nodeId}">
            ${node.label}
          </span>
      `;
        }
        else { // ルートノードのラベル
            nodeHTML += `
          <span class="tree-node-label root-label" data-node-id="${node.nodeId}">
            ${node.label}
          </span>
      `;
        }
        if (node.isMainLine && node.moveNumber > 0) {
            nodeHTML += `<span class="main-line-badge">本譜</span>`;
        }
        if (node.description) {
            nodeHTML += `
        <span class="tree-node-desc">${node.description}</span>
      `;
        }
        nodeHTML += `
        </div>
      </div>
    `;
        // 子ノードを展開状態に応じて表示
        if (node.hasChildren && node.isExpanded) {
            for (const child of node.children) {
                nodeHTML += this.renderTreeNode(child);
            }
        }
        return nodeHTML;
    }
    // ============ ツリー操作 ============
    // ツリーデータを操作するメソッドは、UI表示ロジックからは切り離されている
    // generateTree()で現在のUIStateに基づいてツリーデータを生成し直す
    toggleNode(nodeId, treeRoot) {
        const node = this.findNodeById(treeRoot, nodeId); // treeRootに対して操作
        if (node && node.hasChildren) {
            node.isExpanded = !node.isExpanded;
            return true;
        }
        return false;
    }
    expandAll(treeRoot) {
        this.setAllExpanded(treeRoot, true);
    }
    collapseAll(treeRoot) {
        this.setAllExpanded(treeRoot, false);
    }
    setAllExpanded(node, expanded) {
        if (node.hasChildren) {
            node.isExpanded = expanded;
        }
        for (const child of node.children) {
            this.setAllExpanded(child, expanded);
        }
    }
    findNodeById(treeNode, nodeId) {
        if (treeNode.nodeId === nodeId)
            return treeNode;
        for (const child of treeNode.children) {
            const found = this.findNodeById(child, nodeId);
            if (found)
                return found;
        }
        return null;
    }
    // ============ 分岐候補手取得 ============
    getNextMoveCandidates() {
        if (!this.state.gameTree)
            return [];
        const currentNode = this.state.gameTree.currentNode;
        const candidates = [];
        currentNode.children.forEach((childNode, index) => {
            if (childNode.move) {
                const letters = 'ABCDEFGHJKLMNOPQRSTUV';
                const label = letters[index] || `${index + 1}`;
                candidates.push({
                    position: { col: childNode.move.col, row: childNode.move.row },
                    branchIndex: index,
                    label
                });
            }
        });
        return candidates;
    }
    // ============ ノード選択 ============
    // このメソッドはSGFNodeレベルでゲームツリーの状態を更新する
    selectNodeById(nodeId) {
        if (!this.state.gameTree)
            return false;
        const targetNode = this.findSGFNodeById(this.state.gameTree.rootNode, nodeId);
        if (!targetNode)
            return false;
        // 現在ノードを更新
        this.state.gameTree.currentNode = targetNode;
        // 経路を更新
        this.updateCurrentPath(targetNode);
        return true;
    }
    findSGFNodeById(node, nodeId) {
        if (node.id === nodeId)
            return node;
        for (const child of node.children) {
            const found = this.findSGFNodeById(child, nodeId);
            if (found)
                return found;
        }
        return null;
    }
    updateCurrentPath(targetNode) {
        if (!this.state.gameTree)
            return;
        const path = [];
        let node = targetNode;
        while (node) {
            path.unshift(node);
            node = node.parent;
        }
        this.state.gameTree.currentPath = path;
    }
    // ============ 分岐選択（盤面マーカーから） ============
    selectBranchByIndex(branchIndex) {
        if (!this.state.gameTree)
            return false;
        const currentNode = this.state.gameTree.currentNode;
        if (branchIndex < 0 || branchIndex >= currentNode.children.length) {
            return false;
        }
        const targetNode = currentNode.children[branchIndex];
        return this.selectNodeById(targetNode.id);
    }
}
//# sourceMappingURL=tree-viewer.js.map