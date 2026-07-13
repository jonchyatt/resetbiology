"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

type ConfirmOptions = {
  title?: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ToastContext = createContext<ToastApi | null>(null);

const KIND_STYLE: Record<ToastKind, string> = {
  success: "border-emerald-400/40 bg-emerald-500/20 text-emerald-100",
  error: "border-rose-400/40 bg-rose-500/20 text-rose-100",
  info: "border-secondary-400/40 bg-secondary-500/20 text-secondary-100",
};

function KindIcon({ kind }: { kind: ToastKind }) {
  if (kind === "success") return <CheckCircle2 className="h-4 w-4 shrink-0" />;
  if (kind === "error") return <AlertTriangle className="h-4 w-4 shrink-0" />;
  return <Info className="h-4 w-4 shrink-0" />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, kind, message }]);
      // ponytail: fixed 5s auto-dismiss; add hover-to-persist only if users ask
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
      confirm: (options) =>
        new Promise<boolean>((resolve) => {
          setConfirmState({ ...options, resolve });
        }),
    }),
    [push],
  );

  const closeConfirm = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toast stack */}
      <div className="fixed right-4 top-20 z-[10000] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${KIND_STYLE[t.kind]}`}
          >
            <KindIcon kind={t.kind} />
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-70 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-primary-400/30 bg-gradient-to-br from-gray-800 to-gray-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {confirmState.title ?? "Are you sure?"}
            </h3>
            {confirmState.body && (
              <p className="mt-2 text-sm text-gray-300">{confirmState.body}</p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => closeConfirm(false)}
                className="flex-1 rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700"
              >
                {confirmState.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition ${
                  confirmState.destructive
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-secondary-600 hover:bg-secondary-700"
                }`}
              >
                {confirmState.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
