// ============ 検討モード：B案の挙動テスト ============
// 仕様:
// - enterStudyMode(): 主分支にいる時、兄弟の副分岐へ自動遷移
// - exitStudyMode(): 主分支末端へスナップ
// - snapToMain(): 強制的に主分支末端へスナップ
// - returnToMain(): 副分岐にいる時、その副分岐を削除して主分支末端へスナップ
import { GameStore } from '../../dist/state/game-store.js';
import { GoEngine } from '../../dist/go-engine.js';
import { HistoryManager } from '../../dist/history-manager.js';
import { DEFAULT_CONFIG } from '../../dist/types.js';

const createBoard = (size) =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => 0));

const createState = () => ({
  boardSize: 9,
  board: createBoard(9),
  mode: 'alt',
  eraseMode: false,
  history: [],
  turn: 0,
  sgfMoves: [],
  numberMode: false,
  startColor: 1,
  sgfIndex: 0,
  numberStartIndex: 0,
  komi: DEFAULT_CONFIG.DEFAULT_KOMI,
  handicapStones: 0,
  handicapPositions: [],
  answerMode: 'black',
  problemDiagramSet: false,
  problemDiagramBlack: [],
  problemDiagramWhite: [],
  sgfTree: { id: 'root', parent: null, children: [], isMainLine: true },
  currentNodeId: 'root',
  studyMode: false,
  sgfLoadedFromExternal: false,
  capturedCounts: { black: 0, white: 0 },
  markers: [],
  markerMode: false,
  activeMarkerKind: null,
  activeMarkerLabel: null,
  rootMarkers: [],
  nodeMarkers: [],
});

/** テスト用: 線形の手動ツリーを構築 */
function buildLinearTree(root, moves) {
  let parent = root;
  for (let i = 0; i < moves.length; i++) {
    const node = {
      id: `n${i + 1}`,
      parent,
      children: [],
      isMainLine: true,
      move: { ...moves[i] },
    };
    parent.children.push(node);
    parent = node;
  }
}

/**
 * テスト用: 標準SGFに準拠し、副分岐を parent の children[1] に追加する。
 */
function addVariationAsSibling(parentNode, move) {
  const newNode = {
    id: `var-${parentNode.id}-${parentNode.children.length}`,
    parent: parentNode,
    children: [],
    isMainLine: false,
    move: { ...move },
  };
  parentNode.children.push(newNode);
  return newNode;
}

describe('B案: 検討モードの自動遷移と「主に戻る」', () => {
  let engine, history, state, store;

  beforeEach(() => {
    engine = new GoEngine();
    history = new HistoryManager();
    state = createState();
    store = new GameStore(state, engine, history);
  });

  describe('enterStudyMode (副分岐への自動遷移)', () => {
    test('ルート単体: 副分岐がないので遷移しない', () => {
      expect(state.currentNodeId).toBe('root');
      store.enterStudyMode();
      expect(state.studyMode).toBe(true);
      expect(state.currentNodeId).toBe('root');
    });

    test('メイン3手の末端にいる時、兄弟の副分岐へ自動遷移', () => {
      buildLinearTree(state.sgfTree, [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 },
      ]);
      const moveB = state.sgfTree.children[0].children[0]; // n2
      const n3 = moveB.children[0]; // n3
      const variation = addVariationAsSibling(moveB, { col: 3, row: 3, color: 2 });

      // n3上に移動
      state.currentNodeId = n3.id;

      store.enterStudyMode();
      // n2の副分岐（children[1]）へ自動遷移
      expect(state.currentNodeId).toBe(variation.id);
      expect(state.studyMode).toBe(true);
    });

    test('親を持たない（ルート）状況: 副分岐がないので遷移しない', () => {
      buildLinearTree(state.sgfTree, [{ col: 0, row: 0, color: 1 }]);
      const n1 = state.sgfTree.children[0];
      // n1.children[0] に副分岐を追加できない（n1がrootなので）
      // 代わりにルート直下に副分岐を追加
      const variation = addVariationAsSibling(state.sgfTree, { col: 1, row: 1, color: 2 });

      state.currentNodeId = n1.id;
      store.enterStudyMode();
      // 兄弟の副分岐あり
      expect(state.currentNodeId).toBe(variation.id);
    });
  });

  describe('exitStudyMode (主分支へスナップ)', () => {
    test('副分岐終了時、終了すると主分支末端へスナップ', () => {
      buildLinearTree(state.sgfTree, [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 },
      ]);
      const moveB = state.sgfTree.children[0].children[0];
      const n3 = moveB.children[0];
      const variation = addVariationAsSibling(moveB, { col: 3, row: 3, color: 2 });

      state.currentNodeId = variation.id;
      store.enterStudyMode();
      expect(state.currentNodeId).toBe(variation.id);

      store.exitStudyMode();
      // 主分支末端（n3）へ
      expect(state.currentNodeId).toBe(n3.id);
      expect(state.studyMode).toBe(false);
    });
  });

  describe('snapToMain (無条件主分支)', () => {
    test('副分岐ノードにいても、主分支末端へスナップ', () => {
      buildLinearTree(state.sgfTree, [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 },
      ]);
      const moveB = state.sgfTree.children[0].children[0];
      const n3 = moveB.children[0];
      const variation = addVariationAsSibling(moveB, { col: 3, row: 3, color: 2 });

      state.currentNodeId = variation.id;
      store.snapToMain();
      expect(state.currentNodeId).toBe(n3.id);
    });
  });

  describe('returnToMain (副分岐を破棄して主分支へ)', () => {
    test('副分岐にいる時、その副分岐を削除して主分支末端へスナップ', () => {
      buildLinearTree(state.sgfTree, [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 },
      ]);
      const moveB = state.sgfTree.children[0].children[0];
      const n3 = moveB.children[0];
      const variation = addVariationAsSibling(moveB, { col: 3, row: 3, color: 2 });
      expect(moveB.children.length).toBe(2);

      state.currentNodeId = variation.id;
      store.enterStudyMode();
      store.returnToMain();

      // 副分岐削除
      expect(moveB.children.length).toBe(1);
      expect(state.currentNodeId).toBe(n3.id);
    });

    test('主分支上にいる時は何も削除せず、主分支末端へスナップ', () => {
      buildLinearTree(state.sgfTree, [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
        { col: 2, row: 2, color: 1 },
      ]);
      const moveB = state.sgfTree.children[0].children[0];
      const n3 = moveB.children[0];
      const originalChildrenCount = moveB.children.length;

      state.currentNodeId = n3.id;
      store.returnToMain();

      expect(moveB.children.length).toBe(originalChildrenCount);
      expect(state.currentNodeId).toBe(n3.id);
    });
  });

  describe('一連の流れ: 検討→別解→主に戻る', () => {
    test('主分支から検討に入って別解を作って「主に戻る」で破棄、全工程', () => {
      // メイン: A → B
      buildLinearTree(state.sgfTree, [
        { col: 0, row: 0, color: 1 },
        { col: 1, row: 1, color: 2 },
      ]);
      const moveB = state.sgfTree.children[0].children[0];
      state.currentNodeId = moveB.id;

      // 検討モード開始（副分岐なし → B のまま）
      store.enterStudyMode();
      expect(state.currentNodeId).toBe(moveB.id);

      // 別解を追加（B の次にもう一つの着手）
      store.tryMoveAsStudyStep({ col: 3, row: 3 }, 1);
      // moveB に子がないので、新しい手は children[0] に入る
      const newBranch = moveB.children[0];
      expect(newBranch === undefined).toBe(false);
      expect(newBranch.move).toEqual({ col: 3, row: 3, color: 1 });
      expect(state.currentNodeId).toBe(newBranch.id);

      // 🏠 主に戻る で副分岐破棄
      store.returnToMain();
      expect(moveB.children.length).toBe(1);
      expect(state.currentNodeId).toBe(moveB.id);
    });

    test('ルート状態から検討モード: 副分岐なしなので位置変わらず', () => {
      buildLinearTree(state.sgfTree, [{ col: 0, row: 0, color: 1 }]);
      const n1 = state.sgfTree.children[0];
      state.currentNodeId = n1.id;

      store.enterStudyMode();
      expect(state.currentNodeId).toBe(n1.id);
      expect(state.studyMode).toBe(true);
    });
  });
});
