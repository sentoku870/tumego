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
            app.renderer.showMessage(`SGF読み込み完了 (${parsed.moves.length}手)`);
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