import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchPrinters,
  isInElectron,
  loadDefaultPrinter,
  printHangtagSilently,
  saveDefaultPrinter,
  type LabelSize,
  type PrinterInfo,
} from "../lib/print";
import { Hangtag } from "../components/Hangtag/Hangtag";
import "../App.css";

function PrintManager() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>(() =>
    loadDefaultPrinter(),
  );
  const [testSize, setTestSize] = useState<LabelSize>("50x50mm");
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );
  const sampleRef = useRef<HTMLDivElement>(null);
  const isDesktop = isInElectron();

  const showMessage = useCallback((text: string, type: "success" | "error") => {
    setMessage(text);
    setMessageType(type);
  }, []);

  const loadPrinters = useCallback(() => {
    return fetchPrinters()
      .then((list) => {
        setPrinters(list);
        setSelectedPrinter((current) =>
          current && list.some((printer) => printer.name === current)
            ? current
            : (list.find((printer) => printer.isDefault)?.name ?? ""),
        );
        setMessage(null);
      })
      .catch(() => {
        setPrinters([]);
        showMessage("Gagal memuat daftar printer.", "error");
      })
      .finally(() => setIsLoading(false));
  }, [showMessage]);

  useEffect(() => {
    void loadPrinters();
  }, [loadPrinters]);

  const handleSelectPrinter = (name: string) => {
    setSelectedPrinter(name);
    saveDefaultPrinter(name);
    showMessage(
      name
        ? `Printer default disimpan: ${name}`
        : "Kembali memakai printer default sistem.",
      "success",
    );
  };

  const handleTestPrint = async () => {
    const hangtagMarkup =
      sampleRef.current?.querySelector(".hangtag")?.outerHTML ?? "";
    if (!hangtagMarkup) {
      showMessage("Label uji belum siap.", "error");
      return;
    }
    setIsPrinting(true);
    try {
      const result = await printHangtagSilently({
        hangtagHtml: hangtagMarkup,
        size: testSize,
      });
      if (result.status === "success") {
        showMessage("Test print terkirim ke printer.", "success");
      } else {
        showMessage(`Print gagal: ${result.message}`, "error");
      }
    } catch (error) {
      showMessage(`Print gagal: ${(error as Error).message}`, "error");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <main className="generate-page">
      <header className="generate-header">
        <div>
          <p className="eyebrow">DESKTOP / PRINT SETTINGS</p>
          <h1>PENGATURAN PRINTER</h1>
          <p className="subtitle">
            Pilih printer default untuk silent print dan uji hasil cetakan.
          </p>
        </div>
      </header>

      {!isDesktop && (
        <p className="status status-error">
          Halaman ini hanya aktif di aplikasi desktop Electron.
        </p>
      )}
      {isDesktop && isLoading && (
        <p className="status">Memuat daftar printer...</p>
      )}
      {message && (
        <p className={`status ${messageType === "error" ? "status-error" : ""}`}>
          {message}
        </p>
      )}

      {isDesktop && !isLoading && (
        <>
          <section className="dashboard-panel printer-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">PERANGKAT</p>
                <h2>Daftar printer</h2>
              </div>
              <span className="panel-total">{printers.length} printer</span>
            </div>
            {printers.length === 0 ? (
              <p className="empty-dashboard">
                Tidak ada printer terdeteksi. Pastikan printer tersambung.
              </p>
            ) : (
              <div className="activity-table-wrapper">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>Printer</th>
                      <th>Deskripsi</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printers.map((printer) => (
                      <tr key={printer.name}>
                        <td className="item-code">
                          {printer.displayName || printer.name}
                        </td>
                        <td>{printer.description || "-"}</td>
                        <td>
                          {printer.isDefault ? (
                            <span className="status-label">DEFAULT SISTEM</span>
                          ) : selectedPrinter === printer.name ? (
                            <span className="status-label">DEFAULT APP</span>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <label className="print-size-selector no-print">
              <span>Printer default untuk silent print</span>
              <select
                value={selectedPrinter}
                onChange={(event) =>
                  handleSelectPrinter(event.target.value)
                }
              >
                <option value="">Default sistem</option>
                {printers.map((printer) => (
                  <option key={printer.name} value={printer.name}>
                    {printer.displayName || printer.name}
                    {printer.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="dashboard-panel printer-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">PENGUJIAN</p>
                <h2>Test print</h2>
              </div>
            </div>
            <p>
              Cetak satu label QR contoh untuk memastikan ukuran dan posisi
              sudah pas sebelum dipakai generate barang.
            </p>
            <label className="print-size-selector no-print">
              <span>Ukuran label uji</span>
              <select
                value={testSize}
                onChange={(event) =>
                  setTestSize(event.target.value as LabelSize)
                }
              >
                <option value="33x15mm">33 × 15 mm (Thermal Kecil)</option>
                <option value="50x50mm">50 × 50 mm (5 × 5 cm)</option>
                <option value="58x58mm">58 × 58 mm (Thermal Printer)</option>
                <option value="100x100mm">100 × 100 mm (Medium Label)</option>
                <option value="100x140mm">100 × 140 mm</option>
                <option value="100x200mm">100 × 200 mm (10 × 20 cm)</option>
                <option value="4x6inch">4 × 6 inch (Standard)</option>
                <option value="custom">80 × 80 mm (Custom)</option>
              </select>
            </label>
            <div className="printer-actions">
              <button
                className="print-button generate-button"
                type="button"
                disabled={isPrinting || printers.length === 0}
                onClick={() => void handleTestPrint()}
              >
                {isPrinting ? "Mencetak..." : "Test print"}
              </button>
              <button
                className="print-button"
                type="button"
                onClick={() => void loadPrinters()}
              >
                Refresh daftar
              </button>
            </div>
          </section>
        </>
      )}

      <div
        ref={sampleRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          overflow: "hidden",
        }}
      >
        <Hangtag
          productName="Sample Product"
          styleName="Style"
          colorName="Color"
          sizeName="MD"
          sizes={[
            { id: 1, nama: "SM" },
            { id: 2, nama: "MD" },
            { id: 3, nama: "LG" },
            { id: 4, nama: "XL" },
          ]}
          selectedSizeId={2}
          kodeVariant="SMP-0001"
          kodeBatch="BATCH-001"
          tanggal="01/01/2026"
          qrValue="TEST-PRINT-OPERATOR"
        />
      </div>
    </main>
  );
}

export default PrintManager;
