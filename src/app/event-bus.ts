export type UIUpdateListener = () => void;
export type AnswerButtonListener = () => void;
export type EraseModeDisabler = () => void;
export type SgfAppliedListener = (sgfText: string) => void;

export class UIEventBus {
  private readonly uiUpdateListeners = new Set<UIUpdateListener>();
  private readonly answerButtonListeners = new Set<AnswerButtonListener>();
  private readonly eraseModeDisablers = new Set<EraseModeDisabler>();
  private readonly sgfAppliedListeners = new Set<SgfAppliedListener>();

  onUIUpdate(listener: UIUpdateListener): () => void {
    this.uiUpdateListeners.add(listener);
    return () => this.uiUpdateListeners.delete(listener);
  }

  emitUIUpdate(): void {
    this.uiUpdateListeners.forEach((listener) => listener());
  }

  onAnswerButtonUpdate(listener: AnswerButtonListener): () => void {
    this.answerButtonListeners.add(listener);
    return () => this.answerButtonListeners.delete(listener);
  }

  emitAnswerButtonUpdate(): void {
    this.answerButtonListeners.forEach((listener) => listener());
  }

  onEraseModeDisable(listener: EraseModeDisabler): () => void {
    this.eraseModeDisablers.add(listener);
    return () => this.eraseModeDisablers.delete(listener);
  }

  emitEraseModeDisable(): void {
    this.eraseModeDisablers.forEach((listener) => listener());
  }

  onSgfApplied(listener: SgfAppliedListener): () => void {
    this.sgfAppliedListeners.add(listener);
    return () => this.sgfAppliedListeners.delete(listener);
  }

  emitSgfApplied(sgfText: string): void {
    this.sgfAppliedListeners.forEach((listener) => listener(sgfText));
  }
}
