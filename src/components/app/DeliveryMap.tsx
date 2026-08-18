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
      if (!destinationMarkerRef.current) destinationMarkerRef.current = L.marker([destination.lat, destination.lng]).addTo(map);
      destinationMarkerRef.current.setLatLng([destination.lat, destination.lng]);
      destinationMarkerRef.current.bindPopup("موقع العميل / مكان تنفيذ الأوردر");
    }

    if (driver) {
      points.push([driver.lat, driver.lng]);
      if (!driverMarkerRef.current) driverMarkerRef.current = L.marker([driver.lat, driver.lng]).addTo(map);
      driverMarkerRef.current.setLatLng([driver.lat, driver.lng]);
      driverMarkerRef.current.bindPopup(driver.updatedAt ? `الدليفري • آخر تحديث ${new Date(driver.updatedAt).toLocaleTimeString()}` : "الدليفري الآن");
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }

    if (points.length === 1) map.setView(points[0], 15);
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 16 });
    setTimeout(() => map.invalidateSize(), 50);
  }

  return <div ref={containerRef} style={{ height }} className="w-full overflow-hidden rounded-2xl border bg-muted" aria-label="خريطة تتبع الدليفري" />;
}
