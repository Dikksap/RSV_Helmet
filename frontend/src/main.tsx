import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "./index.css";
import PublicLayout from "./layouts/PublicLayout.tsx";
import Homepage from "./pages/admin/Homepage.tsx";
import AdminLayout from "./layouts/AdminLayout.tsx";
import CetakLabel from "./pages/public/CetakLabel.tsx";
import DaftarBarang from "./pages/admin/DaftarBarang.tsx";
import { LiveSocketProvider } from "./lib/LiveSocketContext.tsx";
import LandingPage from "./pages/public/LandingPage.tsx";
import LiveView from "./pages/public/LiveView.tsx";
import PengaturanBarangProduksi from "./pages/admin/PengaturanBarangProduksi.tsx";
import PlanProduction from "./pages/admin/PlanProduction.tsx";
import RealisasiProduksi from "./pages/admin/RealisasiProduksi.tsx";
import SpkProduksi from "./pages/admin/SpkProduksi.tsx";
import IntegrasiJurnal from "./pages/admin/IntegrasiJurnal.tsx";
import PrintManager from "./pages/public/PrintManager.tsx";
import ScanQr from "./pages/public/ScanQr.tsx";
import StokProduksi from "./pages/admin/StokProduksi.tsx";
import KelolaKaryawan from "./pages/admin/KelolaKaryawan.tsx";
import KelolaDivisi from "./pages/admin/KelolaDivisi.tsx";
import KelolaBatch from "./pages/admin/KelolaBatch.tsx";
import Login from "./pages/public/Login.tsx";
import DevWatermark from "./components/DevWatermark.tsx";

const routes = (
  <Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/cetak-label" element={<CetakLabel />} />
      <Route path="/live-view" element={<LiveView />} />
      <Route path="/print_manager" element={<PrintManager />} />
      <Route path="/scan-qr" element={<ScanQr />} />
      <Route path="/login" element={<Login />} />
    </Route>

    <Route
      element={
        <LiveSocketProvider>
          <AdminLayout />
        </LiveSocketProvider>
      }
    >
      <Route path="/admin/dashboard" element={<Navigate to="/admin/home" replace />} />
      <Route path="/admin/home" element={<Homepage />} />
      <Route path="/admin/barang" element={<DaftarBarang />} />
      <Route path="/admin/stok-produksi" element={<StokProduksi />} />
      <Route path="/admin/karyawan" element={<KelolaKaryawan />} />
      <Route path="/admin/divisi" element={<KelolaDivisi />} />
      <Route path="/admin/batch" element={<KelolaBatch />} />
      <Route path="/admin/variant-produk" element={<Navigate to="/admin/pengaturan/variant-produk" replace />} />
      <Route path="/admin/master-data" element={<Navigate to="/admin/pengaturan/master-data" replace />} />
      <Route path="/admin/pengaturan/*" element={<PengaturanBarangProduksi />} />
      <Route path="/admin/plan-production/*" element={<PlanProduction />} />
      <Route path="/admin/spk" element={<SpkProduksi />} />
      <Route path="/admin/integrasi-jurnal" element={<IntegrasiJurnal />} />
      <Route path="/admin/realisasi-produksi" element={<RealisasiProduksi />} />
    </Route>
  </Routes>
);

const isElectronPackaged = window.location.protocol === "file:";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DevWatermark />
    {isElectronPackaged ? (
      <HashRouter>{routes}</HashRouter>
    ) : (
      <BrowserRouter>{routes}</BrowserRouter>
    )}
  </StrictMode>,
);
