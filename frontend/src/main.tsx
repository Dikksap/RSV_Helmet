import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "./index.css";
import App from "./App";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import AdminLayout from "./layouts/AdminLayout.tsx";
import CetakBarang from "./pages/CetakBarang.tsx";
import DaftarBarang from "./pages/DaftarBarang.tsx";
import { LiveSocketProvider } from "./lib/LiveSocketContext.tsx";
import LandingPage from "./pages/LandingPage.tsx";
import LiveView from "./pages/LiveView.tsx";
import MasterData from "./pages/MasterData.tsx";
import PrintManager from "./pages/PrintManager.tsx";
import ScanQr from "./pages/ScanQr.tsx";
import StatistikBarang from "./pages/StatistikBarang.tsx";
import VariantProduk from "./pages/VariantProduk.tsx";
import Login from "./pages/Login.tsx";

const routes = (
  <Routes>
    <Route element={<App />}>
      <Route path="/" element={<LandingPage />} />
      <Route path="/cetak_barang" element={<CetakBarang />} />
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
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/barang" element={<DaftarBarang />} />
      <Route path="/admin/barang/statistik" element={<StatistikBarang />} />
      <Route path="/admin/variant-produk" element={<VariantProduk />} />
      <Route path="/admin/master-data" element={<MasterData />} />
    </Route>
  </Routes>
);

const isElectronPackaged = window.location.protocol === "file:";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isElectronPackaged ? (
      <HashRouter>{routes}</HashRouter>
    ) : (
      <BrowserRouter>{routes}</BrowserRouter>
    )}
  </StrictMode>,
);
