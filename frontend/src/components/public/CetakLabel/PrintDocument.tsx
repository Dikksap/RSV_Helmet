import type { RefObject } from "react";
import type { ProductVariant } from "../../../api/products";
import type { LabelSize, CustomLabelMm } from "../../../lib/print";
import { Hangtag, HangtagFit } from "../Hangtag/Hangtag";
import { resolveLabelMm } from "../../../lib/print";

// Salinan data saat generate, supaya cetak ulang tetap memakai varian yang benar
// walau pilihan di layar sudah berubah.
export type PrintJob = {
  codes: string[];
  productName: string;
  variant: ProductVariant;
  sizes: { id: number; nama: string }[];
  barcodeValue?: string;
};

type PrintDocumentProps = {
  contentRef: RefObject<HTMLDivElement | null>;
  job: PrintJob | null;
  printSize: LabelSize;
  customMm: CustomLabelMm;
};

export function PrintDocument({ contentRef, job, printSize, customMm }: PrintDocumentProps) {
  const labelMm = resolveLabelMm(printSize, customMm);
  return (
    <div
      ref={contentRef}
      className="print-document pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0 print:static print:flex print:h-auto print:w-full print:items-center print:justify-center print:overflow-visible print:opacity-100"
      aria-hidden="true"
    >
      {job?.codes.map((code) => (
        <div key={code} className="print-sheet">
          <HangtagFit widthMm={labelMm.width} heightMm={labelMm.height}>
            <Hangtag
              productName={job.productName}
              styleName={job.variant.style.nama}
              colorName={job.variant.color.nama}
              sizeName={job.variant.size.nama}
              sizes={job.sizes}
              selectedSizeId={job.variant.sizeId}
              kodeVariant={job.variant.kodeVariant ?? `Variant #${job.variant.id}`}
              qrValue={code}
              barcodeValue={job.barcodeValue}
            />
          </HangtagFit>
        </div>
      ))}
    </div>
  );
}
