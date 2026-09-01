import { QRCodeSVG } from "qrcode.react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInstagram } from "@fortawesome/free-brands-svg-icons";
import { faHardHat } from "@fortawesome/free-solid-svg-icons"; // Menggunakan ikon helm safety/proyek sebagai pengganti line art helm
import "./hangtag.css";

const HANGTAG_DESIGN_MM = { width: 100, height: 130 };

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

function getTitleFontSize(styleName: string, colorName: string) {
  const titleLength = Array.from(`${styleName} ${colorName}`).length;
  const baseSize = 8.5;
  const targetLength = 20;
  return Math.max(4.8, Math.min(baseSize, (baseSize * targetLength) / titleLength));
}

export function Hangtag({
  productName,
  styleName,
  colorName,
  sizeName,
  sizes = [],
  selectedSizeId,
  kodeVariant,
  kodeBatch,
  tanggal,
  qrValue,
}: HangtagProps) {
  const titleFontSize = getTitleFontSize(styleName, colorName);

  return (
    <article className="hangtag" aria-label={`Hangtag ${productName}`}>
      <header className="hangtag-header">
        <p className="hangtag-kicker">{productName}</p>
        <h1
          className="hangtag-title"
          style={{ "--hangtag-title-font-size": `${titleFontSize}mm` } as React.CSSProperties}
        >
          <span>{styleName}</span>
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
          {/* Mengganti SVG Helm kustom dengan Icon Font Awesome */}
          <FontAwesomeIcon icon={faHardHat} className="hangtag-art" aria-label="Helmet line art" />

          <div className="hangtag-meta">
            <p className="hangtag-meta-label">{sizeName ?? colorName}</p>
            <p className="hangtag-meta-name">
              {productName}
              {styleName ? <br /> : null}
              {styleName || colorName}
            </p>
            <p className="hangtag-meta-code">
              {kodeVariant ?? "-"}
              <br />
              {[kodeBatch, tanggal].filter(Boolean).join(" · ") || "-"}
            </p>
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
            <p className="hangtag-qr-code">{qrValue}</p>
          </div>
        </div>

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
            <FontAwesomeIcon icon={faInstagram} className="hangtag-brand-icon" aria-hidden="true" />
            <span className="hangtag-brand-mark">RSVHELMETS</span>
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