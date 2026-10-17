/** Short confirmations at the bottom of the screen ("Salvo no mapa · Ver"), gone after a few seconds. */
import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; href?: string; run?: () => void };
}

let toasts: Toast[] = [];
let next = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, action?: Toast['action'], ms = 5000) {
  const id = next++;
  toasts = [...toasts.slice(-2), { id, text, action }];
  emit();
  setTimeout(() => dismissToast(id), ms);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}
