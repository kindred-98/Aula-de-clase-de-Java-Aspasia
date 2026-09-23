import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export type ToastTone = "success" | "error";

type ToastState = { message: string; tone: ToastTone } | null;

let listeners: ((t: ToastState) => void)[] = [];
let current: ToastState = null;

export function showToast(message: string, tone: ToastTone = "success"): void {
  current = { message, tone };
  for (const fn of listeners) fn(current);
}

export function ToastViewport() {
  const [toast, setToast] = useState<ToastState>(current);

  useEffect(() => {
    listeners.push(setToast);
    return () => {
      listeners = listeners.filter((fn) => fn !== setToast);
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => {
      current = null;
      setToast(null);
    }, 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-4 bottom-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
        toast.tone === "success"
          ? "border-success/40 bg-success/15 text-text"
          : "border-danger/40 bg-danger/15 text-text"
      }`}
    >
      {toast.message}
      <button
        type="button"
        aria-label="Cerrar aviso"
        className="ml-3 text-muted hover:text-text"
        onClick={() => {
          current = null;
          setToast(null);
        }}
      >
        ×
      </button>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirmar",
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      className="rounded-lg border border-border bg-surface p-4 text-sm shadow-lg"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-muted">{body}</p>
      {children}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
