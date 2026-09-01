import type { RefObject } from "react";
import type { Product } from "../../api/products";
import type { GenerateInfo } from "../../api/barang";
import type { ProductSize } from "../../api/products";
import type { ProductVariant } from "../../api/products";
import type { LabelSize } from "../../lib/print";
import { Hangtag, HangtagFit } from "../Hangtag/Hangtag";
import { labelSizeMm } from "../../lib/print";

type PrintDocumentProps = {
  contentRef: RefObject<HTMLDivElement | null>;
  generatedCode: string | null; 
  selectedVariant: ProductVariant | undefined;
  selectedProduct: Product | undefined;
  sizes: ProductSize[];
  sizeId: string;
  generateInfo: GenerateInfo | null;
  printSize: LabelSize;
  formatDate: (date: string) => string;
};

export function PrintDocument({
  contentRef,
  generatedCode,
  selectedVariant,
  selectedProduct,
  sizes,
  sizeId,
  generateInfo,
  printSize,
  formatDate,
}: PrintDocumentProps) {
  return (
    <div
      ref={contentRef}
      className="print-document pointer-events-none fixed left-0 top-0 h-px w-px overflow-hidden opacity-0 print:static print:flex print:h-auto print:w-full print:items-center print:justify-center print:overflow-visible print:opacity-100"
      aria-hidden="true"
    >
      {generatedCode && selectedVariant && (
        <HangtagFit
          widthMm={labelSizeMm[printSize].width}
          heightMm={labelSizeMm[printSize].height}
        >
          <Hangtag
            productName={selectedProduct?.nama ?? "-"}
            styleName={selectedVariant.style.nama}
            colorName={selectedVariant.color.nama}
            sizeName={selectedVariant.size.nama}
            sizes={sizes.map((size) => ({ id: size.id, nama: size.nama }))}
            selectedSizeId={Number(sizeId)}
            kodeVariant={
              selectedVariant.kodeVariant ?? `Variant #${selectedVariant.id}`
            }
            kodeBatch={generateInfo?.batch.kodeBatch}
            tanggal={
              generateInfo ? formatDate(generateInfo.tanggal) : undefined
            }
            qrValue={generatedCode}
          />
        </HangtagFit>
      )}
    </div>
  );
}
