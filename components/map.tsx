'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
});

interface MapProps {
  center: [number, number];
  vehicleId: string;
  vehicleName: string;
}

export default function Map({ center, vehicleId, vehicleName }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    map.current = L.map(mapContainer.current).setView(center, 13);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Add marker for vehicle
    markerRef.current = L.marker(center, {
      title: vehicleName,
      icon: L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png',
        iconSize: [25, 41],
        shadowSize: [41, 41],
        iconAnchor: [12, 41],
        shadowAnchor: [12, 41],
      }),
    }).addTo(map.current);

    // Add popup
    markerRef.current.bindPopup(`<strong>${vehicleName}</strong><br>Current Location`);

    // Add accuracy circle
    circleRef.current = L.circle(center, {
      color: 'blue',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      radius: 500,
    }).addTo(map.current);

    // Simulate GPS updates every 5 seconds
    const gpsInterval = setInterval(() => {
      // Simulate slight movement within the accuracy radius
      const lat = center[0] + (Math.random() - 0.5) * 0.01;
      const lng = center[1] + (Math.random() - 0.5) * 0.01;

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }

      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lng]);
      }
    }, 5000);

    return () => {
      clearInterval(gpsInterval);
      if (map.current) {
        map.current.remove();
      }
    };
  }, [center, vehicleName]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
