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

// -------------------------------------------------------------
// GEOFENCING & GPS RADIUS VERIFICATION (3 KM ZONE)
// -------------------------------------------------------------

export interface WorkplaceZone {
  name: string;
  address: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export const DEFAULT_WORKPLACE_ZONE: WorkplaceZone = {
  name: "Cantiere Sede - Milano",
  address: "Via Dante 12, Milano / Ospedale Sacco",
  lat: 45.4642,
  lng: 9.1900,
  radiusKm: 3.0,
};

/**
 * Calculates distance between two GPS coordinates in Kilometers using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
  
  const R = 6371; // Earth radius in KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Parses default location string which may contain encoded GPS and Radius
 * Format: "Location Name | 45.4642, 9.1900 | 3.0"
 */
export function parseWorkplaceZone(storedLocation: string): WorkplaceZone {
  if (!storedLocation || !storedLocation.trim()) {
    return DEFAULT_WORKPLACE_ZONE;
  }

  if (storedLocation.includes("|")) {
    const parts = storedLocation.split("|").map((p) => p.trim());
    const name = parts[0] || "Cantiere Milano";
    
    let lat = DEFAULT_WORKPLACE_ZONE.lat;
    let lng = DEFAULT_WORKPLACE_ZONE.lng;
    let radiusKm = DEFAULT_WORKPLACE_ZONE.radiusKm;

    if (parts[1] && parts[1].includes(",")) {
      const coords = parts[1].split(",");
      const parsedLat = parseFloat(coords[0]);
      const parsedLng = parseFloat(coords[1]);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }

    if (parts[2]) {
      const parsedRadius = parseFloat(parts[2]);
      if (!isNaN(parsedRadius) && parsedRadius > 0) {
        radiusKm = parsedRadius;
      }
    }

    return {
      name,
      address: name,
      lat,
      lng,
      radiusKm,
    };
  }

  return {
    name: storedLocation,
    address: storedLocation,
    lat: DEFAULT_WORKPLACE_ZONE.lat,
    lng: DEFAULT_WORKPLACE_ZONE.lng,
    radiusKm: 3.0,
  };
}

/**
 * Formats workplace zone into unified storage string
 */
export function formatWorkplaceZone(
  name: string,
  lat: number | string,
  lng: number | string,
  radiusKm: number | string = 3.0
): string {
  const cleanName = (name || "Cantiere").replace(/\|/g, "-").trim();
  const cleanLat = typeof lat === "number" ? lat : parseFloat(String(lat)) || DEFAULT_WORKPLACE_ZONE.lat;
  const cleanLng = typeof lng === "number" ? lng : parseFloat(String(lng)) || DEFAULT_WORKPLACE_ZONE.lng;
  const cleanRadius = typeof radiusKm === "number" ? radiusKm : parseFloat(String(radiusKm)) || 3.0;

  return `${cleanName} | ${cleanLat},${cleanLng} | ${cleanRadius}`;
}

/**
 * Checks if a worker's coordinates are inside the workplace zone
 */
export function verifyWorkerGeofence(
  workerLat: number | string,
  workerLng: number | string,
  zone: WorkplaceZone
): { allowed: boolean; distanceKm: number; message: string } {
  const wLat = typeof workerLat === "number" ? workerLat : parseFloat(String(workerLat));
  const wLng = typeof workerLng === "number" ? workerLng : parseFloat(String(workerLng));

  if (isNaN(wLat) || isNaN(wLng)) {
    return {
      allowed: false,
      distanceKm: 0,
      message: "Posizione GPS del lavoratore non valida o non rilevata.",
    };
  }

  const distanceKm = calculateDistanceKm(wLat, wLng, zone.lat, zone.lng);
  const allowed = distanceKm <= zone.radiusKm;

  return {
    allowed,
    distanceKm,
    message: allowed
      ? `Posizione valida (Distanza: ${distanceKm} km entro il raggio di ${zone.radiusKm} km)`
      : `Fuori zona di lavoro autorizzata (Distanza: ${distanceKm} km > Limite: ${zone.radiusKm} km)`,
  };
}
