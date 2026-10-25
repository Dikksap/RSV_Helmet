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
import KelolaUser from "./pages/admin/KelolaUser.tsx";
import KelolaPermission from "./pages/admin/KelolaPermission.tsx";
import AdminLayout from "./layouts/AdminLayout.tsx";
import GudangLayout from "./layouts/GudangLayout.tsx";
import DivisiLayout from "./layouts/DivisiLayout.tsx";
import DivisiHome from "./pages/divisi/DivisiHome.tsx";
import DivisiProduksi from "./pages/divisi/DivisiProduksi.tsx";
import DivisiPermintaan from "./pages/divisi/DivisiPermintaan.tsx";
import DivisiTransferWip from "./pages/divisi/DivisiTransferWip.tsx";
import AnggotaDivisi from "./pages/divisi/AnggotaDivisi.tsx";
import CetakLabel from "./pages/public/CetakLabel.tsx";
import DaftarBarang from "./pages/admin/DaftarBarang.tsx";
import { LiveSocketProvider } from "./lib/LiveSocketContext.tsx";
import LandingPage from "./pages/public/LandingPage.tsx";
import LiveView from "./pages/public/LiveView.tsx";
import PermintaanBarang from "./pages/public/PermintaanBarang.tsx";
import PratinjauPermintaan from "./pages/public/PratinjauPermintaan.tsx";
import PengaturanBarangProduksi from "./pages/admin/PengaturanBarangProduksi.tsx";
import PlanProduction from "./pages/admin/PlanProduction.tsx";
import RealisasiProduksi from "./pages/admin/RealisasiProduksi.tsx";
import SpkProduksi from "./pages/admin/SpkProduksi.tsx";
import IntegrasiJurnal from "./pages/admin/IntegrasiJurnal.tsx";
import PrintManager from "./pages/public/PrintManager.tsx";
import ScanQr from "./pages/public/ScanQr.tsx";
import StokProduksi from "./pages/admin/StokProduksi.tsx";
import HasilProduksiDivisi from "./pages/admin/HasilProduksiDivisi.tsx";
import KelolaKaryawan from "./pages/admin/KelolaKaryawan.tsx";
import KelolaDivisi from "./pages/admin/KelolaDivisi.tsx";
import KelolaBatch from "./pages/admin/KelolaBatch.tsx";
import KelolaItem from "./pages/admin/KelolaItem.tsx";
import BOM from "./pages/admin/BOM.tsx";import StokItem from "./pages/admin/StokItem.tsx";
import StokOpname from "./pages/admin/StokOpname.tsx";
import KelolaGudang from "./pages/admin/KelolaGudang.tsx";
import RiwayatMutasi from "./pages/admin/RiwayatMutasi.tsx";
import DaftarPermintaan from "./pages/admin/DaftarPermintaan.tsx";
import PemakaianMaterial from "./pages/admin/PemakaianMaterial.tsx";
import InventoryLedger from "./pages/admin/InventoryLedger.tsx";
import QualityControl from "./pages/admin/QualityControl.tsx";
import Shipments from "./pages/admin/Shipments.tsx";
import WipFlowReport from "./pages/admin/WipFlowReport.tsx";
import HomepageGudang from "./pages/gudang/HomepageGudang.tsx";
import Profil from "./pages/Profil.tsx";
import Login from "./pages/public/Login.tsx";
import DevWatermark from "./components/DevWatermark.tsx";
import RequireRole from "./components/RequireRole.tsx";

const routes = (
  <Routes>
    <Route element={<PublicLayout />}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/cetak-label" element={<RequireRole roles={["admin", "user"]}><CetakLabel /></RequireRole>} />
      <Route path="/live-view" element={<RequireRole roles={["admin"]}><LiveView /></RequireRole>} />
      <Route path="/permintaan-barang" element={<PermintaanBarang />} />
      <Route path="/permintaan-barang/pratinjau" element={<PratinjauPermintaan />} />
      <Route path="/print_manager" element={<PrintManager />} />
      <Route path="/scan-qr" element={<RequireRole roles={["admin", "user"]}><ScanQr /></RequireRole>} />
      <Route path="/profil" element={<RequireRole roles={["admin", "gudang", "user", "produksi", "qc"]}><Profil /></RequireRole>} />
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
      <Route path="/admin/hasil-produksi-divisi" element={<HasilProduksiDivisi />} />
      <Route path="/admin/karyawan" element={<KelolaKaryawan />} />
      <Route path="/admin/user" element={<KelolaUser />} />
      <Route path="/admin/role" element={<KelolaPermission />} />
      <Route path="/admin/divisi" element={<KelolaDivisi />} />
      <Route path="/admin/batch" element={<KelolaBatch />} />
      <Route path="/admin/permintaan-barang" element={<DaftarPermintaan />} />
<Route path="/admin/pemakaian-material" element={<PemakaianMaterial />} />
<Route path="/admin/inventory" element={<InventoryLedger />} />
<Route path="/admin/quality" element={<QualityControl />} />
<Route path="/admin/shipments" element={<Shipments />} />
<Route path="/admin/wip-flow" element={<WipFlowReport />} />
      <Route path="/admin/item" element={<KelolaItem />} />
      <Route path="/admin/item/stok/:id" element={<StokItem />} />
<Route path="/admin/bom" element={<BOM />} />      <Route path="/admin/stok-opname" element={<StokOpname />} />
      <Route path="/admin/gudang" element={<KelolaGudang />} />
      <Route path="/admin/mutasi-gudang" element={<RiwayatMutasi />} />
      <Route path="/admin/variant-produk" element={<Navigate to="/admin/pengaturan/variant-produk" replace />} />
      <Route path="/admin/master-data" element={<Navigate to="/admin/pengaturan/master-data" replace />} />
      <Route path="/admin/pengaturan/*" element={<PengaturanBarangProduksi />} />
      <Route path="/admin/plan-production/*" element={<PlanProduction />} />
      <Route path="/admin/spk" element={<SpkProduksi />} />
      <Route path="/admin/integrasi-jurnal" element={<IntegrasiJurnal />} />
      <Route path="/admin/realisasi-produksi" element={<RealisasiProduksi />} />
      <Route path="/admin/profil" element={<Profil />} />
    </Route>

    <Route
      element={
        <LiveSocketProvider>
          <DivisiLayout />
        </LiveSocketProvider>
      }
    >
      <Route path="/divisi" element={<Navigate to="/divisi/home" replace />} />
      <Route path="/divisi/home" element={<DivisiHome />} />
      <Route path="/divisi/produksi" element={<DivisiProduksi />} />
      <Route path="/divisi/transfer-wip" element={<DivisiTransferWip />} />
      <Route path="/divisi/permintaan" element={<DivisiPermintaan />} />
      <Route path="/divisi/anggota" element={<AnggotaDivisi />} />
      <Route path="/divisi/quality" element={<RequireRole roles={["admin", "qc", "produksi", "user"]}><QualityControl /></RequireRole>} />
    </Route>

    <Route
      element={
        <LiveSocketProvider>
          <GudangLayout />
        </LiveSocketProvider>
      }
    >
      <Route path="/gudang" element={<Navigate to="/gudang/home" replace />} />
      <Route path="/gudang/home" element={<HomepageGudang />} />
      <Route path="/gudang/barang" element={<DaftarBarang />} />
      <Route path="/gudang/stok-produksi" element={<StokProduksi />} />
      <Route path="/gudang/mutasi" element={<RiwayatMutasi />} />
      <Route path="/gudang/item" element={<KelolaItem />} />
      <Route path="/gudang/item/stok/:id" element={<StokItem />} />
      <Route path="/gudang/stok-opname" element={<StokOpname />} />
      <Route path="/gudang/permintaan-barang" element={<DaftarPermintaan />} />
<Route path="/gudang/pemakaian-material" element={<PemakaianMaterial />} />
      <Route path="/gudang/profil" element={<Profil />} />
      <Route path="/gudang/inventory" element={<InventoryLedger />} />
      <Route path="/gudang/wip-flow" element={<WipFlowReport />} />
      <Route path="/gudang/shipments" element={<Shipments />} />
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
