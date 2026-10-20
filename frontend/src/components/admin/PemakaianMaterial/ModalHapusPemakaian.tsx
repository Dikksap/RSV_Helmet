import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTriangleExclamation,
  faSpinner,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import type { ModalDeleteState } from "./types";

interface ModalHapusPemakaianProps {
  state: ModalDeleteState;
  onClose: () => void;
  onConfirm: () => void;
}

export const ModalHapusPemakaian: React.FC<ModalHapusPemakaianProps> = ({
  state,
  onClose,
  onConfirm,
}) => {
  if (!state.record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#0F1C2E]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-xl" />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-bold text-[#1E3A5F]">
              Hapus Pemakaian Material?
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Apakah Anda yakin ingin menghapus transaksi{" "}
              <span className="font-bold text-slate-800">
                {state.record.nomor}
              </span>{" "}
              ({state.record.divisi?.nama ?? "Divisi"})?
            </p>

            <div className="mt-3 rounded-xl border border-red-100 bg-red-50/50 p-3 text-xs text-red-700">
              Pencatatan sisa material untuk {state.record.items?.length || 0} item pada dokumen ini akan dihapus.
            </div>

            {state.error && (
              <p className="mt-2 text-xs font-semibold text-red-600">
                {state.error}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={state.busy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={state.busy}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition active:scale-95 disabled:opacity-50"
          >
            {state.busy ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
              <FontAwesomeIcon icon={faTrash} />
            )}
            <span>Hapus Transaksi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
