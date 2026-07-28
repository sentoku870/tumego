import { AppContext } from './composition-root.js';
import { SGFNode } from '../types.js';

export interface DebugApi {
  loadSGF(text: string): void;
  exportSGF(): string;
  reset(): void;
  getStore(): AppContext['store'];
}

function countMainLineMoves(root: SGFNode): number {
  let count = 0;
  let node: SGFNode | null = root.children[0] ?? null;
  while (node) {
    if (node.move) count++;
    node = node.children[0] ?? null;
  }
  return count;
}

export function createDebugApi(app: AppContext): DebugApi {
  return {
    loadSGF(text) {
      const parsed = app.sgfService.parse(text);
      const result = app.sgfService.apply(parsed);
      app.renderer.updateBoardSize();
      app.eventBus.emitUIUpdate();
      app.eventBus.emitAnswerButtonUpdate();
      app.eventBus.emitSgfApplied(result.sgfText);
      app.controllers.file.syncHeaderEditor();
      const moveCount = countMainLineMoves(parsed.rootNode);
      app.renderer.showMessage(`SGF読み込み完了 (${moveCount}手)`);
    },
    exportSGF() {
      return app.sgfService.export();
    },
    reset() {
      app.store.resetForClearAll();
      app.eventBus.emitUIUpdate();
      app.eventBus.emitAnswerButtonUpdate();
    },
    getStore() {
      return app.store;
    }
  };
}
