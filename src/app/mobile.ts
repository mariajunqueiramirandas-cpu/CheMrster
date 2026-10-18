/**
 * Phone-first plumbing: haptics, the visible viewport (what the on-screen keyboard leaves),
 * bottom sheets that follow the finger, and swipes.
 */
import { type RefObject, useEffect, useRef } from 'react';

/** A finger, not a mouse, is the main pointer. */
export const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

const PATTERNS = { tap: 8, success: 14, error: [24, 60, 24], done: [16, 70, 16, 70, 36] } satisfies Record<string, VibratePattern>;

/** A short buzz where the device can (Android); a no-op elsewhere. */
export function haptic(kind: keyof typeof PATTERNS = 'tap') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw before the first user gesture.
  }
}

/**
 * Keeps --vvh (the height the keyboard leaves visible), --vv-top and --kb on <html>, and the class
 * `kb-open` while a keyboard is up, so full-height screens end right above the keyboard.
 */
export function trackViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let frame = 0;
  // The tallest the window has been at this width: where the page itself resizes for the
  // keyboard (Android), that is the only way to tell how much the keyboard takes.
  let full = { w: window.innerWidth, h: window.innerHeight };
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (window.innerWidth !== full.w) full = { w: window.innerWidth, h: window.innerHeight };
      else full.h = Math.max(full.h, window.innerHeight);
      root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
      root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
      // What the keyboard hides of the layout viewport (iOS); zero where the page resizes (Android).
      const kb = vv.scale <= 1.01 ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      root.style.setProperty('--kb', `${kb}px`);
      // Pinch zoom also shrinks the visual viewport; only a keyboard does it at scale 1.
      const covered = full.h - vv.height * vv.scale;
      root.classList.toggle('kb-open', vv.scale <= 1.01 && covered > 140 && isTypingSomewhere());
    });
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', () => setTimeout(update, 50));
  update();
}

function isTypingSomewhere() {
  const el = document.activeElement;
  return el instanceof HTMLElement && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, [contenteditable="true"]');
}

/** Slides a sheet down and closes it, so a dismissal looks like the swipe that asked for it. */
export function dismissSheet(dialog: HTMLDialogElement | null) {
  if (!dialog?.open) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !dialog.animate) return dialog.close();
  const from = getComputedStyle(dialog).transform;
  const anim = dialog.animate(
    [{ transform: from === 'none' ? 'translateY(0)' : from }, { transform: 'translateY(110%)' }],
    { duration: 200, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' },
  );
  dialog.classList.add('is-leaving');
  anim.onfinish = () => {
    dialog.close();
    anim.cancel();
    dialog.classList.remove('is-leaving');
    dialog.style.transform = '';
  };
}

/**
 * A modal <dialog class="sheet">: opens on mount, closes when the backdrop is tapped, and on
 * phones (where it is a bottom sheet) follows a downward drag from its top edge and closes
 * when let go far or fast enough.
 */
export function useSheet(): RefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    // Taps on the sheet's own padding land on the <dialog> too; only outside its box is the backdrop.
    const onClick = (e: MouseEvent) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dismissSheet(dialog);
    };

    // Touch events, not pointer events: the first move has to be cancellable, or the
    // browser claims the gesture as a scroll before the sheet can follow it.
    let drag: { y: number; t: number; dy: number; started: boolean } | null = null;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !matchMedia('(max-width: 759px)').matches) return;
      const touch = e.touches[0];
      const r = dialog.getBoundingClientRect();
      const target = e.target as HTMLElement;
      // From the grabber strip, or anywhere while the sheet is scrolled to the top and the
      // touch did not start on something that scrolls sideways or takes text.
      const onGrabber = touch.clientY - r.top < 36;
      if (!onGrabber && (dialog.scrollTop > 0 || target.closest('input, textarea, select, [contenteditable], .scroll-x'))) return;
      drag = { y: touch.clientY, t: e.timeStamp, dy: 0, started: false };
    };
    const onMove = (e: TouchEvent) => {
      if (!drag) return;
      const dy = e.touches[0].clientY - drag.y;
      if (!drag.started) {
        if (dy < 0) {
          drag = null; // Upward: the learner is scrolling the sheet.
          return;
        }
        if (e.cancelable) e.preventDefault();
        if (dy < 6) return;
        drag.started = true;
        dialog.classList.add('is-dragging');
      }
      if (e.cancelable) e.preventDefault();
      drag.dy = Math.max(0, dy);
      dialog.style.transform = `translateY(${drag.dy}px)`;
    };
    const onEnd = (e: TouchEvent) => {
      if (!drag) return;
      const { dy, t, started } = drag;
      drag = null;
      if (!started) return;
      dialog.classList.remove('is-dragging');
      const speed = dy / Math.max(1, e.timeStamp - t);
      if (dy > dialog.offsetHeight * 0.3 || (speed > 0.5 && dy > 40)) {
        haptic('tap');
        dismissSheet(dialog);
      } else {
        dialog.style.transform = '';
      }
    };

    dialog.addEventListener('click', onClick);
    dialog.addEventListener('touchstart', onStart, { passive: true });
    dialog.addEventListener('touchmove', onMove, { passive: false });
    dialog.addEventListener('touchend', onEnd);
    dialog.addEventListener('touchcancel', onEnd);
    return () => {
      dialog.removeEventListener('click', onClick);
      dialog.removeEventListener('touchstart', onStart);
      dialog.removeEventListener('touchmove', onMove);
      dialog.removeEventListener('touchend', onEnd);
      dialog.removeEventListener('touchcancel', onEnd);
    };
  }, []);
  return ref;
}

/**
 * Horizontal swipes on an element (touch only), for paging through cards. Vertical scrolling
 * keeps working: a swipe has to be clearly sideways.
 */
export function useSwipe(ref: RefObject<HTMLElement | null>, onSwipe: (dir: 'left' | 'right') => void) {
  const cb = useRef(onSwipe);
  cb.current = onSwipe;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number; t: number; id: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || (e.target as HTMLElement).closest('.scroll-x, input, textarea, .mol-target')) return;
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
    };
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const fast = e.timeStamp - start.t < 600;
      start = null;
      if (fast && Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.6) onSwipe(dx < 0 ? 'left' : 'right');
    };
    const onSwipe = (dir: 'left' | 'right') => cb.current(dir);
    const cancel = () => (start = null);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
    };
  }, [ref]);
}
