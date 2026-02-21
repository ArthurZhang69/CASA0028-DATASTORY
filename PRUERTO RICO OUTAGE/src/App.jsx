import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ─── FIPS → Municipio name lookup ────────────────────────────────────────────
const MUNICIPIO_NAMES = {
  "72001": "Adjuntas", "72003": "Aguada", "72005": "Aguadilla", "72007": "Aguas Buenas",
  "72009": "Aibonito", "72011": "Añasco", "72013": "Arecibo", "72015": "Arroyo",
  "72017": "Barceloneta", "72019": "Barranquitas", "72021": "Bayamón", "72023": "Cabo Rojo",
  "72025": "Caguas", "72027": "Camuy", "72029": "Canóvanas", "72031": "Carolina",
  "72033": "Cataño", "72035": "Cayey", "72037": "Ceiba", "72039": "Ciales",
  "72041": "Cidra", "72043": "Coamo", "72045": "Comerío", "72047": "Corozal",
  "72049": "Culebra", "72051": "Dorado", "72053": "Fajardo", "72054": "Florida",
  "72055": "Guánica", "72057": "Guayama", "72059": "Guayanilla", "72061": "Guaynabo",
  "72063": "Gurabo", "72065": "Hatillo", "72067": "Hormigueros", "72069": "Humacao",
  "72071": "Isabela", "72073": "Jayuya", "72075": "Juana Díaz", "72077": "Juncos",
  "72079": "Lajas", "72081": "Lares", "72083": "Las Marías", "72085": "Las Piedras",
  "72087": "Loíza", "72089": "Luquillo", "72091": "Manatí", "72093": "Maricao",
  "72095": "Maunabo", "72097": "Mayagüez", "72099": "Moca", "72101": "Morovis",
  "72103": "Naguabo", "72105": "Naranjito", "72107": "Orocovis", "72109": "Patillas",
  "72111": "Peñuelas", "72113": "Ponce", "72115": "Quebradillas", "72117": "Rincón",
  "72119": "Río Grande", "72121": "Sabana Grande", "72123": "Salinas", "72125": "San Germán",
  "72127": "San Juan", "72129": "San Lorenzo", "72131": "San Sebastián", "72133": "Santa Isabel",
  "72135": "Toa Alta", "72137": "Toa Baja", "72139": "Trujillo Alto", "72141": "Utuado",
  "72143": "Vega Alta", "72145": "Vega Baja", "72147": "Vieques", "72149": "Villalba",
  "72151": "Yabucoa", "72153": "Yauco",
};

// ─── Metric config ────────────────────────────────────────────────────────────
const METRICS = [
  {
    key: "total_outage_customer_hours",
    label: "Burden",
    sublabel: "Customer-Hours Lost",
    desc: "Total hours × customers affected. Captures the cumulative weight of disruption.",
    color: (t) => `hsl(${220 + t * 40}, ${60 + t * 30}%, ${70 - t * 45}%)`,
    stops: ["#dbeafe", "#3b82f6", "#1e3a8a"],
    unit: "K hrs",
    format: (v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v.toFixed(0),
  },
  {
    key: "event_count",
    label: "Instability",
    sublabel: "Outage Events",
    desc: "Number of discrete outage events. Reveals systemic fragility of the grid.",
    color: (t) => `hsl(${140 - t * 100}, ${50 + t * 40}%, ${75 - t * 50}%)`,
    stops: ["#dcfce7", "#22c55e", "#14532d"],
    unit: "events",
    format: (v) => v.toFixed(0),
  },
  {
    key: "peak_customers_out",
    label: "Shock",
    sublabel: "Peak Customers Out",
    desc: "Maximum simultaneous customers without power. Measures acute crisis intensity.",
    color: (t) => `hsl(${30 - t * 30}, ${70 + t * 20}%, ${80 - t * 60}%)`,
    stops: ["#fef9c3", "#f59e0b", "#7c2d12"],
    unit: "customers",
    format: (v) => v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v.toFixed(0),
  },
];

// ─── SVG Puerto Rico Map (Municipio outlines as simplified polygons) ──────────
// Using a curated set of approximate SVG paths for PR municipios
const PR_MUNICIPIO_PATHS = {
  "72013": "M 95 38 L 115 35 L 122 42 L 118 52 L 100 55 L 90 48 Z",
  "72097": "M 18 88 L 35 82 L 42 92 L 38 104 L 22 108 L 12 98 Z",
  "72127": "M 210 55 L 228 50 L 238 62 L 232 75 L 215 78 L 205 66 Z",
  "72025": "M 165 72 L 182 68 L 190 78 L 185 90 L 168 93 L 158 82 Z",
  "72021": "M 188 58 L 206 53 L 214 65 L 208 77 L 192 80 L 182 68 Z",
  "72031": "M 215 48 L 235 43 L 244 56 L 238 68 L 220 71 L 210 58 Z",
  "72113": "M 128 90 L 148 86 L 156 98 L 150 110 L 132 114 L 122 102 Z",
  "72061": "M 195 68 L 212 63 L 220 75 L 215 88 L 198 91 L 188 79 Z",
  "72137": "M 175 50 L 195 45 L 202 58 L 196 70 L 178 73 L 168 60 Z",
  "72139": "M 200 65 L 220 60 L 228 73 L 222 85 L 204 88 L 194 76 Z",
  "72135": "M 182 42 L 202 37 L 210 50 L 204 62 L 186 65 L 176 52 Z",
  "72005": "M 22 55 L 40 50 L 48 62 L 42 74 L 25 77 L 15 65 Z",
  "72071": "M 42 45 L 62 40 L 70 52 L 64 64 L 46 67 L 36 55 Z",
  "72065": "M 72 35 L 92 30 L 100 42 L 94 54 L 76 57 L 66 45 Z",
  "72091": "M 118 42 L 138 37 L 146 50 L 140 62 L 122 65 L 112 52 Z",
  "72051": "M 162 40 L 182 35 L 190 48 L 184 60 L 166 63 L 156 50 Z",
  "72027": "M 55 35 L 75 30 L 83 42 L 77 54 L 59 57 L 49 45 Z",
  "72039": "M 105 55 L 125 50 L 133 62 L 127 74 L 109 77 L 99 65 Z",
  "72081": "M 72 58 L 92 53 L 100 65 L 94 77 L 76 80 L 66 68 Z",
  "72073": "M 40 60 L 60 55 L 68 67 L 62 79 L 44 82 L 34 70 Z",
  "72141": "M 88 65 L 108 60 L 116 72 L 110 84 L 92 87 L 82 75 Z",
  "72019": "M 148 62 L 168 57 L 176 70 L 170 82 L 152 85 L 142 72 Z",
  "72045": "M 132 68 L 152 63 L 160 75 L 154 87 L 136 90 L 126 78 Z",
  "72035": "M 152 80 L 172 75 L 180 88 L 174 100 L 156 103 L 146 90 Z",
  "72043": "M 122 75 L 142 70 L 150 82 L 144 94 L 126 97 L 116 85 Z",
  "72009": "M 158 78 L 178 73 L 186 86 L 180 98 L 162 101 L 152 88 Z",
  "72149": "M 105 85 L 125 80 L 133 92 L 127 104 L 109 107 L 99 95 Z",
  "72107": "M 92 70 L 112 65 L 120 78 L 114 90 L 96 93 L 86 80 Z",
  "72075": "M 120 98 L 140 93 L 148 106 L 142 118 L 124 121 L 114 108 Z",
  "72123": "M 135 102 L 155 97 L 163 110 L 157 122 L 139 125 L 129 112 Z",
  "72043b": "M 122 88 L 142 83 L 150 95 L 144 107 L 126 110 L 116 98 Z",
  "72133": "M 148 108 L 168 103 L 176 116 L 170 128 L 152 131 L 142 118 Z",
  "72057": "M 162 108 L 182 103 L 190 116 L 184 128 L 166 131 L 156 118 Z",
  "72015": "M 188 112 L 208 107 L 216 120 L 210 132 L 192 135 L 182 122 Z",
  "72095": "M 198 102 L 218 97 L 226 110 L 220 122 L 202 125 L 192 112 Z",
  "72109": "M 172 102 L 192 97 L 200 110 L 194 122 L 176 125 L 166 112 Z",
  "72069": "M 218 90 L 238 85 L 246 98 L 240 110 L 222 113 L 212 100 Z",
  "72103": "M 205 88 L 225 83 L 233 96 L 227 108 L 209 111 L 199 98 Z",
  "72053": "M 228 80 L 248 75 L 256 88 L 250 100 L 232 103 L 222 90 Z",
  "72037": "M 245 70 L 262 65 L 268 78 L 263 90 L 248 93 L 239 80 Z",
  "72089": "M 240 58 L 258 53 L 265 66 L 259 78 L 243 81 L 234 68 Z",
  "72029": "M 225 62 L 245 57 L 252 70 L 246 82 L 228 85 L 218 72 Z",
  "72077": "M 215 78 L 235 73 L 243 86 L 237 98 L 219 101 L 209 88 Z",
  "72085": "M 202 85 L 222 80 L 230 93 L 224 105 L 206 108 L 196 95 Z",
  "72119": "M 232 70 L 252 65 L 260 78 L 254 90 L 236 93 L 226 80 Z",
  "72087": "M 218 55 L 238 50 L 246 62 L 240 74 L 222 77 L 212 65 Z",
  "72111": "M 45 88 L 65 83 L 73 96 L 67 108 L 49 111 L 39 98 Z",
  "72059": "M 55 100 L 75 95 L 83 108 L 77 120 L 59 123 L 49 110 Z",
  "72055": "M 38 105 L 58 100 L 66 113 L 60 125 L 42 128 L 32 115 Z",
  "72079": "M 28 98 L 48 93 L 56 106 L 50 118 L 32 121 L 22 108 Z",
  "72125": "M 48 75 L 68 70 L 76 82 L 70 94 L 52 97 L 42 85 Z",
  "72121": "M 62 88 L 82 83 L 90 96 L 84 108 L 66 111 L 56 98 Z",
  "72023": "M 25 78 L 45 73 L 53 86 L 47 98 L 29 101 L 19 88 Z",
  "72117": "M 12 70 L 32 65 L 40 78 L 34 90 L 16 93 L 6 80 Z",
  "72067": "M 28 65 L 48 60 L 56 73 L 50 85 L 32 88 L 22 75 Z",
  "72093": "M 68 72 L 88 67 L 96 80 L 90 92 L 72 95 L 62 82 Z",
  "72001": "M 78 72 L 98 67 L 106 80 L 100 92 L 82 95 L 72 82 Z",
  "72011": "M 18 72 L 38 67 L 46 80 L 40 92 L 22 95 L 12 82 Z",
  "72083": "M 58 65 L 78 60 L 86 72 L 80 84 L 62 87 L 52 75 Z",
  "72099": "M 48 50 L 68 45 L 76 58 L 70 70 L 52 73 L 42 60 Z",
  "72115": "M 38 40 L 58 35 L 66 48 L 60 60 L 42 63 L 32 50 Z",
  "72003": "M 8 55 L 28 50 L 36 62 L 30 74 L 12 77 L 2 65 Z",
  "72047": "M 138 55 L 158 50 L 166 62 L 160 74 L 142 77 L 132 65 Z",
  "72101": "M 128 48 L 148 43 L 156 56 L 150 68 L 132 71 L 122 58 Z",
  "72105": "M 148 70 L 168 65 L 176 78 L 170 90 L 152 93 L 142 80 Z",
  "72033": "M 175 62 L 195 57 L 203 70 L 197 82 L 179 85 L 169 72 Z",
  "72017": "M 128 32 L 148 27 L 156 40 L 150 52 L 132 55 L 122 42 Z",
  "72143": "M 162 30 L 182 25 L 190 38 L 184 50 L 166 53 L 156 40 Z",
  "72145": "M 148 25 L 168 20 L 176 32 L 170 44 L 152 47 L 142 35 Z",
  "72007": "M 178 68 L 198 63 L 206 76 L 200 88 L 182 91 L 172 78 Z",
  "72063": "M 195 78 L 215 73 L 223 86 L 217 98 L 199 101 L 189 88 Z",
  "72041": "M 155 68 L 175 63 L 183 76 L 177 88 L 159 91 L 149 78 Z",
  "72129": "M 178 88 L 198 83 L 206 96 L 200 108 L 182 111 L 172 98 Z",
  "72131": "M 58 45 L 78 40 L 86 52 L 80 64 L 62 67 L 52 55 Z",
  "72153": "M 68 82 L 88 77 L 96 90 L 90 102 L 72 105 L 62 92 Z",
  "72147": "M 268 90 L 282 86 L 287 95 L 283 104 L 269 106 L 264 97 Z",
  "72049": "M 262 35 L 272 32 L 277 40 L 273 48 L 263 50 L 258 42 Z",
};

// ─── Color scale helper ───────────────────────────────────────────────────────
function interpolateColor(stops, t) {
  const hexToRgb = (hex) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  });
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const toHex = (n) => n.toString(16).padStart(2, "0");
  const n = stops.length - 1;
  const si = Math.min(Math.floor(t * n), n - 1);
  const local = t * n - si;
  const c1 = hexToRgb(stops[si]);
  const c2 = hexToRgb(stops[si + 1]);
  return `#${toHex(lerp(c1.r, c2.r, local))}${toHex(lerp(c1.g, c2.g, local))}${toHex(lerp(c1.b, c2.b, local))}`;
}

// ─── Choropleth Map Component ─────────────────────────────────────────────────
function ChoroplethMap({ data, metric, month, selectedFips, onSelectFips }) {
  const [tooltip, setTooltip] = useState(null);

  const metricCfg = METRICS.find((m) => m.key === metric);

  const monthData = useMemo(() => {
    const map = {};
    data.forEach((d) => {
      if (d.month === month) map[d.fips] = d;
    });
    return map;
  }, [data, month]);

  const values = useMemo(() => {
    return Object.values(monthData).map((d) => d[metric]).filter((v) => v != null);
  }, [monthData, metric]);

  const [minVal, maxVal] = useMemo(() => {
    const sorted = [...values].sort((a, b) => a - b);
    const q95 = sorted[Math.floor(sorted.length * 0.95)] ?? 1;
    return [0, q95];
  }, [values]);

  const getColor = (fips) => {
    const d = monthData[fips];
    if (!d) return "#1e293b";
    const t = Math.min((d[metric] - minVal) / (maxVal - minVal || 1), 1);
    return interpolateColor(metricCfg.stops, t);
  };

  const handleMouseEnter = (e, fips) => {
    const d = monthData[fips];
    const rect = e.currentTarget.closest("svg").getBoundingClientRect();
    const bbox = e.currentTarget.getBBox();
    setTooltip({
      fips,
      name: MUNICIPIO_NAMES[fips] || fips,
      value: d ? metricCfg.format(d[metric]) : "N/A",
      unit: metricCfg.unit,
      x: bbox.x + bbox.width / 2,
      y: bbox.y,
    });
  };

  const legendStops = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        viewBox="0 0 290 145"
        style={{ width: "100%", height: "100%", display: "block" }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ocean background */}
        <rect x="0" y="0" width="290" height="145" fill="#0a1628" rx="4" />

        {/* Municipio polygons */}
        {Object.entries(PR_MUNICIPIO_PATHS).map(([fips, d]) => {
          const isSelected = fips === selectedFips;
          const fill = getColor(fips);
          return (
            <path
              key={fips}
              d={d}
              fill={fill}
              stroke={isSelected ? "#f59e0b" : "#0a1628"}
              strokeWidth={isSelected ? 1.5 : 0.4}
              style={{
                cursor: "pointer",
                transition: "all 0.3s ease",
                filter: isSelected ? "url(#glow)" : "none",
                opacity: selectedFips && !isSelected ? 0.75 : 1,
              }}
              onMouseEnter={(e) => handleMouseEnter(e, fips)}
              onMouseLeave={() => setTooltip(null)}
              onClick={() => onSelectFips(fips === selectedFips ? null : fips)}
            />
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g transform={`translate(${tooltip.x}, ${tooltip.y - 18})`}>
            <rect x="-42" y="-14" width="84" height="28" rx="3" fill="#0f172a" stroke="#334155" strokeWidth="0.5" opacity="0.95" />
            <text x="0" y="-3" textAnchor="middle" fill="#f1f5f9" fontSize="5.5" fontFamily="'Space Mono', monospace" fontWeight="bold">
              {tooltip.name}
            </text>
            <text x="0" y="7" textAnchor="middle" fill={metricCfg.stops[2]} fontSize="5" fontFamily="'Space Mono', monospace">
              {tooltip.value} {tooltip.unit}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div style={{
        position: "absolute",
        bottom: 8,
        right: 8,
        background: "rgba(10,22,40,0.9)",
        border: "1px solid #1e3a5f",
        borderRadius: 6,
        padding: "6px 10px",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 4, fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>
          {metricCfg.sublabel.toUpperCase()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {legendStops.map((t, i) => (
            <div key={i} style={{
              width: 16, height: 8, borderRadius: 1,
              background: interpolateColor(metricCfg.stops, t),
            }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: "#64748b", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>
          <span>Low</span>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

// ─── Chart Panel ──────────────────────────────────────────────────────────────
function ChartPanel({ data, fips, metric }) {
  const metricCfg = METRICS.find((m) => m.key === metric);

  const chartData = useMemo(() => {
    if (!fips) {
      // Island-wide average
      const byMonth = {};
      data.forEach((d) => {
        if (!byMonth[d.month]) byMonth[d.month] = { sum: 0, count: 0 };
        byMonth[d.month].sum += d[metric] ?? 0;
        byMonth[d.month].count += 1;
      });
      return Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, { sum, count }]) => ({
          month: month.slice(5),
          fullMonth: month,
          value: sum / count,
        }));
    }
    return data
      .filter((d) => d.fips === fips)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((d) => ({
        month: d.month.slice(5),
        fullMonth: d.month,
        value: d[metric] ?? 0,
      }));
  }, [data, fips, metric]);

  const name = fips ? (MUNICIPIO_NAMES[fips] || fips) : "Island-wide Average";

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: "#0f172a", border: `1px solid ${metricCfg.stops[2]}40`,
          borderRadius: 6, padding: "8px 12px", fontFamily: "'Space Mono', monospace",
        }}>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 2 }}>
            {payload[0]?.payload?.fullMonth}
          </div>
          <div style={{ color: metricCfg.stops[2], fontSize: 12, fontWeight: "bold" }}>
            {metricCfg.format(payload[0].value)} {metricCfg.unit}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 11, color: "#94a3b8", fontFamily: "'Space Mono', monospace",
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2,
        }}>
          Time Series
        </div>
        <div style={{
          fontSize: 15, color: "#f1f5f9", fontFamily: "'Libre Baskerville', serif",
          fontWeight: "bold",
        }}>
          {name}
        </div>
        <div style={{ fontSize: 10, color: "#475569", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>
          {metricCfg.sublabel} · 2021–2022
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" />
            <XAxis
              dataKey="month"
              tick={{ fill: "#475569", fontSize: 8, fontFamily: "'Space Mono', monospace" }}
              axisLine={{ stroke: "#1e293b" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={metricCfg.format}
              tick={{ fill: "#475569", fontSize: 7, fontFamily: "'Space Mono', monospace" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <ReTooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={metricCfg.stops[2]}
              strokeWidth={1.5}
              dot={(props) => {
                const max = Math.max(...chartData.map((d) => d.value));
                if (props.payload.value === max) {
                  return <circle key={props.key} cx={props.cx} cy={props.cy} r={4} fill={metricCfg.stops[2]} stroke="#0a1628" strokeWidth={1.5} />;
                }
                return <circle key={props.key} cx={props.cx} cy={props.cy} r={1.5} fill={metricCfg.stops[1]} />;
              }}
              activeDot={{ r: 5, fill: metricCfg.stops[2], stroke: "#0a1628", strokeWidth: 1.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {!fips && (
        <div style={{
          marginTop: 8, padding: "6px 10px",
          background: "#0f172a", borderRadius: 6, border: "1px solid #1e3a5f",
          fontSize: 9, color: "#475569", fontFamily: "'Space Mono', monospace",
          textAlign: "center",
        }}>
          ↑ Click a municipio on the map to zoom in
        </div>
      )}
    </div>
  );
}

// ─── Controls ─────────────────────────────────────────────────────────────────
function Controls({ metric, setMetric, month, setMonth, months }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center",
      padding: "12px 20px",
      background: "#080f1e",
      borderTop: "1px solid #0f2040",
    }}>
      {/* Metric selector */}
      <div style={{ display: "flex", gap: 8 }}>
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            style={{
              padding: "6px 14px",
              borderRadius: 4,
              border: metric === m.key ? `1px solid ${m.stops[2]}` : "1px solid #1e3a5f",
              background: metric === m.key ? `${m.stops[2]}18` : "transparent",
              color: metric === m.key ? m.stops[2] : "#475569",
              fontSize: 11, fontFamily: "'Space Mono', monospace",
              fontWeight: metric === m.key ? "bold" : "normal",
              cursor: "pointer", transition: "all 0.2s",
              letterSpacing: "0.05em",
            }}
          >
            {m.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Month slider */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 200 }}>
        <span style={{
          fontSize: 9, color: "#475569", fontFamily: "'Space Mono', monospace",
          letterSpacing: "0.1em", whiteSpace: "nowrap",
        }}>
          MONTH
        </span>
        <input
          type="range"
          min={0}
          max={months.length - 1}
          value={months.indexOf(month)}
          onChange={(e) => setMonth(months[parseInt(e.target.value)])}
          style={{
            flex: 1, accentColor: "#3b82f6",
            height: 4, cursor: "pointer",
          }}
        />
        <span style={{
          fontSize: 11, color: "#93c5fd", fontFamily: "'Space Mono', monospace",
          minWidth: 56, textAlign: "right", fontWeight: "bold",
        }}>
          {month}
        </span>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: "#080f1e", border: "1px solid #0f2040",
      borderRadius: 8, padding: "10px 14px",
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 8, color: "#475569", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, color, fontFamily: "'Space Mono', monospace", fontWeight: "bold", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 8, color: "#334155", fontFamily: "'Space Mono', monospace", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metric, setMetric] = useState("total_outage_customer_hours");
  const [month, setMonth] = useState("2022-09");
  const [selectedFips, setSelectedFips] = useState(null);

  // Fetch data
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Embed data directly since fetch may not work in artifact context
        const response = await fetch("https://raw.githubusercontent.com/placeholder/pr_outage_monthly.json").catch(() => null);
        // Fallback: use embedded data if fetch fails
        if (!response || !response.ok) {
          // Use inline data embedded in the app
          const embedded = EMBEDDED_DATA;
          setData(embedded);
          const allMonths = [...new Set(embedded.map((d) => d.month))].sort();
          setMonth(allMonths.includes("2022-09") ? "2022-09" : allMonths[allMonths.length - 1]);
        } else {
          const json = await response.json();
          setData(json);
          const allMonths = [...new Set(json.map((d) => d.month))].sort();
          setMonth(allMonths.includes("2022-09") ? "2022-09" : allMonths[allMonths.length - 1]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const months = useMemo(() => [...new Set(data.map((d) => d.month))].sort(), [data]);
  const metricCfg = METRICS.find((m) => m.key === metric);

  // Summary stats for current month
  const monthSummary = useMemo(() => {
    const md = data.filter((d) => d.month === month);
    if (!md.length) return null;
    const total = md.reduce((s, d) => s + (d.total_outage_customer_hours ?? 0), 0);
    const maxPeak = Math.max(...md.map((d) => d.peak_customers_out ?? 0));
    const totalEvents = md.reduce((s, d) => s + (d.event_count ?? 0), 0);
    const worstFips = md.sort((a, b) => b[metric] - a[metric])[0]?.fips;
    return { total, maxPeak, totalEvents, worstFips };
  }, [data, month, metric]);

  if (loading) {
    return (
      <div style={{
        background: "#060d1a", height: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "2px solid #1e3a5f", borderTop: "2px solid #3b82f6",
          animation: "spin 0.8s linear infinite",
        }} />
        <div style={{ color: "#475569", fontFamily: "'Space Mono', monospace", fontSize: 12 }}>
          Loading outage data...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: "#060d1a", height: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          color: "#ef4444", fontFamily: "'Space Mono', monospace", fontSize: 13,
          background: "#1a0a0a", padding: "16px 24px", borderRadius: 8,
          border: "1px solid #450a0a",
        }}>
          Error loading data: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "#060d1a", minHeight: "100vh", display: "flex", flexDirection: "column",
      fontFamily: "'Space Mono', monospace", color: "#f1f5f9",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{
        padding: "16px 24px 12px",
        borderBottom: "1px solid #0f2040",
        background: "linear-gradient(180deg, #060d1a 0%, #080f1e 100%)",
        display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 9, color: "#1e40af", letterSpacing: "0.2em", marginBottom: 4, textTransform: "uppercase" }}>
            Puerto Rico · Spatial Power Outage Analysis · 2021–2022
          </div>
          <h1 style={{
            margin: 0, fontSize: 22,
            fontFamily: "'Libre Baskerville', serif",
            fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2,
          }}>
            Mapping the Dark: Spatial Inequity<br />
            <span style={{ color: "#3b82f6" }}>in Grid Disruption</span>
          </h1>
          <div style={{ marginTop: 6, fontSize: 9, color: "#334155", maxWidth: 520, lineHeight: 1.6 }}>
            Does the burden of power outages fall equally across Puerto Rico's 78 municipios? 
            Explore three dimensions of disruption: cumulative burden, systemic instability, and acute shock.
          </div>
        </div>

        {/* Summary stats */}
        {monthSummary && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatCard
              label="ISLAND BURDEN"
              value={`${(monthSummary.total / 1e6).toFixed(1)}M`}
              color="#3b82f6"
              sub="customer-hours lost"
            />
            <StatCard
              label="PEAK SHOCK"
              value={`${(monthSummary.maxPeak / 1e3).toFixed(0)}K`}
              color="#f59e0b"
              sub="simultaneous outages"
            />
            <StatCard
              label="EVENT COUNT"
              value={monthSummary.totalEvents}
              color="#22c55e"
              sub="discrete events island-wide"
            />
          </div>
        )}
      </header>

      {/* Metric description bar */}
      <div style={{
        padding: "8px 24px",
        background: `${metricCfg.stops[2]}0a`,
        borderBottom: `1px solid ${metricCfg.stops[2]}20`,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          fontSize: 9, color: metricCfg.stops[2], letterSpacing: "0.15em",
          fontWeight: "bold", textTransform: "uppercase",
        }}>
          {metricCfg.label}
        </div>
        <div style={{ width: 1, height: 12, background: "#1e3a5f" }} />
        <div style={{ fontSize: 10, color: "#475569" }}>
          {metricCfg.desc}
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "1fr 340px",
        gap: 0,
        minHeight: 0,
        overflow: "hidden",
      }}>
        {/* Map */}
        <div style={{
          padding: 20,
          borderRight: "1px solid #0f2040",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{
            fontSize: 9, color: "#334155", letterSpacing: "0.1em",
            marginBottom: 8, textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: metricCfg.stops[2], display: "inline-block" }} />
            Choropleth · {metricCfg.sublabel} · {month}
          </div>
          <div style={{ flex: 1, minHeight: 280 }}>
            <ChoroplethMap
              data={data}
              metric={metric}
              month={month}
              selectedFips={selectedFips}
              onSelectFips={setSelectedFips}
            />
          </div>
          <div style={{
            marginTop: 10, fontSize: 9, color: "#1e3a5f",
            fontFamily: "'Space Mono', monospace", textAlign: "center",
          }}>
            Click any municipio to inspect its time series →
          </div>
        </div>

        {/* Side panel */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
          {/* Selected municipio info */}
          {selectedFips && (
            <div style={{
              background: "#080f1e", borderRadius: 8, padding: "10px 14px",
              border: `1px solid ${metricCfg.stops[2]}30`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>
                  Selected
                </div>
                <div style={{ fontSize: 16, color: "#f1f5f9", fontFamily: "'Libre Baskerville', serif", fontWeight: "bold" }}>
                  {MUNICIPIO_NAMES[selectedFips] || selectedFips}
                </div>
                <div style={{ fontSize: 8, color: "#334155", marginTop: 1 }}>FIPS {selectedFips}</div>
              </div>
              <button
                onClick={() => setSelectedFips(null)}
                style={{
                  background: "transparent", border: "1px solid #1e3a5f",
                  color: "#475569", borderRadius: 4, padding: "4px 8px",
                  fontSize: 10, cursor: "pointer", fontFamily: "'Space Mono', monospace",
                }}
              >
                ✕ Clear
              </button>
            </div>
          )}

          {/* Chart */}
          <div style={{ flex: 1, minHeight: 200 }}>
            <ChartPanel data={data} fips={selectedFips} metric={metric} />
          </div>

          {/* Top municipios for current month & metric */}
          <div>
            <div style={{
              fontSize: 9, color: "#334155", letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: 8,
            }}>
              Top 5 · {month}
            </div>
            {data
              .filter((d) => d.month === month)
              .sort((a, b) => b[metric] - a[metric])
              .slice(0, 5)
              .map((d, i) => {
                const allVals = data.filter((x) => x.month === month).map((x) => x[metric]);
                const max = Math.max(...allVals);
                const pct = ((d[metric] / max) * 100).toFixed(0);
                return (
                  <div
                    key={d.fips}
                    onClick={() => setSelectedFips(d.fips === selectedFips ? null : d.fips)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      marginBottom: 6, cursor: "pointer", padding: "4px 6px",
                      borderRadius: 4,
                      background: selectedFips === d.fips ? `${metricCfg.stops[2]}10` : "transparent",
                      transition: "background 0.2s",
                    }}
                  >
                    <span style={{ fontSize: 9, color: "#334155", width: 12, textAlign: "right" }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>
                          {MUNICIPIO_NAMES[d.fips] || d.fips}
                        </span>
                        <span style={{ fontSize: 9, color: metricCfg.stops[2] }}>
                          {metricCfg.format(d[metric])}
                        </span>
                      </div>
                      <div style={{ height: 3, background: "#0f2040", borderRadius: 2 }}>
                        <div style={{
                          height: "100%", width: `${pct}%`,
                          background: metricCfg.stops[2], borderRadius: 2,
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <Controls
        metric={metric}
        setMetric={setMetric}
        month={month}
        setMonth={setMonth}
        months={months}
      />
    </div>
  );
}

// ─── Embedded data (inline fallback) ─────────────────────────────────────────
const EMBEDDED_DATA = [{"fips":"72013","month":"2021-01","total_outage_customer_hours":14350.5,"event_count":2,"peak_customers_out":2353.0,"avg_customers_out":113.89},{"fips":"72013","month":"2021-02","total_outage_customer_hours":367192.0,"event_count":36,"peak_customers_out":23905.0,"avg_customers_out":552.17},{"fips":"72013","month":"2021-03","total_outage_customer_hours":215984.75,"event_count":31,"peak_customers_out":20357.0,"avg_customers_out":294.26},{"fips":"72013","month":"2021-04","total_outage_customer_hours":158895.75,"event_count":14,"peak_customers_out":16780.0,"avg_customers_out":282.48},{"fips":"72013","month":"2021-05","total_outage_customer_hours":560479.25,"event_count":45,"peak_customers_out":17194.0,"avg_customers_out":832.19},{"fips":"72013","month":"2021-06","total_outage_customer_hours":209240.0,"event_count":17,"peak_customers_out":9138.0,"avg_customers_out":415.78},{"fips":"72013","month":"2021-07","total_outage_customer_hours":334634.5,"event_count":31,"peak_customers_out":10775.0,"avg_customers_out":451.29},{"fips":"72013","month":"2021-08","total_outage_customer_hours":552066.5,"event_count":34,"peak_customers_out":23909.0,"avg_customers_out":743.52},{"fips":"72013","month":"2021-09","total_outage_customer_hours":1375374.25,"event_count":35,"peak_customers_out":61526.0,"avg_customers_out":1941.93},{"fips":"72013","month":"2021-10","total_outage_customer_hours":311621.75,"event_count":21,"peak_customers_out":6407.0,"avg_customers_out":425.42},{"fips":"72013","month":"2021-11","total_outage_customer_hours":230583.0,"event_count":27,"peak_customers_out":9808.0,"avg_customers_out":324.08},{"fips":"72013","month":"2021-12","total_outage_customer_hours":402530.5,"event_count":37,"peak_customers_out":15984.0,"avg_customers_out":566.55},{"fips":"72013","month":"2022-01","total_outage_customer_hours":100815.25,"event_count":8,"peak_customers_out":10671.0,"avg_customers_out":150.13},{"fips":"72013","month":"2022-02","total_outage_customer_hours":136300.25,"event_count":28,"peak_customers_out":7933.0,"avg_customers_out":214.06},{"fips":"72013","month":"2022-03","total_outage_customer_hours":315190.75,"event_count":25,"peak_customers_out":12261.0,"avg_customers_out":443.93},{"fips":"72013","month":"2022-04","total_outage_customer_hours":298534.75,"event_count":19,"peak_customers_out":17254.0,"avg_customers_out":512.51},{"fips":"72013","month":"2022-05","total_outage_customer_hours":407939.25,"event_count":38,"peak_customers_out":8275.0,"avg_customers_out":552.76},{"fips":"72013","month":"2022-06","total_outage_customer_hours":548885.75,"event_count":39,"peak_customers_out":17422.0,"avg_customers_out":769.83},{"fips":"72013","month":"2022-07","total_outage_customer_hours":522008.0,"event_count":35,"peak_customers_out":9876.0,"avg_customers_out":706.13},{"fips":"72013","month":"2022-08","total_outage_customer_hours":671930.75,"event_count":54,"peak_customers_out":22708.0,"avg_customers_out":931.94},{"fips":"72013","month":"2022-09","total_outage_customer_hours":38030497.25,"event_count":31,"peak_customers_out":191803.0,"avg_customers_out":53152.34},{"fips":"72013","month":"2022-10","total_outage_customer_hours":2454100.25,"event_count":43,"peak_customers_out":46582.0,"avg_customers_out":3302.96},{"fips":"72013","month":"2022-11","total_outage_customer_hours":171691.5,"event_count":13,"peak_customers_out":14072.0,"avg_customers_out":608.30},{"fips":"72021","month":"2021-01","total_outage_customer_hours":45239.75,"event_count":9,"peak_customers_out":6476.0,"avg_customers_out":359.05},{"fips":"72021","month":"2021-02","total_outage_customer_hours":176936.0,"event_count":42,"peak_customers_out":12626.0,"avg_customers_out":270.03},{"fips":"72021","month":"2021-03","total_outage_customer_hours":199243.0,"event_count":34,"peak_customers_out":10198.0,"avg_customers_out":269.52},{"fips":"72021","month":"2021-04","total_outage_customer_hours":137605.75,"event_count":28,"peak_customers_out":13720.0,"avg_customers_out":245.40},{"fips":"72021","month":"2021-05","total_outage_customer_hours":885068.75,"event_count":42,"peak_customers_out":23871.0,"avg_customers_out":1314.13},{"fips":"72021","month":"2021-06","total_outage_customer_hours":311039.75,"event_count":25,"peak_customers_out":13330.0,"avg_customers_out":1108.88},{"fips":"72021","month":"2021-07","total_outage_customer_hours":736020.25,"event_count":41,"peak_customers_out":12108.0,"avg_customers_out":990.61},{"fips":"72021","month":"2021-08","total_outage_customer_hours":664546.25,"event_count":42,"peak_customers_out":33949.0,"avg_customers_out":895.01},{"fips":"72021","month":"2021-09","total_outage_customer_hours":1375021.0,"event_count":49,"peak_customers_out":45049.0,"avg_customers_out":1941.43},{"fips":"72021","month":"2021-10","total_outage_customer_hours":495232.75,"event_count":45,"peak_customers_out":12001.0,"avg_customers_out":676.78},{"fips":"72021","month":"2021-11","total_outage_customer_hours":260516.5,"event_count":32,"peak_customers_out":7465.0,"avg_customers_out":374.44},{"fips":"72021","month":"2021-12","total_outage_customer_hours":351843.25,"event_count":31,"peak_customers_out":13216.0,"avg_customers_out":493.99},{"fips":"72021","month":"2022-01","total_outage_customer_hours":151419.25,"event_count":24,"peak_customers_out":8176.0,"avg_customers_out":219.21},{"fips":"72021","month":"2022-02","total_outage_customer_hours":571010.0,"event_count":40,"peak_customers_out":25673.0,"avg_customers_out":891.85},{"fips":"72021","month":"2022-03","total_outage_customer_hours":258515.75,"event_count":23,"peak_customers_out":10569.0,"avg_customers_out":355.47},{"fips":"72021","month":"2022-04","total_outage_customer_hours":750091.5,"event_count":27,"peak_customers_out":42003.0,"avg_customers_out":1271.88},{"fips":"72021","month":"2022-05","total_outage_customer_hours":481280.5,"event_count":52,"peak_customers_out":12507.0,"avg_customers_out":651.92},{"fips":"72021","month":"2022-06","total_outage_customer_hours":489018.5,"event_count":66,"peak_customers_out":19972.0,"avg_customers_out":703.37},{"fips":"72021","month":"2022-07","total_outage_customer_hours":656147.25,"event_count":48,"peak_customers_out":22921.0,"avg_customers_out":882.51},{"fips":"72021","month":"2022-08","total_outage_customer_hours":1219676.25,"event_count":62,"peak_customers_out":86718.0,"avg_customers_out":1685.22},{"fips":"72021","month":"2022-09","total_outage_customer_hours":14769911.5,"event_count":47,"peak_customers_out":145204.0,"avg_customers_out":20556.59},{"fips":"72021","month":"2022-10","total_outage_customer_hours":998799.0,"event_count":43,"peak_customers_out":32275.0,"avg_customers_out":1347.45},{"fips":"72021","month":"2022-11","total_outage_customer_hours":178192.5,"event_count":21,"peak_customers_out":13914.0,"avg_customers_out":653.92},{"fips":"72025","month":"2021-01","total_outage_customer_hours":21681.25,"event_count":4,"peak_customers_out":8098.0,"avg_customers_out":199.83},{"fips":"72025","month":"2021-02","total_outage_customer_hours":333022.25,"event_count":38,"peak_customers_out":33921.0,"avg_customers_out":500.79},{"fips":"72025","month":"2021-03","total_outage_customer_hours":236882.5,"event_count":40,"peak_customers_out":26021.0,"avg_customers_out":320.44},{"fips":"72025","month":"2021-04","total_outage_customer_hours":124821.75,"event_count":20,"peak_customers_out":8973.0,"avg_customers_out":222.20},{"fips":"72025","month":"2021-05","total_outage_customer_hours":632915.75,"event_count":57,"peak_customers_out":60544.0,"avg_customers_out":939.74},{"fips":"72025","month":"2021-06","total_outage_customer_hours":351988.0,"event_count":26,"peak_customers_out":13906.0,"avg_customers_out":791.86},{"fips":"72025","month":"2021-07","total_outage_customer_hours":478040.5,"event_count":42,"peak_customers_out":16074.0,"avg_customers_out":643.33},{"fips":"72025","month":"2021-08","total_outage_customer_hours":650946.75,"event_count":40,"peak_customers_out":28131.0,"avg_customers_out":876.20},{"fips":"72025","month":"2021-09","total_outage_customer_hours":1572040.75,"event_count":46,"peak_customers_out":51720.0,"avg_customers_out":2218.39},{"fips":"72025","month":"2021-10","total_outage_customer_hours":498424.75,"event_count":38,"peak_customers_out":14580.0,"avg_customers_out":680.57},{"fips":"72025","month":"2021-11","total_outage_customer_hours":276099.75,"event_count":27,"peak_customers_out":7892.0,"avg_customers_out":396.96},{"fips":"72025","month":"2021-12","total_outage_customer_hours":375521.5,"event_count":35,"peak_customers_out":14430.0,"avg_customers_out":530.17},{"fips":"72025","month":"2022-01","total_outage_customer_hours":127842.25,"event_count":19,"peak_customers_out":8294.0,"avg_customers_out":184.87},{"fips":"72025","month":"2022-02","total_outage_customer_hours":344628.5,"event_count":45,"peak_customers_out":18932.0,"avg_customers_out":524.42},{"fips":"72025","month":"2022-03","total_outage_customer_hours":298764.0,"event_count":34,"peak_customers_out":11503.0,"avg_customers_out":422.82},{"fips":"72025","month":"2022-04","total_outage_customer_hours":695428.5,"event_count":30,"peak_customers_out":37140.0,"avg_customers_out":1201.77},{"fips":"72025","month":"2022-05","total_outage_customer_hours":387502.0,"event_count":46,"peak_customers_out":12046.0,"avg_customers_out":527.41},{"fips":"72025","month":"2022-06","total_outage_customer_hours":469281.25,"event_count":49,"peak_customers_out":14736.0,"avg_customers_out":664.08},{"fips":"72025","month":"2022-07","total_outage_customer_hours":522750.75,"event_count":46,"peak_customers_out":10926.0,"avg_customers_out":708.00},{"fips":"72025","month":"2022-08","total_outage_customer_hours":799382.5,"event_count":52,"peak_customers_out":40236.0,"avg_customers_out":1109.75},{"fips":"72025","month":"2022-09","total_outage_customer_hours":22157310.25,"event_count":38,"peak_customers_out":172183.0,"avg_customers_out":30822.65},{"fips":"72025","month":"2022-10","total_outage_customer_hours":5208452.5,"event_count":40,"peak_customers_out":79891.0,"avg_customers_out":7032.99},{"fips":"72025","month":"2022-11","total_outage_customer_hours":245621.5,"event_count":22,"peak_customers_out":19843.0,"avg_customers_out":861.20},{"fips":"72097","month":"2021-01","total_outage_customer_hours":52103.0,"event_count":8,"peak_customers_out":9214.0,"avg_customers_out":413.51},{"fips":"72097","month":"2021-02","total_outage_customer_hours":421838.25,"event_count":52,"peak_customers_out":36021.0,"avg_customers_out":633.45},{"fips":"72097","month":"2021-03","total_outage_customer_hours":298476.0,"event_count":44,"peak_customers_out":22187.0,"avg_customers_out":403.60},{"fips":"72097","month":"2021-04","total_outage_customer_hours":201243.5,"event_count":28,"peak_customers_out":14870.0,"avg_customers_out":358.27},{"fips":"72097","month":"2021-05","total_outage_customer_hours":820943.75,"event_count":64,"peak_customers_out":35482.0,"avg_customers_out":1218.08},{"fips":"72097","month":"2021-06","total_outage_customer_hours":478291.0,"event_count":34,"peak_customers_out":17036.0,"avg_customers_out":854.09},{"fips":"72097","month":"2021-07","total_outage_customer_hours":654218.5,"event_count":48,"peak_customers_out":20117.0,"avg_customers_out":880.94},{"fips":"72097","month":"2021-08","total_outage_customer_hours":935471.25,"event_count":55,"peak_customers_out":50928.0,"avg_customers_out":1259.55},{"fips":"72097","month":"2021-09","total_outage_customer_hours":2418023.75,"event_count":52,"peak_customers_out":88421.0,"avg_customers_out":3413.42},{"fips":"72097","month":"2021-10","total_outage_customer_hours":672834.25,"event_count":48,"peak_customers_out":18429.0,"avg_customers_out":918.08},{"fips":"72097","month":"2021-11","total_outage_customer_hours":389124.5,"event_count":41,"peak_customers_out":13712.0,"avg_customers_out":549.47},{"fips":"72097","month":"2021-12","total_outage_customer_hours":521847.0,"event_count":50,"peak_customers_out":21483.0,"avg_customers_out":734.43},{"fips":"72097","month":"2022-01","total_outage_customer_hours":198432.0,"event_count":31,"peak_customers_out":14123.0,"avg_customers_out":286.89},{"fips":"72097","month":"2022-02","total_outage_customer_hours":472819.5,"event_count":48,"peak_customers_out":28741.0,"avg_customers_out":714.65},{"fips":"72097","month":"2022-03","total_outage_customer_hours":356291.75,"event_count":37,"peak_customers_out":15982.0,"avg_customers_out":502.52},{"fips":"72097","month":"2022-04","total_outage_customer_hours":1024837.25,"event_count":42,"peak_customers_out":59823.0,"avg_customers_out":1771.17},{"fips":"72097","month":"2022-05","total_outage_customer_hours":614293.5,"event_count":58,"peak_customers_out":18942.0,"avg_customers_out":832.32},{"fips":"72097","month":"2022-06","total_outage_customer_hours":728483.75,"event_count":63,"peak_customers_out":25183.0,"avg_customers_out":1038.00},{"fips":"72097","month":"2022-07","total_outage_customer_hours":720951.5,"event_count":53,"peak_customers_out":12156.0,"avg_customers_out":980.55},{"fips":"72097","month":"2022-08","total_outage_customer_hours":1162773.5,"event_count":54,"peak_customers_out":37018.0,"avg_customers_out":1608.82},{"fips":"72097","month":"2022-09","total_outage_customer_hours":54356643.5,"event_count":34,"peak_customers_out":219197.0,"avg_customers_out":75652.95},{"fips":"72097","month":"2022-10","total_outage_customer_hours":22757604.0,"event_count":31,"peak_customers_out":125619.0,"avg_customers_out":30629.35},{"fips":"72097","month":"2022-11","total_outage_customer_hours":368233.5,"event_count":21,"peak_customers_out":23327.0,"avg_customers_out":1303.48},{"fips":"72113","month":"2021-01","total_outage_customer_hours":30901.25,"event_count":6,"peak_customers_out":6799.0,"avg_customers_out":245.25},{"fips":"72113","month":"2021-02","total_outage_customer_hours":269202.5,"event_count":34,"peak_customers_out":7827.0,"avg_customers_out":410.21},{"fips":"72113","month":"2021-03","total_outage_customer_hours":267404.0,"event_count":39,"peak_customers_out":11439.0,"avg_customers_out":386.70},{"fips":"72113","month":"2021-04","total_outage_customer_hours":257760.75,"event_count":23,"peak_customers_out":19400.0,"avg_customers_out":479.55},{"fips":"72113","month":"2021-05","total_outage_customer_hours":492222.25,"event_count":30,"peak_customers_out":16277.0,"avg_customers_out":752.63},{"fips":"72113","month":"2021-06","total_outage_customer_hours":474489.5,"event_count":16,"peak_customers_out":27323.0,"avg_customers_out":895.26},{"fips":"72113","month":"2021-07","total_outage_customer_hours":294752.25,"event_count":26,"peak_customers_out":9893.0,"avg_customers_out":397.24},{"fips":"72113","month":"2021-08","total_outage_customer_hours":717111.0,"event_count":40,"peak_customers_out":34458.0,"avg_customers_out":969.72},{"fips":"72113","month":"2021-09","total_outage_customer_hours":1702653.0,"event_count":45,"peak_customers_out":65301.0,"avg_customers_out":2423.71},{"fips":"72113","month":"2021-10","total_outage_customer_hours":347578.0,"event_count":41,"peak_customers_out":8774.0,"avg_customers_out":476.62},{"fips":"72113","month":"2021-11","total_outage_customer_hours":159263.25,"event_count":34,"peak_customers_out":8586.0,"avg_customers_out":226.07},{"fips":"72113","month":"2021-12","total_outage_customer_hours":293538.25,"event_count":29,"peak_customers_out":24661.0,"avg_customers_out":425.57},{"fips":"72113","month":"2022-01","total_outage_customer_hours":129039.25,"event_count":31,"peak_customers_out":10227.0,"avg_customers_out":186.41},{"fips":"72113","month":"2022-02","total_outage_customer_hours":156630.5,"event_count":28,"peak_customers_out":11143.0,"avg_customers_out":269.01},{"fips":"72113","month":"2022-03","total_outage_customer_hours":374292.25,"event_count":32,"peak_customers_out":11638.0,"avg_customers_out":559.06},{"fips":"72113","month":"2022-04","total_outage_customer_hours":2403522.0,"event_count":36,"peak_customers_out":154985.0,"avg_customers_out":4259.68},{"fips":"72113","month":"2022-05","total_outage_customer_hours":238250.5,"event_count":41,"peak_customers_out":10388.0,"avg_customers_out":326.15},{"fips":"72113","month":"2022-06","total_outage_customer_hours":290900.0,"event_count":30,"peak_customers_out":20374.0,"avg_customers_out":426.38},{"fips":"72113","month":"2022-07","total_outage_customer_hours":233965.5,"event_count":36,"peak_customers_out":9482.0,"avg_customers_out":323.60},{"fips":"72113","month":"2022-08","total_outage_customer_hours":444635.25,"event_count":39,"peak_customers_out":35641.0,"avg_customers_out":625.37},{"fips":"72113","month":"2022-09","total_outage_customer_hours":49423249.5,"event_count":39,"peak_customers_out":210593.0,"avg_customers_out":68930.61},{"fips":"72113","month":"2022-10","total_outage_customer_hours":16551797.25,"event_count":31,"peak_customers_out":120483.0,"avg_customers_out":22276.98},{"fips":"72113","month":"2022-11","total_outage_customer_hours":248747.0,"event_count":26,"peak_customers_out":22312.0,"avg_customers_out":880.52},{"fips":"72127","month":"2021-01","total_outage_customer_hours":153266.5,"event_count":10,"peak_customers_out":14257.0,"avg_customers_out":1216.40},{"fips":"72127","month":"2021-02","total_outage_customer_hours":259151.25,"event_count":30,"peak_customers_out":16191.0,"avg_customers_out":389.70},{"fips":"72127","month":"2021-03","total_outage_customer_hours":414195.0,"event_count":63,"peak_customers_out":15208.0,"avg_customers_out":560.29},{"fips":"72127","month":"2021-04","total_outage_customer_hours":303972.0,"event_count":35,"peak_customers_out":10584.0,"avg_customers_out":540.39},{"fips":"72127","month":"2021-05","total_outage_customer_hours":1036438.0,"event_count":52,"peak_customers_out":21332.0,"avg_customers_out":1538.88},{"fips":"72127","month":"2021-06","total_outage_customer_hours":731348.5,"event_count":35,"peak_customers_out":16176.0,"avg_customers_out":2607.30},{"fips":"72127","month":"2021-07","total_outage_customer_hours":482723.75,"event_count":58,"peak_customers_out":7503.0,"avg_customers_out":649.70},{"fips":"72127","month":"2021-08","total_outage_customer_hours":783909.5,"event_count":52,"peak_customers_out":33769.0,"avg_customers_out":1055.77},{"fips":"72127","month":"2021-09","total_outage_customer_hours":1755434.5,"event_count":49,"peak_customers_out":70333.0,"avg_customers_out":2478.55},{"fips":"72127","month":"2021-10","total_outage_customer_hours":781555.5,"event_count":72,"peak_customers_out":21488.0,"avg_customers_out":1066.97},{"fips":"72127","month":"2021-11","total_outage_customer_hours":243422.75,"event_count":40,"peak_customers_out":13546.0,"avg_customers_out":343.70},{"fips":"72127","month":"2021-12","total_outage_customer_hours":288957.75,"event_count":36,"peak_customers_out":22771.0,"avg_customers_out":410.16},{"fips":"72127","month":"2022-01","total_outage_customer_hours":295262.5,"event_count":29,"peak_customers_out":17344.0,"avg_customers_out":413.10},{"fips":"72127","month":"2022-02","total_outage_customer_hours":353670.0,"event_count":53,"peak_customers_out":16727.0,"avg_customers_out":536.47},{"fips":"72127","month":"2022-03","total_outage_customer_hours":303490.25,"event_count":46,"peak_customers_out":15166.0,"avg_customers_out":416.88},{"fips":"72127","month":"2022-04","total_outage_customer_hours":1002064.5,"event_count":37,"peak_customers_out":53963.0,"avg_customers_out":1732.93},{"fips":"72127","month":"2022-05","total_outage_customer_hours":452772.75,"event_count":45,"peak_customers_out":15534.0,"avg_customers_out":612.48},{"fips":"72127","month":"2022-06","total_outage_customer_hours":583550.75,"event_count":59,"peak_customers_out":13607.0,"avg_customers_out":818.44},{"fips":"72127","month":"2022-07","total_outage_customer_hours":543975.25,"event_count":46,"peak_customers_out":10214.0,"avg_customers_out":736.35},{"fips":"72127","month":"2022-08","total_outage_customer_hours":692702.75,"event_count":39,"peak_customers_out":38577.0,"avg_customers_out":971.87},{"fips":"72127","month":"2022-09","total_outage_customer_hours":10723648.5,"event_count":45,"peak_customers_out":97181.0,"avg_customers_out":14940.65},{"fips":"72127","month":"2022-10","total_outage_customer_hours":536840.25,"event_count":54,"peak_customers_out":24998.0,"avg_customers_out":722.53},{"fips":"72127","month":"2022-11","total_outage_customer_hours":126217.25,"event_count":16,"peak_customers_out":6646.0,"avg_customers_out":461.07}];
