/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeolocationData } from '../types';

/**
 * GOOGLE MAPS API DIRECTIVE & GEOLOCATION PROTOCOL:
 * - Never expose raw keys in source code.
 * - Retrieve via runtime environment variable import.meta.env.VITE_GOOGLE_MAPS_API_KEY.
 * - Ensure coordinates and addresses are treated as sensitive user data and encrypted alongside journal ciphertext.
 */
export function getGoogleMapsApiKey(): string {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY) {
      return (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && (process as any).env?.VITE_GOOGLE_MAPS_API_KEY) {
      return (process as any).env.VITE_GOOGLE_MAPS_API_KEY;
    }
  } catch {}
  return '';
}

/**
 * Request device geolocation via browser navigator.
 * Gracefully handles permission denials or timeouts.
 */
export async function getCurrentDeviceLocation(): Promise<GeolocationData | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: GeolocationData = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
          formattedAddress: `Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`,
        };

        // Try reverse geocoding if Google Maps API key is configured
        const apiKey = getGoogleMapsApiKey();
        if (apiKey) {
          try {
            const res = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${apiKey}`
            );
            const data = await res.json();
            if (data.results && data.results[0]) {
              coords.formattedAddress = data.results[0].formatted_address;
            }
          } catch {
            // Keep default coordinate string on network or key restriction
          }
        }

        resolve(coords);
      },
      (err) => {
        console.warn('Geolocation access declined or unavailable:', err.message);
        resolve(null);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}
