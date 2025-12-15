import React, { useState } from "react";

// Datos base
const DESIGNS = [
  {
    id: "lampara1",
    nombre: "Lampara1 600x400 (44 min)",
    anchoBase: 600,
    altoBase: 400,
    tiempoBaseMin: 40,
  },
  {
    id: "lampara2",
    nombre: "Lampara2 240x70 (5 min)",
    anchoBase: 240,
    altoBase: 70,
    tiempoBaseMin: 5,
  },
  {
    id: "Pesebre1",
    nombre: "Pesebre1 600x400 (25 min)",
    anchoBase: 600,
    altoBase: 400,
    tiempoBaseMin: 25,
  },
  {
    id: "Pesebre2",
    nombre: "Pesebre2 600x400 (9 min)",
    anchoBase: 600,
    altoBase: 400,
    tiempoBaseMin: 9,
  },
];

function MDFCalculator() {
  const [form, setForm] = useState({
    // Todas las dimensiones están en mm
    anchoRect: 600, // ancho de la plancha (mm)
    altoRect: 400, // alto de la plancha (mm)
    anchoPieza: 100, // ancho de la pieza (mm)
    largoPieza: 100, // largo de la pieza (mm)
    cantidad: 1,
    costoRect: 1200, // costo por plancha completa
    markup: 2,
    kerf: 0,
    espesor: 3,
    tarifaMinuto: 100,
  });

  const [selectedDesign, setSelectedDesign] = useState(DESIGNS[0].id);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log("[handleChange]", name, value);
    setForm((f) => ({ ...f, [name]: value }));
  };

  // Al cambiar el diseño base, actualizamos selectedDesign y las dimensiones de la pieza
  const handleDesignChange = (e) => {
    const id = e.target.value;
    console.log("[handleDesignChange] nuevo diseño:", id);
    setSelectedDesign(id);
    const d = DESIGNS.find((x) => x.id === id);
    if (d) {
      console.log("[handleDesignChange] dimensiones base:", d.anchoBase, d.altoBase);
      // actualiza anchoPieza y largoPieza con las dimensiones del diseño (mm)
      setForm((f) => ({ ...f, anchoPieza: d.anchoBase, largoPieza: d.altoBase }));
    }
  };

  const calc = () => {
    try {
      console.log("[calc] form actual:", form);
      console.log("[calc] diseño seleccionado:", selectedDesign);

      const design = DESIGNS.find((d) => d.id === selectedDesign);
      if (!design) throw new Error("No se encontró el diseño base.");

      // dimensiones de pieza en mm
      const ap = parseFloat(form.anchoPieza);
      const lp = parseFloat(form.largoPieza);
      console.log("[calc] dimensiones pieza (ap, lp):", ap, lp);
      if (ap <= 0 || lp <= 0) throw new Error("Dimensiones de pieza inválidas.");

      // cálculo de tiempo escalado por área (asume diseño base en mm)
      const areaBase = design.anchoBase * design.altoBase;
      const areaNueva = ap * lp;
      const factor = areaNueva / areaBase;
      const tiempoCalculadoMin = design.tiempoBaseMin * factor;
      console.log("[calc] áreas y tiempo:", { areaBase, areaNueva, factor, tiempoCalculadoMin });

      // dimensiones de la plancha en mm
      const ar = parseFloat(form.anchoRect);
      const lr = parseFloat(form.altoRect);
      const cant = Math.max(1, parseInt(form.cantidad, 10) || 0);
      const cost = parseFloat(form.costoRect);
      const mk = parseFloat(form.markup);
      const kf = parseFloat(form.kerf) || 0;
      const tarifaMinuto = parseFloat(form.tarifaMinuto) || 0;
      const espesor = parseFloat(form.espesor);

      console.log("[calc] parámetros plancha:", { ar, lr, cant, cost, mk, kf, tarifaMinuto, espesor });

      if (ar <= 0 || lr <= 0) throw new Error("Dimensiones del rectángulo inválidas.");

      // Espacio efectivo considerando kerf
      const aw = Math.max(0, ar - kf);
      const ah = Math.max(0, lr - kf);
      console.log("[calc] área efectiva:", aw, ah);

      // cálculo de cuántas piezas caben según orientación
      const A_cols = Math.floor(aw / ap);
      const A_rows = Math.floor(ah / lp);
      const A = A_cols * A_rows;

      const B_cols = Math.floor(aw / lp);
      const B_rows = Math.floor(ah / ap);
      const B = B_cols * B_rows;

      const orientation = A >= B ? "A" : "B";
      const ppr = Math.max(A, B);

      console.log("[calc] layout:", { A_cols, A_rows, A, B_cols, B_rows, B, orientation, ppr });

      if (ppr <= 0) throw new Error("La pieza no cabe en el rectángulo.");

      // rectángulos necesarios si compro planchas enteras
      const rectsNeeded = Math.ceil(cant / ppr);
      console.log("[calc] rectángulos necesarios:", rectsNeeded);

      // ===== Material =====
      const areaSheet = ar * lr; // mm^2
      const areaPiece = ap * lp; // mm^2
      const totalAreaUsed = areaPiece * cant;
      const materialCostProportional = (totalAreaUsed / areaSheet) * cost;
      const materialCostBySheets = rectsNeeded * cost;

      console.log("[calc] material:", {
        areaSheet,
        areaPiece,
        totalAreaUsed,
        materialCostProportional,
        materialCostBySheets,
      });

      // ===== Máquina =====
      const totalMachineTime = tiempoCalculadoMin * cant; // minutos
      const machineCost = totalMachineTime * tarifaMinuto;
      console.log("[calc] máquina:", { totalMachineTime, machineCost });

      // ===== Totales =====
      const materialCost = materialCostProportional;
      const totalCost = materialCost + machineCost;
      const totalPrice = totalCost * mk;
      const unitPrice = totalPrice / cant;
      const costPerPiece = totalCost / cant;
      const delta = totalPrice - totalCost;

      console.log("[calc] totales:", {
        materialCost,
        totalCost,
        totalPrice,
        unitPrice,
        costPerPiece,
        delta,
      });

      setResult({
        ppr,
        rectsNeeded,
        materialCost,
        materialCostBySheets,
        materialCostProportional,
        machineCost,
        totalCost,
        totalPrice,
        unitPrice,
        costPerPiece,
        espesor,
        tiempoCalculadoMin,
        totalMachineTime,
        delta,
        designName: design.nombre,
        layout: {
          orientation,
          A_cols,
          A_rows,
          B_cols,
          B_rows,
          ar,
          lr,
          ap,
          lp,
          kerf: kf,
          cant,
        },
      });
      setError(null);
    } catch (e) {
      console.error("[calc][error]", e);
      setError(e.message);
      setResult(null);
    }
  };

  // Dibuja una vista previa SVG del rectángulo y la disposición de piezas
  const PreviewSVG = ({ layout }) => {
    if (!layout) return null;
    console.log("[PreviewSVG] layout:", layout);

    const { ar, lr, ap, lp, kerf, orientation, A_cols, A_rows, B_cols, B_rows } = layout;

    // Escala para mostrar en un área fija
    const viewW = 540;
    const viewH = 360;
    const scale = Math.min(viewW / ar, viewH / lr);

    // elegir orientación
    let cols, rows, pw, ph;
    if (orientation === "A") {
      cols = A_cols;
      rows = A_rows;
      pw = ap;
      ph = lp;
    } else {
      cols = B_cols;
      rows = B_rows;
      pw = lp;
      ph = ap;
    }

    console.log("[PreviewSVG] render:", { cols, rows, pw, ph, scale });

    const margin = 8;
    const pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pieces.push({ x: c * pw, y: r * ph, w: pw, h: ph });
      }
    }

    return (
      <div className="w-full overflow-auto border border-slate-200 rounded-lg bg-white p-3">
        <svg
          width={Math.min(viewW, ar * scale + margin * 2)}
          height={Math.min(viewH, lr * scale + margin * 2)}
          viewBox={`0 0 ${ar * scale + margin * 2} ${lr * scale + margin * 2}`}
          className="block mx-auto"
        >
          <rect
            x={margin}
            y={margin}
            width={ar * scale}
            height={lr * scale}
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth={1}
            rx={6}
          />

          {kerf > 0 && (
            <rect
              x={margin}
              y={margin}
              width={(ar - kerf) * scale}
              height={(lr - kerf) * scale}
              fill="none"
              stroke="#fde68a"
              strokeDasharray="4 3"
            />
          )}

          {pieces.map((p, i) => (
            <g key={i}>
              <rect
                x={margin + p.x * scale}
                y={margin + p.y * scale}
                width={Math.max(0.5, p.w * scale - 0.5)}
                height={Math.max(0.5, p.h * scale - 0.5)}
                fill="#e0f2fe"
                stroke="#0284c7"
                strokeWidth={0.8}
                rx={2}
              />
              <text
                x={margin + (p.x + p.w / 2) * scale}
                y={margin + (p.y + p.h / 2) * scale + 3}
                fontSize={10}
                textAnchor="middle"
                fill="#075985"
              >
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-start justify-center p-6">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Calculadora MDF láser — Vista previa</h1>
        <p className="text-sm text-slate-500 mb-6">Calcula tiempo y costos y muestra una vista previa de cómo se disponen las piezas en el rectángulo.</p>

        <div className="mb-6">
          <label className="text-xs font-medium text-slate-600">DISEÑO BASE</label>
          <select
            value={selectedDesign}
            onChange={handleDesignChange}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full md:w-1/2 mt-1"
          >
            {DESIGNS.map((d) => (
              <option key={d.id} value={d.id}>{d.nombre}</option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {Object.entries(form).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">{key.replace(/([A-Z])/g, " $1").toUpperCase()}</label>
              <input name={key} value={val} onChange={handleChange} type="number" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
        </div>

        <div className="flex gap-3 items-center">
          <button onClick={calc} className="px-6 py-2.5 text-sm font-semibold rounded-full bg-blue-600 text-white shadow hover:bg-blue-700">
            Calcular
          </button>
        </div>

        {error && <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">{error}</div>}

        {result && (
          <div className="mt-8 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border">
                <h2 className="font-semibold mb-2">Datos generales</h2>
                <ul className="text-sm space-y-1 text-slate-700">
                <li>Diseño base: <strong>{result.designName}</strong></li>
                <li>Tiempo estimado (por pieza): <strong>{result.tiempoCalculadoMin.toFixed(2)} min</strong></li>
                <li>Tiempo total máquina: <strong>{result.totalMachineTime.toFixed(2)} min</strong></li>
                <li>Espesor: <strong>{result.espesor} mm</strong></li>
                <li>Piezas por rectángulo: <strong>{result.ppr}</strong></li>
                <li>Rectángulos necesarios: <strong>{result.rectsNeeded}</strong></li>
                <li>Delta (venta - costo): <strong>{result.delta.toFixed(0)} CLP</strong></li>
              </ul>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border">
                <h2 className="font-semibold mb-2">Costos</h2>
                <ul className="text-sm space-y-1 text-slate-700">
                <li>Costo material (proporcional): <strong>{result.materialCost.toFixed(0)} CLP</strong></li>
                <li>Costo material (planchas completas): <strong>{result.materialCostBySheets.toFixed(0)} CLP</strong></li>
                <li>Costo máquina: <strong>{result.machineCost.toFixed(0)} CLP</strong></li>
                <li>Costo total: <strong>{result.totalCost.toFixed(0)} CLP</strong></li>
                <li>Venta total: <strong>{result.totalPrice.toFixed(0)} CLP</strong></li>
                <li>Precio unitario: <strong>{result.unitPrice.toFixed(2)} CLP</strong></li>
                <li>Costo por pieza: <strong>{result.costPerPiece.toFixed(2)} CLP</strong></li>
                <li>Delta (venta - costo): <strong>{result.delta.toFixed(0)} CLP</strong></li>
              </ul>
              </div>
            </div>

            <div className="p-4 rounded-xl border">
              <h2 className="font-semibold text-center mb-3">
                Vista previa de corte
              </h2>
              <PreviewSVG layout={result.layout} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return <MDFCalculator />;
}
