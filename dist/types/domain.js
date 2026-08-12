// ============ 基本型定義 ============
/** LB（ラベル）マーカーで自動進行する文字のシーケンス。配置ごとに次へ進む。 */
export const MARKER_LETTER_SEQUENCE = ['A', 'B', 'C', 'D', 'E'];
/** 次のラベル文字を返す（シーケンス末尾で先頭に戻る） */
export function nextMarkerLetter(current) {
    if (!current)
        return MARKER_LETTER_SEQUENCE[0];
    const idx = MARKER_LETTER_SEQUENCE.indexOf(current);
    if (idx < 0)
        return MARKER_LETTER_SEQUENCE[0];
    return MARKER_LETTER_SEQUENCE[(idx + 1) % MARKER_LETTER_SEQUENCE.length];
}
//# sourceMappingURL=domain.js.map