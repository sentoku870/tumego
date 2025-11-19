const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const clampCoord = (value) => Math.max(0, value);
const encodeCoordinate = (value) => LETTERS.charAt(clampCoord(value));
const buildSetupProperty = (property, positions) => {
    if (!positions || positions.length === 0) {
        return "";
    }
    const payload = positions
        .map((pos) => `[${encodeCoordinate(pos.col)}${encodeCoordinate(pos.row)}]`)
        .join("");
    return `${property}${payload}`;
};
export const buildProblemSGF = (boardSize, black, white) => {
    const header = `(;GM[1]FF[4]SZ[${boardSize}]`;
    return `${header}${buildSetupProperty("AB", black)}${buildSetupProperty("AW", white)})`;
};
export const buildSolutionSGF = (problemSGF, moves, boardSize) => {
    const base = (problemSGF || buildProblemSGF(boardSize, [], [])).trim();
    const normalized = base.endsWith(")") ? base.slice(0, -1) : base;
    const sequence = moves
        .map((move) => {
        const color = move.color === 1 ? "B" : "W";
        return `;${color}[${encodeCoordinate(move.col)}${encodeCoordinate(move.row)}]`;
    })
        .join("");
    return `${normalized}${sequence})`;
};
//# sourceMappingURL=sgf-builder.js.map