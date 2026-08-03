/**
 * (col, row) を SGF 文字列 ('aa' 〜 'ss') に変換する。
 */
export function positionToSgf(pos) {
    return `${String.fromCharCode(97 + pos.col)}${String.fromCharCode(97 + pos.row)}`;
}
/**
 * SGF 文字列 ('aa' 〜 'ss') を (col, row) に変換する。
 * 不正な文字列 (長さ ≠ 2、または a-z 外) は null を返す。
 */
export function sgfToPosition(coord) {
    if (coord.length !== 2)
        return null;
    const col = coord.charCodeAt(0) - 97;
    const row = coord.charCodeAt(1) - 97;
    if (col < 0 || col > 25 || row < 0 || row > 25)
        return null;
    return { col, row };
}
/**
 * (col, row) を `[aa]` 形式にラップして返す。
 */
export function positionToSgfBracket(pos) {
    return `[${positionToSgf(pos)}]`;
}
//# sourceMappingURL=sgf-coordinates.js.map