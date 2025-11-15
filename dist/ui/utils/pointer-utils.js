const TOUCH_POINTER_TYPES = new Set(['touch', 'pen']);
export function isPointerActive(event) {
    var _a;
    if (typeof event.buttons === 'number' && event.buttons > 0) {
        return true;
    }
    return TOUCH_POINTER_TYPES.has((_a = event.pointerType) !== null && _a !== void 0 ? _a : '');
}
//# sourceMappingURL=pointer-utils.js.map