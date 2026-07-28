function countMainLineMoves(root) {
    var _a, _b;
    let count = 0;
    let node = (_a = root.children[0]) !== null && _a !== void 0 ? _a : null;
    while (node) {
        if (node.move)
            count++;
        node = (_b = node.children[0]) !== null && _b !== void 0 ? _b : null;
    }
    return count;
}
export function createDebugApi(app) {
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
//# sourceMappingURL=debug-api.js.map