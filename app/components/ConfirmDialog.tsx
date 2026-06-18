"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** 위험(삭제) 동작이면 확인 버튼을 빨강으로 */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const Ctx = createContext<ConfirmFn>(() => Promise.resolve(false));

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    [],
  );

  const settle = useCallback(
    (ok: boolean) => {
      setState((s) => {
        s?.resolve(ok);
        return null;
      });
    },
    [],
  );

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmDialog
          {...state.opts}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);

function ConfirmDialog({
  title = "확인",
  message,
  confirmText = "확인",
  cancelText = "취소",
  danger,
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {message && (
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
            {message}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
          >
            {cancelText}
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              danger ? "bg-rose-600 hover:bg-rose-700" : "bg-[#1428A0] hover:bg-[#0f1f80]"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
