export type PointerLikeEvent = Pick<PointerEvent, 'buttons' | 'pointerType'>;

const TOUCH_POINTER_TYPES = new Set(['touch', 'pen']);

export function isPointerActive(event: PointerLikeEvent): boolean {
  if (typeof event.buttons === 'number' && event.buttons > 0) {
    return true;
  }
  return TOUCH_POINTER_TYPES.has(event.pointerType ?? '');
}
