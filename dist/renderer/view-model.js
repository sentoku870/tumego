// ============ 描画 ViewModel ビルダー ============
// 純粋関数群: GameState + Preferences から描画用の中間オブジェクトを生成する。
// DOM には一切触れないため、jsdom なしでテスト可能。
import { DEFAULT_CONFIG } from '../types.js';
import { toCircledNumber } from '../utils/format.js';
/** 1-50 を丸数字（①〜㊿）に変換する。範囲外は数字のまま。 */
export function getCircleNumber(n) {
    return toCircledNumber(n);
}
export class RendererGeometry {
    constructor(boardSize) {
        this.boardSize = boardSize;
        this.cellSize = DEFAULT_CONFIG.CELL_SIZE;
        this.margin = DEFAULT_CONFIG.MARGIN;
        this.viewBoxSize = this.cellSize * (boardSize - 1) + this.margin * 2;
        this.coordFontSize = this.cellSize * DEFAULT_CONFIG.COORD_FONT_RATIO;
        this.moveNumberFontSize = this.cellSize * DEFAULT_CONFIG.MOVE_NUM_FONT_RATIO;
        this.letters = 'ABCDEFGHJKLMNOPQRSTUV'.slice(0, boardSize).split('');
    }
    coordinateAt(index) {
        return this.margin + index * this.cellSize;
    }
    toPixel(pos) {
        return {
            cx: this.margin + pos.col * this.cellSize,
            cy: this.margin + pos.row * this.cellSize
        };
    }
}
export class RendererViewModelBuilder {
    constructor(store, getPreferences) {
        this.store = store;
        this.getPreferences = getPreferences;
    }
    // suppressLastMoveHighlight: true のときは「直前の手ハイライト」を出さない
    buildBoardModel(options) {
        const state = this.store.snapshot;
        const geometry = new RendererGeometry(state.boardSize);
        const prefs = this.getPreferences();
        const showMoveNumbers = state.numberMode && Boolean(prefs.solve.showSolutionMoveNumbers);
        const showCapturedStones = prefs.solve.showCapturedStones;
        const enableLastMoveHighlight = Boolean(prefs.solve.highlightLastMove) && !(options === null || options === void 0 ? void 0 : options.suppressLastMoveHighlight);
        return {
            geometry,
            stars: this.getStarPositions(state.boardSize),
            coordinates: this.buildCoordinateLabels(geometry),
            stones: this.buildStoneModels(state.board, geometry),
            moveNumbers: showMoveNumbers
                ? this.buildMoveNumberModels(state, geometry, showCapturedStones)
                : [],
            showMoveNumbers,
            lastMoveHighlight: enableLastMoveHighlight
                ? this.buildLastMoveHighlight(state, geometry)
                : undefined,
        };
    }
    buildInfoModel() {
        const state = this.store.snapshot;
        const colorText = { 1: '黒', 2: '白' };
        const modeText = state.numberMode
            ? '解答モード'
            : { black: '黒配置', white: '白配置', alt: '交互配置' }[state.mode];
        const moveInfo = state.sgfMoves.length > 0
            ? `　手数: ${state.sgfIndex}/${state.sgfMoves.length}`
            : '　手数: 0';
        const komiText = `　コミ: ${state.komi}目`;
        let handicapText = '';
        if (state.handicapStones > 0) {
            handicapText = `　${state.handicapStones}子局`;
        }
        else if (state.komi === 0) {
            handicapText = '　先番';
        }
        else {
            handicapText = '　互先';
        }
        const infoText = `${state.boardSize}路${handicapText} ${moveInfo.trim()} モード:${modeText} 手番:${colorText[this.store.currentColor]}`;
        return {
            infoText,
            movesText: this.buildMoveSequenceText(state)
        };
    }
    buildSliderModel() {
        const state = this.store.snapshot;
        return {
            max: state.sgfMoves.length,
            value: state.sgfIndex
        };
    }
    buildStoneModels(board, geometry) {
        const stones = [];
        for (let row = 0; row < geometry.boardSize; row++) {
            for (let col = 0; col < geometry.boardSize; col++) {
                const cellValue = board[row][col];
                if (cellValue === 0)
                    continue;
                const { cx, cy } = geometry.toPixel({ col, row });
                stones.push({
                    position: { col, row },
                    cx,
                    cy,
                    radius: DEFAULT_CONFIG.STONE_RADIUS,
                    fill: cellValue === 1 ? 'var(--black)' : 'var(--white)',
                    strokeWidth: cellValue === 1 ? 0 : 2
                });
            }
        }
        return stones;
    }
    // showCapturedStones:
    //   true  -> 抜き石の位置にも番号を描画
    //   false -> 盤上に残っている石の上にだけ番号を描画
    buildMoveNumberModels(state, geometry, showCapturedStones) {
        const start = state.numberStartIndex || 0;
        const numbers = [];
        for (let i = start; i < state.sgfIndex; i++) {
            const move = state.sgfMoves[i];
            if (!move)
                continue;
            // 「抜いた石を表示する」が OFF のときは、
            // すでに盤上に存在しない手（抜き石位置）はスキップする
            if (!showCapturedStones && state.board[move.row][move.col] === 0) {
                continue;
            }
            // 正しい描画色は sgfMoves の color
            const fill = move.color === 1 ? '#fff' : '#000';
            const { cx, cy } = geometry.toPixel({ col: move.col, row: move.row });
            numbers.push({
                cx,
                cy,
                fontSize: geometry.moveNumberFontSize,
                fill,
                text: (i - start + 1).toString()
            });
        }
        return numbers;
    }
    buildLastMoveHighlight(state, geometry) {
        if (state.sgfIndex <= 0 || state.sgfIndex > state.sgfMoves.length) {
            return undefined;
        }
        const lastMove = state.sgfMoves[state.sgfIndex - 1];
        if (!lastMove) {
            return undefined;
        }
        const { cx, cy } = geometry.toPixel({ col: lastMove.col, row: lastMove.row });
        return {
            cx,
            cy,
            radius: DEFAULT_CONFIG.STONE_RADIUS + DEFAULT_CONFIG.LAST_MOVE_HIGHLIGHT_OFFSET,
        };
    }
    buildCoordinateLabels(geometry) {
        const labels = [];
        const margin = geometry.margin;
        const bottom = geometry.viewBoxSize - margin;
        for (let i = 0; i < geometry.boardSize; i++) {
            const pos = geometry.coordinateAt(i);
            const col = geometry.letters[i];
            const row = geometry.boardSize - i;
            labels.push({
                text: col,
                x: pos,
                y: margin - 15,
                fontSize: geometry.coordFontSize,
                className: 'coord'
            });
            labels.push({
                text: col,
                x: pos,
                y: bottom + 15,
                fontSize: geometry.coordFontSize,
                className: 'coord'
            });
            labels.push({
                text: row.toString(),
                x: margin - 20,
                y: pos,
                fontSize: geometry.coordFontSize,
                className: 'coord'
            });
            labels.push({
                text: row.toString(),
                x: bottom + 20,
                y: pos,
                fontSize: geometry.coordFontSize,
                className: 'coord'
            });
        }
        return labels;
    }
    buildMoveSequenceText(state) {
        if (!state.numberMode || state.sgfMoves.length === 0) {
            return '';
        }
        const geometry = new RendererGeometry(state.boardSize);
        const start = state.numberStartIndex || 0;
        const sequence = [];
        for (let i = start; i < state.sgfIndex; i++) {
            const move = state.sgfMoves[i];
            const col = geometry.letters[move.col];
            const row = state.boardSize - move.row;
            const mark = move.color === 1 ? '■' : '□';
            const num = getCircleNumber(i - start + 1);
            sequence.push(`${mark}${num} ${col}${row}`);
        }
        return sequence.join(' ');
    }
    getStarPositions(boardSize) {
        const starMap = {
            9: [2, 4, 6],
            13: [3, 6, 9],
            19: [3, 9, 15]
        };
        const positions = starMap[boardSize] || [];
        const result = [];
        positions.forEach(x => {
            positions.forEach(y => {
                result.push({ col: x, row: y });
            });
        });
        return result;
    }
}
//# sourceMappingURL=view-model.js.map