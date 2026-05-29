import type { ToastItem } from "../store/useStore";

type ToastStackProps = {
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
};

export const ToastStack = ({ toasts, dismissToast }: ToastStackProps) => {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="ba-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} type="button" className={`ba-toast ${toast.type}`} onClick={() => dismissToast(toast.id)}>
          {toast.message}
        </button>
      ))}
    </div>
  );
};
