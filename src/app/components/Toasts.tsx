import { dismissToast, useToasts } from '../toast.ts';

export function Toasts() {
  const toasts = useToasts();
  if (!toasts.length) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <p>{t.text}</p>
          {t.action?.href && (
            <a href={t.action.href} onClick={() => dismissToast(t.id)}>
              {t.action.label}
            </a>
          )}
          {t.action?.run && (
            <button
              type="button"
              onClick={() => {
                t.action!.run!();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
