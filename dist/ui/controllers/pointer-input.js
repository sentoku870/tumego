import { isPointerActive } from '../utils/pointer-utils.js';
const POINTER_TYPE_TO_DEVICE = {
    mouse: 'mouse',
    touch: 'touch',
    pen: 'pen'
};
export function normalizePointerInput(event, state) {
    const mode = resolveInteractionMode(state.eraseMode, state.mode);
    const button = resolvePointerButton(event.button);
    const device = resolvePointerDevice(event.pointerType);
    const isActive = isPointerActive(event);
    return {
        mode,
        button,
        device,
        isPointerActive: isActive,
        colors: resolveColors(state.mode)
    };
}
function resolveInteractionMode(eraseMode, mode) {
    if (eraseMode) {
        return 'erase';
    }
    if (mode === 'alt') {
        return 'alt';
    }
    return 'play';
}
function resolvePointerButton(button) {
    if (button === 2) {
        return 'secondary';
    }
    if (button === 0) {
        return 'primary';
    }
    return 'auxiliary';
}
function resolvePointerDevice(pointerType) {
    var _a;
    return (_a = POINTER_TYPE_TO_DEVICE[pointerType !== null && pointerType !== void 0 ? pointerType : '']) !== null && _a !== void 0 ? _a : 'unknown';
}
function resolveColors(mode) {
    if (mode === 'alt') {
        return { primary: null, secondary: null };
    }
    const primary = mode === 'white' ? 2 : 1;
    const secondary = mode === 'white' ? 1 : 2;
    return { primary, secondary };
}
//# sourceMappingURL=pointer-input.js.map