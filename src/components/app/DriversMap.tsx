import { formatDateTime } from "@/lib/format";
import { useEffect, useRef } from "react";

declare global { interface Window { L?: any } }
type DriverPoint = { employee_id: string; name: string; status: "active" | "available" | "offline"; latitude: number; longitude: number; accuracy: number | null; updated_at: string; taskLabel?: string | null };
let leafletPromise: Promise<any> | null = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-tapwash-leaflet-css="1"]')) {
      const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; link.dataset.tapwashLeafletCss = "1"; document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-tapwash-leaflet="1"]');
    if (existing) { existing.addEventListener("load", () => resolve(window.L)); existing.addEventListener("error", () => reject(new Error("Map unavailable"))); return; }
    const script = document.createElement("script"); script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.async = true; script.dataset.tapwashLeaflet = "1"; script.onload = () => resolve(window.L); script.onerror = () => reject(new Error("Map unavailable")); document.head.appendChild(script);
  });
  return leafletPromise;
}
export function DriversMap({ drivers, onSelect }: { drivers: DriverPoint[]; onSelect?: (id: string) => void }) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const markers = useRef<Map<string, any>>(new Map());
  const circles = useRef<Map<string, any>>(new Map());
  const animations = useRef<Map<string, number>>(new Map());
  const latest = useRef(drivers); latest.current = drivers;
  useEffect(() => {
    let cancelled = false;
    void loadLeaflet().then(L => {
      if (cancelled || !container.current) return;
      if (!map.current) {
        map.current = L.map(container.current, { zoomControl: true, scrollWheelZoom: true }).setView([30.0444, 31.2357], 6);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map.current);
      }
      render(L, latest.current);
    }).catch(() => undefined);
    return () => { cancelled = true; if (map.current) { map.current.remove(); map.current = null; markers.current.clear(); circles.current.clear(); for (const frame of animations.current.values()) cancelAnimationFrame(frame); animations.current.clear(); } };
  }, []);
  useEffect(() => { if (window.L && map.current) render(window.L, drivers); }, [drivers]);
  function render(L: any, rows: DriverPoint[]) {
    const mapInstance = map.current;
    if (!mapInstance) return;
    const visibleIds = new Set(rows.filter(row => Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && (row.latitude !== 0 || row.longitude !== 0) && row.accuracy != null && row.accuracy <= 100).map(row => row.employee_id));
    for (const [id, marker] of markers.current) if (!visibleIds.has(id)) { marker.remove(); markers.current.delete(id); circles.current.get(id)?.remove(); circles.current.delete(id); }
    const points: [number, number][] = [];
    for (const row of rows) {
      if (row.accuracy == null || row.accuracy > 100 || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude) || (row.latitude === 0 && row.longitude === 0)) continue;
      const point: [number, number] = [row.latitude, row.longitude]; points.push(point);
      const color = row.status === "active" ? "#f59e0b" : row.status === "available" ? "#10b981" : "#64748b";
      const label = row.status === "active" ? "أوردر نشط" : row.status === "available" ? "متاح" : "غير متصل";
      const html = `<div style="display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:14px;background:white;border:2px solid ${color};box-shadow:0 4px 16px #0002;color:#172033;font-size:12px;font-weight:700;white-space:nowrap"><span style="width:9px;height:9px;border-radius:50%;background:${color}"></span>${row.name.replace(/[<>&"]/g, "")}</div>`;
      let marker = markers.current.get(row.employee_id);
      if (!marker) {
        marker = L.marker(point, { icon: L.divIcon({ className: "tapwash-driver-label", html, iconSize: null, iconAnchor: [10, 18] }) }).addTo(mapInstance);
        markers.current.set(row.employee_id, marker);
        marker.on("click", () => onSelect?.(row.employee_id));
      } else {
        const oldFrame = animations.current.get(row.employee_id);
        if (oldFrame != null) cancelAnimationFrame(oldFrame);
        const startPoint = marker.getLatLng();
        const startedAt = performance.now();
        const animate = (now: number) => {
          const progress = Math.min(1, (now - startedAt) / 900);
          const eased = progress * (2 - progress);
          marker.setLatLng([
            startPoint.lat + (point[0] - startPoint.lat) * eased,
            startPoint.lng + (point[1] - startPoint.lng) * eased,
          ]);
          if (progress < 1) animations.current.set(row.employee_id, requestAnimationFrame(animate));
          else animations.current.delete(row.employee_id);
        };
        animations.current.set(row.employee_id, requestAnimationFrame(animate));
        marker.setIcon(L.divIcon({ className: "tapwash-driver-label", html, iconSize: null, iconAnchor: [10, 18] }));
      }
      marker.bindPopup(`<b>${row.name}</b><br/>${label}<br/>دقة الموقع: ${Math.round(row.accuracy)} متر<br/>آخر ظهور: ${formatDateTime(row.updated_at)}`);
      let circle = circles.current.get(row.employee_id);
      if (!circle) { circle = L.circle(point, { radius: row.accuracy, color, weight: 1, fillOpacity: 0.08 }).addTo(mapInstance); circles.current.set(row.employee_id, circle); }
      else circle.setLatLng(point).setRadius(row.accuracy);
    }
    if (points.length && !mapInstance.__tapwashFitted) { mapInstance.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 14 }); mapInstance.__tapwashFitted = true; }
    if (!points.length) mapInstance.setView([30.0444, 31.2357], 6);
    setTimeout(() => mapInstance.invalidateSize(), 40);
  }
  return <div className="relative isolate z-0 overflow-hidden rounded-3xl border bg-muted/20 shadow-inner"><div ref={container} className="h-[480px] w-full" aria-label="خريطة تتبع الموظفين" /></div>;
}
