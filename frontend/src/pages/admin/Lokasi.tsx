import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLocationDot } from "@fortawesome/free-solid-svg-icons";

// Basemap raster OpenStreetMap: gratis, tanpa API key, tanpa vector tile worker
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

// shortcut: data contoh statis, ganti ke API gudang begitu backend siap
type Lokasi = {
  id: string;
  nama: string;
  tipe: "Kantor" | "Gudang" | "Produksi";
  alamat: string;
  aktif: boolean;
  lngLat: [number, number];
};

const LOKASI: Lokasi[] = [
  { id: "kantor", nama: "Kantor Pusat", tipe: "Kantor", alamat: "Kawasan Industri Candi, Semarang", aktif: true, lngLat: [110.3448, -6.9946] },
  { id: "gudang-a", nama: "Gudang A", tipe: "Gudang", alamat: "Kawasan Industri Candi Blok A, Semarang", aktif: true, lngLat: [110.3489, -6.9976] },
  { id: "gudang-b", nama: "Gudang B", tipe: "Gudang", alamat: "Kawasan Industri Candi Blok C, Semarang", aktif: true, lngLat: [110.3405, -6.9902] },
  { id: "produksi-1", nama: "Lantai Produksi 1", tipe: "Produksi", alamat: "Kawasan Industri Candi Blok B, Semarang", aktif: false, lngLat: [110.3462, -6.9914] },
];

const badgeCls: Record<Lokasi["tipe"], string> = {
  Kantor: "bg-[#1E3A5F]/10 text-[#1E3A5F]",
  Gudang: "bg-[#00A8E8]/10 text-[#0077A8]",
  Produksi: "bg-[#10B981]/10 text-[#0E7A55]",
};

export default function Lokasi() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const [activeId, setActiveId] = useState(LOKASI[0]!.id);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: LOKASI[0]!.lngLat,
      zoom: 14,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (event) => setMapError(event.error?.message ?? "Peta gagal dimuat."));

    const bounds = new maplibregl.LngLatBounds();
    const markers = markersRef.current;
    for (const lokasi of LOKASI) {
      const marker = new maplibregl.Marker({ color: lokasi.aktif ? "#00A8E8" : "#94A3B8" })
        .setLngLat(lokasi.lngLat)
        .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(`<strong>${lokasi.nama}</strong><br>${lokasi.alamat}`))
        .addTo(map);
      marker.getElement().addEventListener("click", () => setActiveId(lokasi.id));
      markers.set(lokasi.id, marker);
      bounds.extend(lokasi.lngLat);
    }
    map.on("load", () => map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 }));

    return () => {
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const focus = (lokasi: Lokasi) => {
    setActiveId(lokasi.id);
    if (!mapRef.current) return;
    mapRef.current.flyTo({ center: lokasi.lngLat, zoom: 16 });
    const marker = markersRef.current.get(lokasi.id);
    const popup = marker?.getPopup();
    if (marker && popup && !popup.isOpen()) marker.togglePopup();
  };

  const aktif = LOKASI.filter((lokasi) => lokasi.aktif).length;

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Warehouse</p>
        <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Lokasi</h1>
        <p className="mt-2 text-base text-[#6B7280]">
          Peta lokasi kantor, gudang, dan area produksi. {aktif} dari {LOKASI.length} lokasi aktif.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Daftar lokasi</h2>
          <ul className="space-y-2">
            {LOKASI.map((lokasi) => (
              <li key={lokasi.id}>
                <button
                  type="button"
                  onClick={() => focus(lokasi)}
                  aria-pressed={lokasi.id === activeId}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${
                    lokasi.id === activeId
                      ? "border-[#00A8E8] bg-[#00A8E8]/5"
                      : "border-slate-200 hover:bg-[#F5F7FA]"
                  }`}
                >
                  <FontAwesomeIcon icon={faLocationDot} className="mt-0.5 h-4 w-4 shrink-0 text-[#00A8E8]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-[#1F2937]">{lokasi.nama}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${badgeCls[lokasi.tipe]}`}>{lokasi.tipe}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-[#6B7280]">{lokasi.alamat}</span>
                    <span className={`mt-1 block text-[12px] font-medium ${lokasi.aktif ? "text-[#0E7A55]" : "text-slate-400"}`}>
                      {lokasi.aktif ? "Aktif" : "Nonaktif"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="relative overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div ref={containerRef} className="h-[520px] w-full" />
          {mapError && (
            <p role="alert" className="absolute inset-x-4 bottom-4 rounded-lg bg-[#EF4444]/95 px-4 py-3 text-sm text-white">
              Peta gagal dimuat: {mapError}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
