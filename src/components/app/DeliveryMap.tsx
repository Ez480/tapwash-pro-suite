import { useEffect, useRef } from "react";

declare global {
  interface Window {
    L?: any;
  }
}

type DeliveryMapProps = {
  destination?: { lat: number; lng: number } | null;
  driver?: { lat: number; lng: number; updatedAt?: string | null } | null;
  height?: string;
};

let leafletPromise: Promise<any> | null = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-tapwash-leaflet="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      existing.addEventListener("error", () => reject(new Error("Could not load map library")));
      return;
    }

    if (!document.querySelector('link[data-tapwash-leaflet-css="1"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.tapwashLeafletCss = "1";
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.tapwashLeaflet = "1";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Could not load map library"));
    document.head.appendChild(script);
  });

  return leafletPromise;
}

export function DeliveryMap({ destination, driver, height = "360px" }: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    void loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return;
        if (!mapRef.current) {
          mapRef.current = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(mapRef.current);
        }
        updateMap(L);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        destinationMarkerRef.current = null;
        driverMarkerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!window.L || !mapRef.current) return;
    updateMap(window.L);
  }, [destination?.lat, destination?.lng, driver?.lat, driver?.lng]);

  function updateMap(L: any) {
    const map = mapRef.current;
    if (!map) return;

    const points: [number, number][] = [];

    if (destination) {
      points.push([destination.lat, destination.lng]);
      if (!destinationMarkerRef.current) {
        const icon = L.divIcon({
          className: "tapwash-map-icon",
          html: '<div style="width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.96);border:3px solid #2563eb;box-shadow:0 8px 24px rgba(37,99,235,.28);display:flex;align-items:center;justify-content:center;font-size:20px">📍</div>',
          iconSize: [42, 42],
          iconAnchor: [21, 42],
          popupAnchor: [0, -38],
        });
        destinationMarkerRef.current = L.marker([destination.lat, destination.lng], { icon }).addTo(map);
      }
      destinationMarkerRef.current.setLatLng([destination.lat, destination.lng]);
      destinationMarkerRef.current.bindPopup("موقع العميل / مكان تنفيذ الأوردر");
    }

    if (driver) {
      points.push([driver.lat, driver.lng]);
      if (!driverMarkerRef.current) {
        const icon = L.divIcon({
          className: "tapwash-driver-icon",
          html: '<div style="position:relative;width:50px;height:50px"><div style="position:absolute;inset:0;border-radius:50%;background:rgba(16,185,129,.18);animation:tapwashPulse 1.8s ease-out infinite"></div><div style="position:absolute;left:7px;top:7px;width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);border:3px solid white;box-shadow:0 8px 22px rgba(5,150,105,.35);display:flex;align-items:center;justify-content:center;color:white;font-size:18px">🚗</div></div><style>@keyframes tapwashPulse{0%{transform:scale(.65);opacity:.9}70%{transform:scale(1.25);opacity:0}100%{transform:scale(1.25);opacity:0}}</style>',
          iconSize: [50, 50],
          iconAnchor: [25, 25],
          popupAnchor: [0, -25],
        });
        driverMarkerRef.current = L.marker([driver.lat, driver.lng], { icon, zIndexOffset: 1000 }).addTo(map);
      }
      driverMarkerRef.current.setLatLng([driver.lat, driver.lng]);
      driverMarkerRef.current.bindPopup(driver.updatedAt ? `الدليفري • آخر تحديث ${new Date(driver.updatedAt).toLocaleTimeString()}` : "الدليفري الآن");
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }

    if (points.length === 1) map.setView(points[0], 15);
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [45, 45], maxZoom: 16 });
    setTimeout(() => map.invalidateSize(), 50);
  }

  return <div className="overflow-hidden rounded-3xl border border-white/20 bg-slate-100 shadow-inner dark:bg-slate-900" style={{ height }}>
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" aria-label="خريطة تتبع الدليفري" />
      <div className="pointer-events-none absolute bottom-3 start-3 z-[500] flex items-center gap-2 rounded-2xl border border-white/40 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100">
        <span className="inline-block size-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.15)]" /> الدليفري
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />
        <span className="text-blue-600">📍</span> العميل
      </div>
    </div>
  </div>;
}
