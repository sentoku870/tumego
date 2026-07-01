import { Modal } from '../ui/views/modal.js';
import { DEFAULT_CONFIG } from '../types.js';
export class BoardCaptureService {
    constructor(svgElement, renderer) {
        this.svgElement = svgElement;
        this.renderer = renderer;
        this.currentPreviewModal = null;
    }
    async captureBoard() {
        // ① 盤面保存用：直前の手ハイライトを消した状態で描画
        this.renderer.render({ suppressLastMoveHighlight: true });
        try {
            // ② この状態の SVG を PNG に変換
            const canvasElement = this.getBoardCaptureCanvas();
            const pngBlob = await this.convertSvgToPng(this.svgElement, canvasElement);
            const clipboard = navigator.clipboard;
            const clipboardWritable = typeof (clipboard === null || clipboard === void 0 ? void 0 : clipboard.write) === 'function';
            const clipboardItemCtor = window.ClipboardItem;
            const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
                (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
            if (clipboard && clipboardWritable && clipboardItemCtor) {
                try {
                    const item = new clipboardItemCtor({ 'image/png': pngBlob });
                    await clipboard.write([item]);
                    this.renderer.showMessage('コピーしました');
                    return;
                }
                catch (error) {
                    console.error('クリップボードへの書き込みに失敗しました', error);
                    if (!isIOS) {
                        alert('クリップボードにコピーできなかったため画像を表示します');
                    }
                }
            }
            const dataUrl = await this.blobToDataUrl(pngBlob);
            if (!dataUrl) {
                throw new Error('PNGの生成に失敗しました');
            }
            this.showBoardPreviewModal(dataUrl);
        }
        finally {
            // ③ 画面表示用には、元のハイライト状態で描画し直す
            this.renderer.render();
        }
    }
    async blobToDataUrl(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(typeof reader.result === 'string' ? reader.result : null);
            };
            reader.onerror = () => {
                console.warn('DataURL の生成に失敗しました', reader.error);
                resolve(null);
            };
            reader.readAsDataURL(blob);
        });
    }
    getBoardCaptureCanvas() {
        let canvas = document.getElementById('goban-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'goban-canvas';
            canvas.style.display = 'none';
            document.body.appendChild(canvas);
        }
        return canvas;
    }
    showBoardPreviewModal(imageUrl) {
        var _a;
        (_a = this.currentPreviewModal) === null || _a === void 0 ? void 0 : _a.close();
        this.currentPreviewModal = null;
        const root = document.createElement('div');
        root.style.position = 'relative';
        root.style.padding = '16px';
        const closeButton = document.createElement('button');
        closeButton.textContent = '閉じる';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '8px';
        closeButton.style.right = '8px';
        closeButton.style.padding = '6px 12px';
        closeButton.style.backgroundColor = '#333';
        closeButton.style.color = '#fff';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.cursor = 'pointer';
        closeButton.addEventListener('click', () => {
            var _a;
            (_a = this.currentPreviewModal) === null || _a === void 0 ? void 0 : _a.close();
            this.currentPreviewModal = null;
        });
        const image = document.createElement('img');
        image.id = 'board-preview';
        image.src = imageUrl;
        image.alt = '盤面プレビュー';
        image.style.display = 'block';
        image.style.maxWidth = '90vw';
        image.style.maxHeight = '80vh';
        image.style.borderRadius = '8px';
        root.appendChild(closeButton);
        root.appendChild(image);
        this.currentPreviewModal = new Modal({
            id: 'board-preview-overlay',
            content: root,
            overlayOpacity: 0.6,
            maxWidth: '90vw',
        });
        this.currentPreviewModal.open();
    }
    async convertSvgToPng(svgElement, canvas) {
        const inlineSvg = svgElement.cloneNode(true);
        const rootStyle = getComputedStyle(document.documentElement);
        const { width, height } = this.getSvgRenderSize(svgElement);
        if (!width || !height) {
            throw new Error('SVGのサイズを取得できません');
        }
        inlineSvg.setAttribute('width', width.toString());
        inlineSvg.setAttribute('height', height.toString());
        const cssVariables = DEFAULT_CONFIG.BOARD_CAPTURE_CSS_VARS;
        cssVariables.forEach((name) => {
            const value = rootStyle.getPropertyValue(name);
            if (value) {
                inlineSvg.style.setProperty(name, value.trim());
            }
        });
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(inlineSvg);
        if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
            svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        if (!svgString.includes('xmlns:xlink="http://www.w3.org/1999/xlink"')) {
            svgString = svgString.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
        }
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const pngBlob = await new Promise((resolve, reject) => {
            const image = new Image();
            const revokeUrl = () => URL.revokeObjectURL(url);
            image.onload = () => {
                try {
                    canvas.width = width;
                    canvas.height = height;
                    const context = canvas.getContext('2d');
                    if (!context) {
                        revokeUrl();
                        reject(new Error('Canvas コンテキストを取得できません'));
                        return;
                    }
                    const boardColor = rootStyle.getPropertyValue('--board').trim() || '#ffffff';
                    context.clearRect(0, 0, width, height);
                    context.fillStyle = boardColor;
                    context.fillRect(0, 0, width, height);
                    context.drawImage(image, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        revokeUrl();
                        if (blob) {
                            resolve(blob);
                        }
                        else {
                            reject(new Error('PNG生成に失敗しました'));
                        }
                    }, 'image/png');
                }
                catch (error) {
                    revokeUrl();
                    reject(error);
                }
            };
            image.onerror = () => {
                revokeUrl();
                reject(new Error('SVG画像の読み込みに失敗しました'));
            };
            image.src = url;
        });
        return pngBlob;
    }
    getSvgRenderSize(svgElement) {
        var _a, _b, _c, _d, _e, _f, _g;
        const viewBox = (_a = svgElement.viewBox) === null || _a === void 0 ? void 0 : _a.baseVal;
        const rect = svgElement.getBoundingClientRect();
        const widthCandidate = (_d = (_c = (_b = viewBox === null || viewBox === void 0 ? void 0 : viewBox.width) !== null && _b !== void 0 ? _b : svgElement.clientWidth) !== null && _c !== void 0 ? _c : rect.width) !== null && _d !== void 0 ? _d : Number(svgElement.getAttribute('width'));
        const heightCandidate = (_g = (_f = (_e = viewBox === null || viewBox === void 0 ? void 0 : viewBox.height) !== null && _e !== void 0 ? _e : svgElement.clientHeight) !== null && _f !== void 0 ? _f : rect.height) !== null && _g !== void 0 ? _g : Number(svgElement.getAttribute('height'));
        const width = Number.isFinite(widthCandidate) ? Math.round(widthCandidate) : 0;
        const height = Number.isFinite(heightCandidate) ? Math.round(heightCandidate) : 0;
        return { width, height };
    }
}
//# sourceMappingURL=board-capture-service.js.map