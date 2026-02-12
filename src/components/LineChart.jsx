import React from "react";

const buildPoints = (data, key, width, height, padding) => {
  const values = data.map((item) => item[key]);
  const max = Math.max(...values, 1);
  const step = (width - padding * 2) / (data.length - 1 || 1);

  return data
    .map((item, index) => {
      const x = padding + index * step;
      const y = height - padding - (item[key] / max) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
};

export default function LineChart({ data }) {
  const width = 520;
  const height = 240;
  const padding = 24;

  const inPoints = buildPoints(data, "in", width, height, padding);
  const outPoints = buildPoints(data, "out", width, height, padding);

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Cash Flow</p>
          <h3 className="text-lg font-semibold">Performa 5 Bulan</h3>
        </div>
        <div className="flex gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary"></span>
            Masuk
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-secondary"></span>
            Keluar
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full mt-4"
        aria-label="Grafik cash flow"
      >
        <defs>
          <linearGradient id="areaIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E3A5F" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#1E3A5F" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="areaOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2ECC71" stopOpacity="0" />
          </linearGradient>
        </defs>

        <polyline
          fill="none"
          stroke="#1E3A5F"
          strokeWidth="3"
          points={inPoints}
        />
        <polyline
          fill="none"
          stroke="#2ECC71"
          strokeWidth="3"
          points={outPoints}
        />
        <polygon
          fill="url(#areaIn)"
          points={`${inPoints} ${width - padding},${height - padding} ${padding},${height - padding}`}
        />
        <polygon
          fill="url(#areaOut)"
          points={`${outPoints} ${width - padding},${height - padding} ${padding},${height - padding}`}
        />

        {data.map((item, index) => {
          const step = (width - padding * 2) / (data.length - 1 || 1);
          const x = padding + index * step;
          return (
            <text
              key={item.month}
              x={x}
              y={height - 4}
              textAnchor="middle"
              fontSize="11"
              fill="#94A3B8"
            >
              {item.month}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
