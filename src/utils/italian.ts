export const MONTHS_IT = [
  { value: "01", name: "Gennaio" },
  { value: "02", name: "Febbraio" },
  { value: "03", name: "Marzo" },
  { value: "04", name: "Aprile" },
  { value: "05", name: "Maggio" },
  { value: "06", name: "Giugno" },
  { value: "07", name: "Luglio" },
  { value: "08", name: "Agosto" },
  { value: "09", name: "Settembre" },
  { value: "10", name: "Ottobre" },
  { value: "11", name: "Novembre" },
  { value: "12", name: "Dicembre" },
];

export const WORK_TYPES_IT = [
  { id: "Ordinario", label: "Ordinario", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "Straordinario", label: "Straordinario", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "Smart Working", label: "Smart Working", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "Trasferta", label: "Trasferta", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "Ferie", label: "Ferie", color: "bg-teal-100 text-teal-800 border-teal-200" },
  { id: "Permesso", label: "Permesso ROL", color: "bg-rose-100 text-rose-800 border-rose-200" },
];

export const PRESET_LOCATIONS_IT = [
  "Ufficio Sede",
  "Smart Working da Casa",
  "Presso Cliente / Cantiere",
  "In Trasferta Italia",
  "In Trasferta Estero",
];

export function getDayNameIT(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = d.getDay();
    const days = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
    return days[day];
  } catch {
    return "";
  }
}

export function formatDateIT(dateStr: string): string {
  try {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    const monthObj = MONTHS_IT.find((m) => m.value === month);
    const dayName = getDayNameIT(dateStr);
    return `${dayName} ${parseInt(day, 10)} ${monthObj ? monthObj.name : month} ${year}`;
  } catch {
    return dateStr;
  }
}

export function getCurrentDateISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeHHMM(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "OraLavoroApp/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const road = data.address.road || data.address.pedestrian || data.address.suburb || "";
        const houseNumber = data.address.house_number || "";
        const city = data.address.city || data.address.town || data.address.village || "";
        const state = data.address.province || data.address.state || "";

        const parts = [
          road ? `${road} ${houseNumber}`.trim() : "",
          city,
          state,
        ].filter(Boolean);

        return parts.join(", ") || data.display_name || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
      }
    }
  } catch (e) {
    console.warn("Reverse geocode failed", e);
  }
  return `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
}
