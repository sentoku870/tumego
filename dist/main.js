// ============ メインエントリーポイント ============
import { DEFAULT_CONFIG } from './types.js';
import { UIController } from './ui-controller.js';
class BoardImageError extends Error {
    constructor(message, code = 'detect-failed') {
        super(message);
        this.code = code;
        this.name = 'BoardImageError';
    }
}
class BoardImageImporter {
    constructor(uiController) {
        this.uiController = uiController;
        this.analyzing = false;
        const canvas = document.getElementById('goban-canvas');
        if (!canvas) {
            throw new Error('解析用キャンバスが見つかりません');
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas がサポートされていません');
        }
        this.canvas = canvas;
        this.ctx = ctx;
        this.fileInput = this.ensureFileInput();
        this.bindUI();
    }
    ensureFileInput() {
        let input = document.getElementById('board-image-input');
        if (!input) {
            input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.id = 'board-image-input';
            input.hidden = true;
            document.body.appendChild(input);
        }
        return input;
    }
    bindUI() {
        const button = document.getElementById('btn-feature-board-image');
        button === null || button === void 0 ? void 0 : button.addEventListener('click', () => {
            void this.handleButtonClick();
        });
        this.fileInput.addEventListener('change', async (event) => {
            var _a;
            const target = event.target;
            const file = (_a = target.files) === null || _a === void 0 ? void 0 : _a[0];
            target.value = '';
            if (!file)
                return;
            try {
                await this.processImageBlob(file, 'file');
            }
            catch (error) {
                this.handleProcessingError(error, 'file');
            }
        });
    }
    async handleButtonClick() {
        const clipboardHandled = await this.tryClipboardImage();
        if (!clipboardHandled) {
            this.openFileDialog();
        }
    }
    async tryClipboardImage() {
        const clipboard = navigator.clipboard;
        if (!clipboard || typeof clipboard.read !== 'function') {
            return false;
        }
        try {
            const items = await clipboard.read();
            for (const item of items) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (!imageType)
                    continue;
                const blob = await item.getType(imageType);
                try {
                    await this.processImageBlob(blob, 'clipboard');
                    return true;
                }
                catch (error) {
                    if (error instanceof BoardImageError && error.code === 'not-go') {
                        this.uiController.showMessage('クリップボード画像は囲碁盤面ではない可能性があります。画像ファイルを選択してください。');
                        this.openFileDialog();
                        return true;
                    }
                    this.handleProcessingError(error, 'clipboard');
                    return false;
                }
            }
            return false;
        }
        catch (error) {
            console.warn('クリップボード画像の取得に失敗しました:', error);
            return false;
        }
    }
    openFileDialog() {
        this.fileInput.click();
    }
    async processImageBlob(blob, source) {
        if (this.analyzing)
            return;
        this.analyzing = true;
        try {
            const imageData = await this.drawBlobToCanvas(blob);
            const grayscale = this.toGrayscale(imageData);
            const detection = this.detectGrid(grayscale, imageData.width, imageData.height);
            if (source === 'clipboard' && !this.isLikelyGoBoard(detection)) {
                throw new BoardImageError('Clipboard image is not a Go board', 'not-go');
            }
            const finalSize = await this.resolveBoardSize(detection);
            if (!finalSize) {
                throw new BoardImageError('ユーザーがキャンセルしました', 'user-cancelled');
            }
            const stones = this.classifyStones(grayscale, imageData.width, imageData.height, detection, finalSize);
            const sgf = this.generateSGF(finalSize, stones);
            const message = this.composeMessage(finalSize, stones, detection, source);
            this.uiController.importSGFString(sgf, message);
        }
        finally {
            this.analyzing = false;
        }
    }
    handleProcessingError(error, source) {
        if (error instanceof BoardImageError) {
            if (error.code === 'user-cancelled') {
                this.uiController.showMessage('盤面画像の読込をキャンセルしました');
                return;
            }
            this.uiController.showMessage(error.message);
            return;
        }
        console.error('盤面画像解析エラー:', error);
        const prefix = source === 'clipboard' ? 'クリップボード画像の解析に失敗しました' : '画像ファイルの解析に失敗しました';
        this.uiController.showMessage(`${prefix}`);
    }
    async drawBlobToCanvas(blob) {
        const source = await this.loadCanvasSource(blob);
        const maxDimension = 1024;
        const width = source.width;
        const height = source.height;
        if (width === 0 || height === 0) {
            throw new BoardImageError('画像の読み込みに失敗しました');
        }
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const drawWidth = Math.max(1, Math.round(width * scale));
        const drawHeight = Math.max(1, Math.round(height * scale));
        this.canvas.width = drawWidth;
        this.canvas.height = drawHeight;
        this.ctx.clearRect(0, 0, drawWidth, drawHeight);
        this.ctx.drawImage(source.element, 0, 0, width, height, 0, 0, drawWidth, drawHeight);
        if (source.cleanup) {
            source.cleanup();
        }
        return this.ctx.getImageData(0, 0, drawWidth, drawHeight);
    }
    async loadCanvasSource(blob) {
        if ('createImageBitmap' in window) {
            try {
                const bitmap = await createImageBitmap(blob);
                return {
                    element: bitmap,
                    width: bitmap.width,
                    height: bitmap.height,
                    cleanup: () => bitmap.close()
                };
            }
            catch (error) {
                console.warn('createImageBitmap による読み込みに失敗しました:', error);
            }
        }
        const image = await this.loadImageElement(blob);
        return {
            element: image,
            width: image.naturalWidth,
            height: image.naturalHeight
        };
    }
    loadImageElement(blob) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = (event) => {
                URL.revokeObjectURL(url);
                reject(event);
            };
            img.src = url;
        });
    }
    toGrayscale(imageData) {
        const { data } = imageData;
        const length = imageData.width * imageData.height;
        const grayscale = new Float32Array(length);
        for (let i = 0, j = 0; i < length; i++, j += 4) {
            grayscale[i] = data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114;
        }
        return grayscale;
    }
    detectGrid(grayscale, width, height) {
        const vertical = this.detectLines(grayscale, width, height, 'vertical');
        const horizontal = this.detectLines(grayscale, width, height, 'horizontal');
        if (vertical.length < 4 || horizontal.length < 4) {
            throw new BoardImageError('囲碁盤の格子線を検出できませんでした', 'detect-failed');
        }
        const autoSize = Math.round((vertical.length + horizontal.length) / 2);
        const meanX = this.averageSpacing(vertical);
        const meanY = this.averageSpacing(horizontal);
        const uniformX = this.spacingUniformity(vertical);
        const uniformY = this.spacingUniformity(horizontal);
        const confidence = Math.max(0, Math.min(1, (uniformX + uniformY) / 2));
        const aspectRatio = meanY > 0 ? meanX / meanY : 1;
        return {
            horizontalLines: horizontal,
            verticalLines: vertical,
            autoSize,
            rawDetectedSize: Math.round((vertical.length + horizontal.length) / 2),
            confidence,
            aspectRatio,
            meanSpacingX: meanX,
            meanSpacingY: meanY
        };
    }
    detectLines(grayscale, width, height, orientation) {
        const length = orientation === 'vertical' ? width : height;
        const orthLength = orientation === 'vertical' ? height : width;
        const scores = new Float32Array(length);
        const mean = this.mean(grayscale);
        const thresholdBase = Math.max(30, mean - 10);
        if (orientation === 'vertical') {
            for (let x = 0; x < width; x++) {
                let columnSum = 0;
                for (let y = 0; y < height; y++) {
                    const value = grayscale[y * width + x];
                    if (value < thresholdBase) {
                        columnSum += thresholdBase - value;
                    }
                }
                scores[x] = columnSum / orthLength;
            }
        }
        else {
            for (let y = 0; y < height; y++) {
                let rowSum = 0;
                const offset = y * width;
                for (let x = 0; x < width; x++) {
                    const value = grayscale[offset + x];
                    if (value < thresholdBase) {
                        rowSum += thresholdBase - value;
                    }
                }
                scores[y] = rowSum / orthLength;
            }
        }
        const smoothed = this.smoothArray(scores, Math.max(1, Math.round(length / 200)));
        const lineIndices = this.extractLinePositions(smoothed);
        return lineIndices;
    }
    extractLinePositions(scores) {
        const length = scores.length;
        const mean = this.mean(scores);
        const std = this.std(scores, mean);
        let max = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < length; i++) {
            if (scores[i] > max) {
                max = scores[i];
            }
        }
        const dynamicThreshold = Math.max(mean + std * 0.6, max * 0.25);
        const candidates = [];
        for (let i = 1; i < length - 1; i++) {
            const value = scores[i];
            if (value < dynamicThreshold)
                continue;
            if (value >= scores[i - 1] && value >= scores[i + 1]) {
                candidates.push({ index: i, value });
            }
        }
        if (candidates.length === 0) {
            return [];
        }
        candidates.sort((a, b) => b.value - a.value);
        const minGap = Math.max(2, Math.floor(length / 60));
        const selected = [];
        for (const candidate of candidates) {
            if (selected.some(item => Math.abs(item.index - candidate.index) < minGap)) {
                continue;
            }
            selected.push(candidate);
            if (selected.length >= 30)
                break;
        }
        const result = selected
            .map(item => item.index)
            .sort((a, b) => a - b);
        return result;
    }
    isLikelyGoBoard(detection) {
        const count = detection.autoSize;
        if (count < 7 || count > 25) {
            return false;
        }
        if (detection.confidence < 0.45) {
            return false;
        }
        const ratio = detection.aspectRatio;
        if (ratio < 0.8 || ratio > 1.25) {
            return false;
        }
        const diff = Math.abs(detection.verticalLines.length - detection.horizontalLines.length);
        if (diff > 2) {
            return false;
        }
        return true;
    }
    async resolveBoardSize(detection) {
        const detectedLines = Math.round(detection.autoSize);
        const adjusted = this.adjustBoardSize(detectedLines);
        const needsConfirmation = detection.confidence < 0.72 || detectedLines !== adjusted || (detectedLines !== 9 && detectedLines !== 13 && detectedLines !== 19);
        if (!needsConfirmation) {
            return adjusted;
        }
        return this.promptBoardSize({
            detected: detectedLines,
            adjusted,
            confidence: detection.confidence
        });
    }
    adjustBoardSize(detected) {
        if (detected === 9 || detected === 13 || detected === 19) {
            return detected;
        }
        if ((detected > 9 && detected < 13) || (detected > 13 && detected < 19)) {
            return 19;
        }
        return Math.max(2, detected);
    }
    promptBoardSize(info) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.background = 'rgba(0,0,0,0.6)';
            overlay.style.zIndex = '10000';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            const dialog = document.createElement('div');
            dialog.style.background = '#fff';
            dialog.style.padding = '24px';
            dialog.style.borderRadius = '12px';
            dialog.style.maxWidth = '320px';
            dialog.style.width = '90%';
            dialog.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
            const title = document.createElement('h2');
            title.textContent = '路数を選択';
            title.style.marginTop = '0';
            title.style.fontSize = '20px';
            dialog.appendChild(title);
            const description = document.createElement('p');
            description.textContent = `格子線の検出結果: 約${info.detected}路 (信頼度 ${(info.confidence * 100).toFixed(0)}%)`;
            description.style.fontSize = '14px';
            description.style.lineHeight = '1.6';
            dialog.appendChild(description);
            const options = [
                { label: `自動 (${info.adjusted}路)`, value: info.adjusted, id: 'auto' },
                { label: '9路', value: 9, id: '9' },
                { label: '13路', value: 13, id: '13' },
                { label: '19路', value: 19, id: '19' }
            ];
            const form = document.createElement('div');
            form.style.display = 'grid';
            form.style.gap = '8px';
            form.style.margin = '16px 0';
            let selectedValue = info.adjusted;
            options.forEach(option => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = option.label;
                button.style.padding = '10px';
                button.style.borderRadius = '8px';
                button.style.border = '2px solid var(--accent, #0066cc)';
                button.style.background = option.value === info.adjusted ? 'var(--accent, #0066cc)' : '#fff';
                button.style.color = option.value === info.adjusted ? '#fff' : 'var(--accent, #0066cc)';
                button.style.cursor = 'pointer';
                button.addEventListener('click', () => {
                    selectedValue = option.value;
                    form.querySelectorAll('button').forEach(btn => {
                        btn.setAttribute('data-selected', btn === button ? 'true' : 'false');
                        if (btn === button) {
                            btn.style.background = 'var(--accent, #0066cc)';
                            btn.style.color = '#fff';
                        }
                        else {
                            btn.style.background = '#fff';
                            btn.style.color = 'var(--accent, #0066cc)';
                        }
                    });
                });
                form.appendChild(button);
            });
            dialog.appendChild(form);
            const actionRow = document.createElement('div');
            actionRow.style.display = 'flex';
            actionRow.style.justifyContent = 'space-between';
            actionRow.style.gap = '12px';
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.textContent = 'キャンセル';
            cancelBtn.style.flex = '1';
            cancelBtn.style.padding = '10px';
            cancelBtn.style.borderRadius = '8px';
            cancelBtn.style.border = '1px solid #ccc';
            cancelBtn.style.background = '#f5f5f5';
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(null);
            });
            const okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.textContent = '決定';
            okBtn.style.flex = '1';
            okBtn.style.padding = '10px';
            okBtn.style.borderRadius = '8px';
            okBtn.style.border = 'none';
            okBtn.style.background = 'var(--accent, #0066cc)';
            okBtn.style.color = '#fff';
            okBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(selectedValue);
            });
            actionRow.appendChild(cancelBtn);
            actionRow.appendChild(okBtn);
            dialog.appendChild(actionRow);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
        });
    }
    classifyStones(grayscale, width, height, detection, boardSize) {
        const minSpacing = Math.min(detection.meanSpacingX, detection.meanSpacingY);
        const innerRadius = Math.max(1, Math.floor(minSpacing / 6));
        const outerRadius = Math.max(innerRadius + 2, Math.floor(minSpacing / 3));
        const black = new Map();
        const white = new Map();
        for (let i = 0; i < detection.verticalLines.length; i++) {
            const x = detection.verticalLines[i];
            for (let j = 0; j < detection.horizontalLines.length; j++) {
                const y = detection.horizontalLines[j];
                const statsInner = this.sampleArea(grayscale, width, height, x, y, innerRadius);
                const statsOuter = this.sampleRing(grayscale, width, height, x, y, innerRadius + 1, outerRadius);
                if (!statsInner || !statsOuter)
                    continue;
                const contrast = statsInner.mean - statsOuter.mean;
                const magnitude = Math.abs(contrast);
                const confidence = Math.min(1, magnitude / 45) * Math.min(1, statsInner.std / 25 + 0.3);
                if (magnitude < 10 || statsInner.std < 5) {
                    continue;
                }
                const mappedCol = this.mapIndex(i, detection.verticalLines.length, boardSize);
                const mappedRow = this.mapIndex(j, detection.horizontalLines.length, boardSize);
                if (mappedCol < 0 || mappedCol >= boardSize || mappedRow < 0 || mappedRow >= boardSize)
                    continue;
                const key = `${mappedCol},${mappedRow}`;
                if (contrast < -4) {
                    const coord = this.indexToCoord(mappedCol, mappedRow);
                    const prev = black.get(key);
                    if (!prev || prev.confidence < confidence) {
                        white.delete(key);
                        black.set(key, { coord, confidence });
                    }
                }
                else if (contrast > 4) {
                    const coord = this.indexToCoord(mappedCol, mappedRow);
                    const prev = white.get(key);
                    if (!prev || prev.confidence < confidence) {
                        black.delete(key);
                        white.set(key, { coord, confidence });
                    }
                }
            }
        }
        return { black, white };
    }
    mapIndex(index, detectedCount, targetSize) {
        if (detectedCount <= 1 || targetSize <= 1)
            return 0;
        const ratio = index / (detectedCount - 1);
        const mapped = Math.round(ratio * (targetSize - 1));
        return Math.max(0, Math.min(targetSize - 1, mapped));
    }
    indexToCoord(col, row) {
        const aCode = 'a'.charCodeAt(0);
        return `${String.fromCharCode(aCode + col)}${String.fromCharCode(aCode + row)}`;
    }
    sampleArea(grayscale, width, height, centerX, centerY, radius) {
        let sum = 0;
        let sumSq = 0;
        let count = 0;
        const r = Math.max(1, radius);
        for (let y = centerY - r; y <= centerY + r; y++) {
            if (y < 0 || y >= height)
                continue;
            const offset = y * width;
            for (let x = centerX - r; x <= centerX + r; x++) {
                if (x < 0 || x >= width)
                    continue;
                const value = grayscale[offset + x];
                sum += value;
                sumSq += value * value;
                count++;
            }
        }
        if (count === 0)
            return null;
        const mean = sum / count;
        const variance = Math.max(0, sumSq / count - mean * mean);
        return { mean, std: Math.sqrt(variance) };
    }
    sampleRing(grayscale, width, height, centerX, centerY, innerRadius, outerRadius) {
        let sum = 0;
        let sumSq = 0;
        let count = 0;
        const inner = Math.max(0, innerRadius);
        const outer = Math.max(inner + 1, outerRadius);
        for (let y = centerY - outer; y <= centerY + outer; y++) {
            if (y < 0 || y >= height)
                continue;
            const offset = y * width;
            for (let x = centerX - outer; x <= centerX + outer; x++) {
                if (x < 0 || x >= width)
                    continue;
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.max(Math.abs(dx), Math.abs(dy));
                if (distance <= inner)
                    continue;
                if (distance > outer)
                    continue;
                const value = grayscale[offset + x];
                sum += value;
                sumSq += value * value;
                count++;
            }
        }
        if (count === 0)
            return null;
        const mean = sum / count;
        const variance = Math.max(0, sumSq / count - mean * mean);
        return { mean, std: Math.sqrt(variance) };
    }
    generateSGF(boardSize, stones) {
        let sgf = `(;SZ[${boardSize}]`;
        const blackCoords = Array.from(stones.black.values())
            .map(info => `[${info.coord}]`)
            .sort();
        if (blackCoords.length > 0) {
            sgf += `AB${blackCoords.join('')}`;
        }
        const whiteCoords = Array.from(stones.white.values())
            .map(info => `[${info.coord}]`)
            .sort();
        if (whiteCoords.length > 0) {
            sgf += `AW${whiteCoords.join('')}`;
        }
        sgf += ')';
        return sgf;
    }
    composeMessage(boardSize, stones, detection, source) {
        const blackCount = stones.black.size;
        const whiteCount = stones.white.size;
        const origin = source === 'clipboard' ? 'クリップボード' : '画像ファイル';
        const stoneSummary = `黒${blackCount}・白${whiteCount}`;
        const confidenceText = detection.confidence < 0.75
            ? ` (格子線信頼度 ${(detection.confidence * 100).toFixed(0)}%)`
            : '';
        return `${origin}から${boardSize}路盤を認識しました (${stoneSummary})${confidenceText}`;
    }
    smoothArray(values, radius) {
        if (radius <= 1)
            return values;
        const length = values.length;
        const smoothed = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = -radius; j <= radius; j++) {
                const index = i + j;
                if (index < 0 || index >= length)
                    continue;
                sum += values[index];
                count++;
            }
            smoothed[i] = count ? sum / count : values[i];
        }
        return smoothed;
    }
    averageSpacing(lines) {
        if (lines.length < 2)
            return 0;
        let sum = 0;
        for (let i = 0; i < lines.length - 1; i++) {
            sum += lines[i + 1] - lines[i];
        }
        return sum / (lines.length - 1);
    }
    spacingUniformity(lines) {
        if (lines.length < 3)
            return 0;
        const spacings = [];
        for (let i = 0; i < lines.length - 1; i++) {
            spacings.push(lines[i + 1] - lines[i]);
        }
        const mean = spacings.reduce((a, b) => a + b, 0) / spacings.length;
        const variance = spacings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / spacings.length;
        const std = Math.sqrt(variance);
        if (mean === 0)
            return 0;
        const uniformity = 1 - std / mean;
        return Math.max(0, Math.min(1, uniformity));
    }
    mean(values) {
        let sum = 0;
        for (let i = 0; i < values.length; i++) {
            sum += values[i];
        }
        return sum / values.length;
    }
    std(values, mean) {
        let sumSq = 0;
        for (let i = 0; i < values.length; i++) {
            const diff = values[i] - mean;
            sumSq += diff * diff;
        }
        return Math.sqrt(sumSq / values.length);
    }
}
// ============ グローバル状態初期化 ============
function createInitialState() {
    return {
        boardSize: DEFAULT_CONFIG.DEFAULT_BOARD_SIZE,
        board: Array.from({ length: DEFAULT_CONFIG.DEFAULT_BOARD_SIZE }, () => Array(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE).fill(0)),
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
        gameTree: null
    };
}
// ============ DOM要素の取得 ============
function getUIElements() {
    const svg = document.getElementById('goban');
    const boardWrapper = document.getElementById('board-wrapper');
    const infoEl = document.getElementById('info');
    const sliderEl = document.getElementById('move-slider');
    const movesEl = document.getElementById('moves');
    const msgEl = document.getElementById('msg');
    // 必須要素の存在確認
    if (!svg || !boardWrapper) {
        throw new Error('必要なDOM要素が見つかりません (svg, boardWrapper)');
    }
    return {
        svg,
        boardWrapper,
        infoEl,
        sliderEl,
        movesEl,
        msgEl
    };
}
// ============ アプリケーション初期化 ============
function initializeApp() {
    try {
        console.log('Tumego TypeScript版 初期化開始...');
        // 状態とUI要素を初期化
        const gameState = createInitialState();
        const uiElements = getUIElements();
        // UIコントローラーを作成
        const uiController = new UIController(gameState, uiElements);
        // グローバルスコープに登録（置石ダイアログなどで使用）
        window.tumegoUIController = uiController;
        // 初期化完了
        uiController.initialize();
        // 盤面画像インポーターを初期化
        new BoardImageImporter(uiController);
        console.log('Tumego TypeScript版 初期化完了！');
    }
    catch (error) {
        console.error('初期化エラー:', error);
        alert('アプリケーションの初期化に失敗しました: ' + error.message);
    }
}
// ============ DOMContentLoaded イベント ============
document.addEventListener('DOMContentLoaded', initializeApp);
// ============ エクスポート（デバッグ用） ============
export { initializeApp };
//# sourceMappingURL=main.js.map