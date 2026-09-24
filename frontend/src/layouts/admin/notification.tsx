/* eslint-disable react-refresh/only-export-components -- types + helpers, not a component */
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";

export type NotifItem = {
  id: number;
  type: string;
  message: string;
  data: string;
  fullData: string;
  time: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nestedName(value: unknown): string | null {
  return isRecord(value) ? str(value.nama) : null;
}

function tryParseJson(raw: string): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function formatTanggal(iso: unknown): string | null {
  if (typeof iso !== "string" || !iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function batchLabel(batch: unknown): string | null {
  if (!isRecord(batch)) return null;
  if (typeof batch.nomorBatch === "number") {
    return `BC${String(batch.nomorBatch).padStart(3, "0")}`;
  }
  return str(batch.nomorBatch) ?? str(batch.kodeBatch);
}

export function summarizeNotif(fullData: string): string {
  const data = tryParseJson(fullData);
  if (!isRecord(data)) return "";
  const kode = str(data.kodeBarang);
  if (kode) {
    const status = str(data.status);
    return status ? `${kode} • ${status}` : kode;
  }
  if (typeof data.totalDibuat === "number" && Array.isArray(data.batches)) {
    return `${data.totalDibuat} barang • ${data.batches.length} batch`;
  }
  const kodeVariant = str(data.kodeVariant);
  if (kodeVariant) return kodeVariant;
  const nama = str(data.nama);
  if (nama) return nama;
  if (typeof data.id === "number") return `ID ${data.id}`;
  return "";
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-2 last:border-0">
      <span className="shrink-0 text-xs text-[#6B7280]">{label}</span>
      <span
        className={`text-right text-xs font-semibold text-[#1F2937] ${mono ? "break-all font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export function NotifDetail({ fullData }: { fullData: string }) {
  const data = tryParseJson(fullData);
  if (!isRecord(data)) {
    return <p className="text-sm text-[#6B7280]">Tidak ada data tambahan.</p>;
  }

  const kodeBarang = str(data.kodeBarang);
  if (kodeBarang) {
    const variant = isRecord(data.variant) ? data.variant : null;
    const parts = [
      variant && isRecord(variant.product) ? str(variant.product.nama) : null,
      variant ? nestedName(variant.style) : null,
      variant ? nestedName(variant.color) : null,
      variant ? nestedName(variant.size) : null,
    ].filter((value): value is string => value !== null);
    const varian =
      parts.length > 0 ? parts.join(" / ") : (str(data.kodeVariant) ?? "-");
    return (
      <div className="rounded-xl border border-slate-200 bg-[#F5F7FA] px-4 py-2">
        <DetailRow label="Kode Barang" value={kodeBarang} mono />
        <DetailRow label="Status" value={str(data.status) ?? "-"} />
        <DetailRow label="Varian" value={varian} />
        <DetailRow
          label="Batch"
          value={batchLabel(data.batch) ?? "No Batch"}
          mono
        />
        <DetailRow label="Tanggal" value={formatTanggal(data.tanggal) ?? "-"} />
        <DetailRow
          label="Diperbarui"
          value={formatTanggal(data.updatedAt) ?? "-"}
        />
      </div>
    );
  }

  if (typeof data.totalDibuat === "number" && Array.isArray(data.batches)) {
    const batches = (data.batches as unknown[]).filter(isRecord);
    const contoh = batches
      .flatMap((batch) => (Array.isArray(batch.barang) ? batch.barang : []))
      .filter(isRecord)
      .map((barang) => str(barang.kodeBarang))
      .filter((value): value is string => value !== null)
      .slice(0, 3);
    return (
      <div className="rounded-xl border border-slate-200 bg-[#F5F7FA] px-4 py-2">
        <DetailRow label="Total Dibuat" value={String(data.totalDibuat)} />
        {batches.map((batch, index) => (
          <DetailRow
            key={index}
            label={`Batch ${str(batch.kodeBatch) ?? `#${index + 1}`}`}
            value={`${typeof batch.jumlah === "number" ? batch.jumlah : "?"} barang`}
          />
        ))}
        {contoh.length > 0 && (
          <DetailRow label="Contoh Kode" value={contoh.join(", ")} mono />
        )}
      </div>
    );
  }

  const kodeVariant = str(data.kodeVariant);
  if (
    kodeVariant ||
    (typeof data.styleId === "number" && typeof data.colorId === "number")
  ) {
    const varian = [
      nestedName(data.style),
      nestedName(data.color),
      nestedName(data.size),
    ]
      .filter((value): value is string => value !== null)
      .join(" / ");
    return (
      <div className="rounded-xl border border-slate-200 bg-[#F5F7FA] px-4 py-2">
        <DetailRow
          label="Kode Variant"
          value={
            kodeVariant ??
            `Variant #${typeof data.id === "number" ? data.id : "-"}`
          }
          mono
        />
        {varian && <DetailRow label="Varian" value={varian} />}
        {typeof data.id === "number" && (
          <DetailRow label="ID" value={String(data.id)} />
        )}
      </div>
    );
  }

  if (str(data.nama) && str(data.prefix)) {
    return (
      <div className="rounded-xl border border-slate-200 bg-[#F5F7FA] px-4 py-2">
        <DetailRow label="Nama" value={str(data.nama) ?? "-"} />
        <DetailRow label="Prefix" value={str(data.prefix) ?? "-"} mono />
        {typeof data.id === "number" && (
          <DetailRow label="ID" value={String(data.id)} />
        )}
      </div>
    );
  }

  if (typeof data.id === "number" && Object.keys(data).length === 1) {
    return (
      <div className="rounded-xl border border-slate-200 bg-[#F5F7FA] px-4 py-2">
        <DetailRow label="ID" value={String(data.id)} />
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-[#F5F7FA] p-4 font-mono text-xs text-[#1F2937]">
      {fullData}
    </pre>
  );
}

export function EmptyNotifications() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8">
      <FontAwesomeIcon icon={faBell} className="h-8 w-8 text-[#D1D5DB]" />
      <p className="mt-2 text-xs text-[#6B7280]">Tidak ada notifikasi</p>
    </div>
  );
}
