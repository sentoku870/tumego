import { GameState, PlayMode, StoneColor } from '../../types.js';
import { isPointerActive } from '../utils/pointer-utils.js';

export type InteractionMode = 'erase' | 'alt' | 'play';
export type PointerDevice = 'mouse' | 'touch' | 'pen' | 'unknown';
export type PointerButtonKind = 'primary' | 'secondary' | 'auxiliary';

export interface NormalizedPointerInput {
  readonly mode: InteractionMode;
  readonly button: PointerButtonKind;
  readonly device: PointerDevice;
  readonly isPointerActive: boolean;
  readonly colors: {
    primary: StoneColor | null;
    secondary: StoneColor | null;
  };
}

const POINTER_TYPE_TO_DEVICE: Record<string, PointerDevice> = {
  mouse: 'mouse',
  touch: 'touch',
  pen: 'pen'
};

export function normalizePointerInput(event: PointerEvent, state: GameState): NormalizedPointerInput {
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

function resolveInteractionMode(eraseMode: boolean, mode: PlayMode): InteractionMode {
  if (eraseMode) {
    return 'erase';
  }
  if (mode === 'alt') {
    return 'alt';
  }
  return 'play';
}

function resolvePointerButton(button: number): PointerButtonKind {
  if (button === 2) {
    return 'secondary';
  }
  if (button === 0) {
    return 'primary';
  }
  return 'auxiliary';
}

function resolvePointerDevice(pointerType: string | undefined): PointerDevice {
  return POINTER_TYPE_TO_DEVICE[pointerType ?? ''] ?? 'unknown';
}

function resolveColors(mode: PlayMode): { primary: StoneColor | null; secondary: StoneColor | null } {
  if (mode === 'alt') {
    return { primary: null, secondary: null };
  }

  const primary = mode === 'white' ? 2 : 1;
  const secondary = mode === 'white' ? 1 : 2;
  return { primary, secondary };
}
