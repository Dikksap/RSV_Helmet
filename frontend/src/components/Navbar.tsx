import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  isAuthenticated,
  clearAuth,
  logout,
  getToken,
  isAdmin,
} from "../api/auth";
import logoUrl from "../assets/logo.svg";

type NavItem = {
  to: string;
  label: string;
  end: boolean;
};

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const navigate = useNavigate();

  // Check auth status periodically
  useEffect(() => {
    const interval = setInterval(() => setAuthenticated(isAuthenticated()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    const token = getToken();
    if (token) {
      try {
        await logout(token);
      } catch {
        // Fail-open
      }
    }
    clearAuth();
    setAuthenticated(false);
    navigate("/login");
  };

  const closeMenu = () => setIsOpen(false);
  const toggleMenu = () => setIsOpen((prev) => !prev);

  // Close menu on escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) closeMenu();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Navigation items - simple text only
  const NAV_ITEMS: NavItem[] = [
    { to: "/", label: "Home", end: true },
    { to: "/cetak-label", label: "Cetak Label", end: false },
    { to: "/scan-qr", label: "Scan QR", end: false },
    { to: "/print_manager", label: "Printer", end: false },
  ];

  const showAdmin = authenticated && isAdmin();

  // Desktop link style
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      isActive 
        ? "bg-gray-100 text-gray-900" 
        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
    }`;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 h-14">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <NavLink
          to="/"
          className="flex items-center gap-2 shrink-0"
          onClick={closeMenu}
        >
          <img src={logoUrl} alt="RSV" className="h-8 w-8 object-contain" />
          <span className="font-bold text-gray-900 text-sm hidden sm:block">
            RSV Helmet
          </span>
        </NavLink>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={linkClass}
            >
              {item.label}
            </NavLink>
          ))}
          {showAdmin && (
            <NavLink to="/admin/dashboard" className={linkClass}>
              Admin
            </NavLink>
          )}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2">
          {!authenticated ? (
            <NavLink
              to="/login"
              className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Login
            </NavLink>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
            >
              Logout
            </button>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          type="button"
          onClick={toggleMenu}
          aria-expanded={isOpen}
          className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden absolute inset-x-0 top-14 bg-white border-b border-gray-200 shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={closeMenu}
                className={({ isActive }) =>
                  `block px-3 py-2.5 text-sm font-medium rounded-md ${
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {showAdmin && (
              <NavLink
                to="/admin/dashboard"
                onClick={closeMenu}
                className={({ isActive }) =>
                  `block px-3 py-2.5 text-sm font-medium rounded-md ${
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`
                }
              >
                Admin
              </NavLink>
            )}
            <div className="pt-3 border-t border-gray-200">
              {!authenticated ? (
                <NavLink
                  to="/login"
                  onClick={closeMenu}
                  className="block w-full text-center bg-blue-600 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Login
                </NavLink>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    handleLogout();
                  }}
                  className="block w-full text-center text-gray-600 hover:text-gray-900 px-4 py-2.5 rounded-md text-sm font-medium hover:bg-gray-50"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;