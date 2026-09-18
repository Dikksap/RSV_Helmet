import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
// `?inline` -> data URL base64. Wajib agar <img> tetap tampil di dokumen
// print terisolasi (Electron silent print pakai data:text/html, URL relatif
// seperti /assets/... tidak bisa resolve di sana dan gambar hilang).
import helmetArtUrl from "../../assets/gambar_helm.png?inline";
import kickerArtUrl from "../../assets/windbreaker_font.svg?inline";
import "./hangtag.css";

const HANGTAG_DESIGN_MM = { width: 100, height: 75 };

export interface HangtagSizeOption {
  id: number | string;
  nama: string;
}

interface HangtagProps {
  productName: string;
  styleName: string;
  colorName: string;
  sizeName?: string;
  sizes?: HangtagSizeOption[];
  selectedSizeId?: number | string;
  kodeVariant?: string;
  kodeBatch?: string;
  tanggal?: string;
  qrValue: string;
  barcodeValue?: string;
}

// JsBarcode render ke <svg> via ref — SVG inline tetap, ikut silent-print & JPG
// tanpa dep gambar eksternal. displayValue=false: teks digambar manual di bawah
// agar styling ikut .hangtag-barcode-text.
function ManufactureBarcode({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const text = value.trim().toUpperCase();

  useEffect(() => {
    if (!svgRef.current || !text) return;
    try {
      JsBarcode(svgRef.current, text, {
        format: "CODE128",
        displayValue: false,
        margin: 0,
        height: 40,
      });
    } catch {
      // karakter tak didukung -> biarkan svg kosong, fallback teks di bawah
    }
  }, [text]);

  if (!text) return <p className="hangtag-barcode-text">{value}</p>;
  return (
    <>
      <svg
        ref={svgRef}
        className="hangtag-barcode-svg"
        role="img"
        aria-label={`Barcode ${value}`}
      />
      <p className="hangtag-barcode-text">{value}</p>
    </>
  );
}

function PosterWord({ word }: { word: string }) {
  const letters = Array.from(word);
  if (letters.length < 2) {
    return <span>{word}</span>;
  }
  return (
    <span className="hangtag-poster-word">
      <span>{word}</span>
      <span className="hangtag-poster-ghost" aria-hidden="true">
        {letters.map((letter, index) => (
          <span key={`${letter}-${index}`}>{letter}</span>
        ))}
      </span>
    </span>
  );
}

export function Hangtag({
  productName,
  styleName,
  colorName,
  sizeName,
  sizes = [],
  selectedSizeId,
  qrValue,
  barcodeValue,
}: HangtagProps) {
  // "motif" bukan nama style tampil -> kosongkan saja
  const displayStyle =
    styleName.trim().toLowerCase() === "motif" ? "" : styleName;

  return (
    <article className="hangtag" aria-label={`Hangtag ${productName}`}>
      <header className="hangtag-header">
        <img src={kickerArtUrl} alt="RSV" className="hangtag-kicker-img" />
        <h1 className="hangtag-title">
          {displayStyle ? <PosterWord word={displayStyle} /> : null}
          <PosterWord word={colorName} />
        </h1>
      </header>

      <div className="hangtag-body">
        {sizes.length > 0 && (
          <div className="hangtag-sizes" role="radiogroup" aria-label="Ukuran">
            {sizes.map((size) => {
              const isChecked =
                selectedSizeId === undefined
                  ? size.nama === sizeName
                  : String(size.id) === String(selectedSizeId);

              return (
                <span
                  key={size.id}
                  role="radio"
                  aria-checked={isChecked}
                  tabIndex={isChecked ? 0 : -1}
                  className={`hangtag-chip ${isChecked ? "is-selected" : ""}`}
                >
                  <span>{size.nama}</span>
                  <span className="hangtag-chip-dot" />
                </span>
              );
            })}
          </div>
        )}

        <div className="hangtag-middle">
          <img src={helmetArtUrl} alt="Helmet line art" className="hangtag-art" />

          <div className="hangtag-meta">
            <p className="hangtag-openface">OPEN FACE</p>
            <p className="hangtag-meta-name">
              {productName}
              {styleName ? <br /> : null}
              {styleName || colorName}
            </p>
            <p className="hangtag-meta-code">{qrValue}</p>
          </div>
          <div className="hangtag-qr-block">
           
            <div className="hangtag-qr">
              <QRCodeSVG
                value={qrValue}
                size={200}
                marginSize={0}
                level="H"
                bgColor="#fffcf7"
                fgColor="#111111"
                title={`QR code ${qrValue}`}
              />
              
            </div>
          </div>
        </div>

        {barcodeValue ? (
          <div className="hangtag-barcode">
            <ManufactureBarcode value={barcodeValue} />
          </div>
        ) : null}

        <div className="hangtag-footer">
          <div className="hangtag-material">
            <p className="hangtag-material-big">ABS</p>
            <p className="hangtag-material-small">(ACRYLONITRILE BUTADIENE STYRENE)</p>
          </div>
          <a
            href="https://www.instagram.com/rsvhelmets/"
            target="_blank"
            rel="noopener noreferrer"
            className="hangtag-brand"
          >
            {/* Mengganti SVG Instagram kustom dengan Icon Font Awesome */}
            {/* <FontAwesomeIcon icon={faInstagram} className="hangtag-brand-icon" aria-hidden="true" />
            <span className="hangtag-brand-mark">RSVHELMETS</span> */}
             <span className="hangtag-brand-mark">www.rsvhelmets.co.id</span>
          </a>
        </div>
      </div>
    </article>
  );
}

export function HangtagFit({
  widthMm,
  heightMm,
  children,
}: {
  widthMm: number;
  heightMm: number;
  children: React.ReactNode;
}) {
  const scale = Math.min(
    widthMm / HANGTAG_DESIGN_MM.width,
    heightMm / HANGTAG_DESIGN_MM.height
  );
  return (
    <div
      className="hangtag-fit"
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
      }}
    >
      <div
        className="hangtag-fit-inner"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}