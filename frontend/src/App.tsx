import { Outlet } from "react-router-dom";
import Navbar from "./components/Navbar";
import MobileNav from "./components/MobileNav";

function App() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950 pb-16 lg:pb-0">
      <Navbar />
      <Outlet />
      <MobileNav />
    </main>
  );
}

export default App;
