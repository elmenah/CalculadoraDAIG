import React, { useEffect, useState } from "react";
import { supabase } from "/supabase";

function MDFCalculator() {
  const [form, setForm] = useState({
    anchoRect: 600,
    altoRect: 400,
    anchoPieza: 100,
    largoPieza: 100,
    cantidad: 1,
    costoRect: 1200,
    markup: 2,
    kerf: 0,
    espesor: 3,
    tarifaMinuto: 100,
  });

  // ⬇️ ahora los diseños vienen desde Supabase
  const [DESIGNS, setDESIGNS] = useState([]);
  const [selectedDesign, setSelectedDesign] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  /* =========================
     CARGA DISEÑOS DESDE SUPABASE
     ========================= */
  useEffect(() => {
    const loadDesigns = async () => {
      const { data, error } = await supabase
        .from("designs")
        .select("id, nombre, ancho_base_mm, alto_base_mm, tiempo_base_min")
        .eq("activo", true)
        .order("nombre");

      if (error) {
        console.error(error);
        setError("Error cargando diseños desde Supabase");
        return;
      }

      const mapped = data.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        anchoBase: d.ancho_base_mm,
        altoBase: d.alto_base_mm,
        tiempoBaseMin: Number(d.tiempo_base_min),
      }));

      setDESIGNS(mapped);

      // seleccionar el primero por defecto
      if (mapped.length > 0) {
        setSelectedDesign(mapped[0].id);
        setForm((f) => ({
          ...f,
          anchoPieza: mapped[0].anchoBase,
          largoPieza: mapped[0].altoBase,
        }));
      }
    };

    loadDesigns();
  }, []);

  /* =========================
     HANDLERS (SIN CAMBIOS VISUALES)
     ========================= */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleDesignChange = (e) => {
    const id = e.target.value;
    setSelectedDesign(id);

    const d = DESIGNS.find((x) => x.id === id);
    if (d) {
      setForm((f) => ({
        ...f,
        anchoPieza: d.anchoBase,
        largoPieza: d.altoBase,
      }));
    }
  };

  /* =========================
     CÁLCULO (MISMA LÓGICA)
     ========================= */
  const calc = () => {
    try {
      const design = DESIGNS.find((d) => d.id === selectedDesign);
      if (!design) throw new Error("No se encontró el diseño base.");

      const ap = parseFloat(form.anchoPieza);
      const lp = parseFloat(form.largoPieza);
      const cant = Math.max(1, parseInt(form.cantidad, 10));
      const espesor = parseFloat(form.espesor);

      // ===== TIEMPO DE MÁQUINA =====
      const areaBase = design.anchoBase * design.altoBase;
      const areaNueva = ap * lp;

      const tiempoCalculadoMin =
        design.tiempoBaseMin * (areaNueva / areaBase);

      const totalMachineTime = tiempoCalculadoMin * cant;
      const machineCost = totalMachineTime * parseFloat(form.tarifaMinuto);

      // ===== MATERIAL =====
      const ar = parseFloat(form.anchoRect);
      const lr = parseFloat(form.altoRect);
      const costRect = parseFloat(form.costoRect);
      const kerf = parseFloat(form.kerf) || 0;

      const aw = Math.max(0, ar - kerf);
      const ah = Math.max(0, lr - kerf);

      const A = Math.floor(aw / ap) * Math.floor(ah / lp);
      const B = Math.floor(aw / lp) * Math.floor(ah / ap);
      const ppr = Math.max(A, B);

      if (ppr <= 0) throw new Error("La pieza no cabe en la plancha.");

      const areaSheet = ar * lr;
      const areaTotalPiezas = ap * lp * cant;

      // 👉 ESTE es el costo que se usa para el precio
      const materialCostProportional =
        (areaTotalPiezas / areaSheet) * costRect;

      // 👉 Solo informativo
      const rectsNeeded = Math.ceil(cant / ppr);
      const materialCostBySheets = rectsNeeded * costRect;

      // ===== TOTALES =====
      const totalCost = materialCostProportional + machineCost;
      const markup = parseFloat(form.markup);
      const totalPrice = totalCost * markup;

      setResult({
        ppr,
        rectsNeeded,
        materialCost: materialCostProportional,
        materialCostProportional,
        materialCostBySheets,
        machineCost,
        totalCost,
        totalPrice,
        unitPrice: totalPrice / cant,
        costPerPiece: totalCost / cant,
        espesor,
        tiempoCalculadoMin,
        totalMachineTime,
        delta: totalPrice - totalCost,
        designName: design.nombre,
        layout: {
          orientation: A >= B ? "A" : "B",
          A_cols: Math.floor(aw / ap),
          A_rows: Math.floor(ah / lp),
          B_cols: Math.floor(aw / lp),
          B_rows: Math.floor(ah / ap),
          ar,
          lr,
          ap,
          lp,
          kerf,
          cant,
        },
      });

      setError(null);
    } catch (e) {
      setError(e.message);
      setResult(null);
    }
  };
  useEffect(() => {
    if (selectedDesign && DESIGNS.length > 0) {
      calc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDesign]);


  const PreviewSVG = ({ layout }) => {
    if (!layout) return null;

    const { ar, lr, ap, lp, kerf, orientation, A_cols, A_rows, B_cols, B_rows } = layout;

    const viewW = 540;
    const viewH = 360;
    const scale = Math.min(viewW / ar, viewH / lr);

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

          {pieces.map((p, i) => (
            <rect
              key={i}
              x={margin + p.x * scale}
              y={margin + p.y * scale}
              width={p.w * scale}
              height={p.h * scale}
              fill="#e0f2fe"
              stroke="#0284c7"
              strokeWidth={0.8}
              rx={2}
            />
          ))}
        </svg>
      </div>
    );
  };
  /* =========================
     UI — SIN CAMBIOS
     ========================= */
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex items-start justify-center p-6">

      <div className="w-full max-w-6xl bg-white text-slate-900 rounded-2xl shadow-lg p-6 md:p-8">

        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Calculadora MDF láser — Vista previa
        </h1>

        <div className="mb-6">
          <label className="text-xs font-medium text-slate-600">
            DISEÑO BASE
          </label>
          <select
            value={selectedDesign}
            onChange={handleDesignChange}
            className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm w-full md:w-1/2 mt-1"
          >

            {DESIGNS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {Object.entries(form).map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">
                {key.replace(/([A-Z])/g, " $1").toUpperCase()}
              </label>
              <input
                name={key}
                value={val}
                onChange={handleChange}
                type="number"
                className="border border-slate-300 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm"
              />

            </div>
          ))}
        </div>

        <button
          onClick={calc}
          className="px-6 py-2.5 text-sm font-semibold rounded-full bg-blue-600 text-white shadow hover:bg-blue-700"
        >
          Calcular
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-8 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border">
                <h2 className="font-semibold mb-2">Datos generales</h2>
                <ul className="text-sm space-y-1">
                  <li>Diseño: <strong>{result.designName}</strong></li>
                  <li>Piezas por plancha: <strong>{result.ppr}</strong></li>
                  <li>Tiempo por pieza: <strong>{result.tiempoCalculadoMin.toFixed(2)} min</strong></li>
                  <li>Tiempo total máquina: <strong>{result.totalMachineTime.toFixed(2)} min</strong></li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border">
                <h2 className="font-semibold mb-2">Costos</h2>
                <ul className="text-sm space-y-1">
                  <li>Costo material: <strong>{result.materialCost.toFixed(0)} CLP</strong></li>
                  <li>Costo máquina: <strong>{result.machineCost.toFixed(0)} CLP</strong></li>
                  <li>Costo total: <strong>{result.totalCost.toFixed(0)} CLP</strong></li>
                  <li>Venta total: <strong>{result.totalPrice.toFixed(0)} CLP</strong></li>
                  <li className="pt-2 border-t">
                    Utilidad (Δ):{" "}
                    <strong className={result.delta >= 0 ? "text-emerald-700" : "text-red-600"}>
                      {result.delta.toFixed(0)} CLP
                    </strong>
                  </li>
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
