import React from "react";

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "transactions", label: "Transaksi", icon: "💳" },
  { id: "projects", label: "Project", icon: "🗂️" },
  { id: "debts", label: "Hutang & Piutang", icon: "🧾" },
  { id: "reports", label: "Laporan", icon: "📄" },
  { id: "analytics", label: "Analytics", icon: "📈" },
  { id: "profile", label: "Profil", icon: "👤" }
];

export default function Sidebar({
  active,
  onChange,
  isOpen,
  onClose,
  alertsCount,
  businessName,
  userEmail
}) {
  const avatar = (businessName || "F").trim().charAt(0).toUpperCase();
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        } lg:hidden`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#f3f6fb] border-r border-slate-200/70 p-6 gap-8 flex flex-col transform transition-transform duration-200 lg:static lg:translate-x-0 lg:flex ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={onClose}
          className="lg:hidden ml-auto h-10 w-10 rounded-full border border-slate-200 grid place-items-center text-lg"
          aria-label="Tutup menu"
        >
          ✕
        </button>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-[#3a6bb0] text-white font-bold grid place-items-center shadow-card">
            {avatar}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-primary leading-tight">{businessName || "Finora"}</h1>
            <p className="text-xs text-slate-500 truncate max-w-[180px]">{userEmail || "-"}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onChange(item.id);
                onClose();
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition ${
                active === item.id
                  ? "bg-primary/10 text-primary"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "dashboard" && alertsCount > 0 && (
                <span className="ml-auto rounded-full bg-rose-100 text-rose-600 text-xs font-semibold px-2 py-0.5">
                  {alertsCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4 rounded-2xl bg-white text-slate-700 shadow-card border border-slate-100">
          <p className="text-sm font-semibold text-primary">Ringkasannya</p>
          <p className="text-xs text-slate-500 mt-2">
            Semua transaksi terpusat, real-time, dan siap dianalisis AI.
          </p>
          <button
            onClick={() => {
              onChange("reports");
              onClose();
            }}
            className="mt-3 w-full min-h-[40px] rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-primary hover:bg-slate-50"
          >
            Buat Laporan
          </button>
        </div>
      </aside>
    </>
  );
}
