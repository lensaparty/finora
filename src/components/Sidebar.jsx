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
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/90 backdrop-blur border-r border-slate-200/70 p-6 gap-10 flex flex-col transform transition-transform duration-200 lg:static lg:translate-x-0 lg:flex ${
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
          <div className="h-11 w-11 rounded-2xl bg-primary text-white font-bold grid place-items-center">
            {avatar}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-primary">{businessName || "Finora"}</h1>
            <p className="text-xs text-slate-500 truncate max-w-[160px]">{userEmail || "-"}</p>
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
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
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

      <div className="mt-auto p-4 rounded-xl bg-primary text-white shadow-card">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">Insight AI</p>
        <h3 className="text-lg font-semibold mt-2">Keuangan rapi, tanpa ribet.</h3>
        <p className="text-xs text-white/70 mt-2">
          Dapatkan laporan real-time dan prediksi arus kas yang lebih akurat.
        </p>
      </div>
    </aside>
    </>
  );
}
