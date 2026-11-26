// Skyline Courier — keyboard and pointer input.
//
// Held keys give a steering direction every frame; one-shot presses (start,
// pause, mute) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. Dragging the
// pointer steers too: left and right bank the wings, up and down pitch the
// nose, and releasing it lets the aeroplane level itself.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const THROTTLE_UP = new Set(['KeyW']);
const THROTTLE_DOWN = new Set(['KeyS']);
const BANK_LEFT = new Set(['ArrowLeft', 'KeyA']);
const BANK_RIGHT = new Set(['ArrowRight', 'KeyD']);
const PITCH_UP = new Set(['ArrowUp', 'KeyI']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyK']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let pointerDown = false;
  let pointerX = 0;
  let pointerY = 0;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    const code = codeOf(event);
    if (THROTTLE_UP.has(code) || THROTTLE_DOWN.has(code) || BANK_LEFT.has(code) || BANK_RIGHT.has(code) || PITCH_UP.has(code) || PITCH_DOWN.has(code)) {
      held.add(code);
      event.preventDefault();
      return;
    }
    if (CONFIRM.has(code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
      return;
    }
    if (PAUSE.has(code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
      return;
    }
    if (MUTE.has(code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(codeOf(event));
  });
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!event.repeat) actions |= ACTION_CONFIRM;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
  });
  canvas.addEventListener('pointerup', () => {
    pointerDown = false;
  });
  canvas.addEventListener('pointercancel', () => {
    pointerDown = false;
  });

  /** The steering the pilot is asking for right now, -1..1 on each axis. */
  function steering() {
    let steer = 0;
    if (held.has('ArrowLeft') || held.has('KeyA')) steer -= 1;
    if (held.has('ArrowRight') || held.has('KeyD')) steer += 1;
    let pitch = 0;
    if (held.has('ArrowUp') || held.has('KeyI')) pitch += 1;
    if (held.has('ArrowDown') || held.has('KeyK')) pitch -= 1;
    if (pointerDown) {
      const rect = canvas.getBoundingClientRect();
      steer = Math.max(-1, Math.min(1, ((pointerX - rect.left) / rect.width - 0.5) * 3));
      pitch = Math.max(-1, Math.min(1, (0.5 - (pointerY - rect.top) / rect.height) * 3));
    }
    const throttleUp = held.has('KeyW');
    const throttleDown = held.has('KeyS');
    return {
      steer: Math.max(-1, Math.min(1, steer)),
      pitch: Math.max(-1, Math.min(1, pitch)),
      throttleUp,
      throttleDown,
    };
  }

  /** Take the queued one-shot actions, clearing them. */
  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { steering, takeActions };
}
