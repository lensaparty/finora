import React from "react";

export default function SummaryCard({ title, value, change, icon, accent }) {
  return (
    <div className="card p-4 sm:p-6 flex items-center gap-4">
      <div className={`h-11 w-11 rounded-xl grid place-items-center text-xl ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <h3 className="text-xl font-semibold text-ink mt-1">{value}</h3>
        {change && <p className="text-xs text-slate-400 mt-1">{change}</p>}
      </div>
    </div>
  );
}
