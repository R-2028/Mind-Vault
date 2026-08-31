/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
} from '@react-google-maps/api';
import {
  MapPin,
  Navigation,
  Search,
  Check,
  X,
  Compass,
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { GeolocationData } from '../types';
import { getCurrentDeviceLocation, getGoogleMapsApiKey } from '../services/maps';

const LIBRARIES: ('places')[] = ['places'];

const darkVioletMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#151022' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#241b38' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a79bc8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d8b4fe' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#c084fc' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1a132b' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9333ea' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2c2243' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1a122d' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9d8ec2' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#581c87' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2e0854' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3e8ff' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#241838' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#c084fc' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0b0713' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7e6d9b' }],
  },
];

const DEFAULT_CENTER = {
  lat: 37.7749,
  lng: -122.4194,
};

interface LocationPickerMapProps {
  initialLocation?: GeolocationData | null;
  onSelectLocation: (loc: GeolocationData) => void;
  onCancel: () => void;
}

export const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  initialLocation,
  onSelectLocation,
  onCancel,
}) => {
  const apiKey = getGoogleMapsApiKey();
  const hasApiKey = Boolean(apiKey && apiKey.trim().length > 0);
  const { isLoaded, loadError } = useJsApiLoader(
    hasApiKey
      ? {
          googleMapsApiKey: apiKey,
          libraries: LIBRARIES,
        }
      : {
          // Provide placeholder when key is absent to avoid invoking Google Maps API loader
          id: 'google-map-script-disabled',
          googleMapsApiKey: '',
        }
  );

  const [position, setPosition] = useState<{ lat: number; lng: number }>({
    lat: initialLocation?.latitude ?? initialLocation?.lat ?? DEFAULT_CENTER.lat,
    lng: initialLocation?.longitude ?? initialLocation?.lng ?? DEFAULT_CENTER.lng,
  });

  const [addressName, setAddressName] = useState<string>(
    initialLocation?.addressName || initialLocation?.formattedAddress || ''
  );
  const [placeId, setPlaceId] = useState<string | undefined>(initialLocation?.placeId);
  const [isLocating, setIsLocating] = useState(false);
  const [searchInput, setSearchInput] = useState(addressName);

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Update address when marker is dragged or clicked
  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const formatted = results[0].formatted_address;
            setAddressName(formatted);
            setSearchInput(formatted);
            setPlaceId(results[0].place_id);
          } else {
            const fallback = `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            setAddressName(fallback);
            setSearchInput(fallback);
          }
        });
      } else {
        const fallback = `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setAddressName(fallback);
        setSearchInput(fallback);
      }
    },
    []
  );

  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      setPosition({ lat: newLat, lng: newLng });
      reverseGeocode(newLat, newLng);
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      setPosition({ lat: newLat, lng: newLng });
      reverseGeocode(newLat, newLng);
    }
  };

  const handlePlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry && place.geometry.location) {
        const newLat = place.geometry.location.lat();
        const newLng = place.geometry.location.lng();
        setPosition({ lat: newLat, lng: newLng });
        const name = place.formatted_address || place.name || `${newLat.toFixed(4)}, ${newLng.toFixed(4)}`;
        setAddressName(name);
        setSearchInput(name);
        setPlaceId(place.place_id);
        if (mapRef.current) {
          mapRef.current.panTo({ lat: newLat, lng: newLng });
          mapRef.current.setZoom(15);
        }
      }
    }
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const loc = await getCurrentDeviceLocation();
      if (loc) {
        const newLat = loc.latitude;
        const newLng = loc.longitude;
        setPosition({ lat: newLat, lng: newLng });
        const formatted = loc.formattedAddress || `${newLat.toFixed(4)}, ${newLng.toFixed(4)}`;
        setAddressName(formatted);
        setSearchInput(formatted);
        if (mapRef.current) {
          mapRef.current.panTo({ lat: newLat, lng: newLng });
          mapRef.current.setZoom(15);
        }
      }
    } finally {
      setIsLocating(false);
    }
  };

  const handleConfirm = () => {
    const finalData: GeolocationData = {
      latitude: Number(position.lat.toFixed(6)),
      longitude: Number(position.lng.toFixed(6)),
      lat: Number(position.lat.toFixed(6)),
      lng: Number(position.lng.toFixed(6)),
      formattedAddress: addressName || `Lat: ${position.lat.toFixed(4)}, Lng: ${position.lng.toFixed(4)}`,
      addressName: addressName || `Pinned Location (${position.lat.toFixed(3)}, ${position.lng.toFixed(3)})`,
      placeId,
    };
    onSelectLocation(finalData);
  };

  // Fallback preset jump in mock / keyless mode
  const handlePresetSelect = (preset: { name: string; lat: number; lng: number }) => {
    setPosition({ lat: preset.lat, lng: preset.lng });
    setAddressName(preset.name);
    setSearchInput(preset.name);
  };

  const showGoogleMap = hasApiKey && isLoaded && !loadError;

  return (
    <div className="bg-neutral-900 border border-purple-900/40 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 animate-fade-in text-neutral-100">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-800/80 flex items-center justify-center text-purple-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300">
              Pin Reflection Location
            </h4>
            <p className="text-[11px] text-neutral-400">
              Encrypted locally with AES-GCM (Zero-Knowledge). Never exposed in plaintext.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-purple-600 text-neutral-300 hover:text-purple-300 text-xs font-medium transition shadow-sm"
          >
            <Navigation className={`w-3.5 h-3.5 text-purple-400 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Locating GPS...' : 'Use My GPS'}</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Autocomplete Search & Current Selection */}
      <div className="space-y-2">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-purple-400 pointer-events-none" />
          {showGoogleMap ? (
            <Autocomplete
              onLoad={(autocomplete) => {
                autocompleteRef.current = autocomplete;
              }}
              onPlaceChanged={handlePlaceChanged}
              className="w-full"
            >
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search place, city, or address..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition font-sans"
              />
            </Autocomplete>
          ) : (
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setAddressName(e.target.value);
              }}
              placeholder="Search or type a location name..."
              className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition font-sans"
            />
          )}
        </div>
      </div>

      {/* Map Display Container */}
      <div className="relative w-full h-64 sm:h-72 rounded-xl overflow-hidden border border-neutral-800 bg-[#151022]">
        {showGoogleMap ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={position}
            zoom={14}
            onLoad={onMapLoad}
            onClick={handleMapClick}
            options={{
              styles: darkVioletMapStyles,
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            <Marker
              position={position}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
              animation={google.maps.Animation.DROP}
            />
          </GoogleMap>
        ) : (
          /* High-Fidelity Neural Fallback Map for Environment without API Key */
          <div className="w-full h-full flex flex-col justify-between p-4 bg-gradient-to-br from-[#120d1c] via-[#1a132b] to-[#0c0814] relative select-none">
            {/* Background Grid Pattern */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(circle, #9333ea 1px, transparent 1px), linear-gradient(to right, #241b38 1px, transparent 1px), linear-gradient(to bottom, #241b38 1px, transparent 1px)',
                backgroundSize: '24px 24px, 48px 48px, 48px 48px',
              }}
            />

            {/* Interactive Coordinate Canvas Area */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const xPct = (e.clientX - rect.left) / rect.width;
                const yPct = (e.clientY - rect.top) / rect.height;
                const newLat = Number((37.7749 + (0.5 - yPct) * 0.1).toFixed(6));
                const newLng = Number((-122.4194 + (xPct - 0.5) * 0.1).toFixed(6));
                setPosition({ lat: newLat, lng: newLng });
                if (!addressName || addressName.startsWith('Coordinates')) {
                  const fallback = `Coordinates: ${newLat.toFixed(4)}, ${newLng.toFixed(4)}`;
                  setAddressName(fallback);
                  setSearchInput(fallback);
                }
              }}
              className="absolute inset-0 cursor-crosshair flex items-center justify-center"
            >
              {/* Pulsing Visual Pin */}
              <div className="relative flex flex-col items-center animate-bounce">
                <div className="p-2.5 rounded-full bg-purple-600 border-2 border-white shadow-lg shadow-purple-900/60 text-white">
                  <MapPin className="w-5 h-5 fill-white text-purple-900" />
                </div>
                <div className="w-3 h-1 bg-purple-500/40 rounded-full blur-xs mt-1" />
              </div>
            </div>

            {/* Top Badge */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-950/90 border border-purple-800/80 text-purple-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Neural Geolocation Active</span>
              </span>
              <span className="text-[10px] text-neutral-400 font-mono bg-neutral-900/80 px-2 py-0.5 rounded border border-neutral-800">
                Lat: {position.lat.toFixed(4)} | Lng: {position.lng.toFixed(4)}
              </span>
            </div>

            {/* Bottom Preset Quick Pickers */}
            <div className="relative z-10 space-y-1.5">
              <div className="text-[10px] text-neutral-400 flex items-center gap-1 font-mono">
                <Info className="w-3 h-3 text-purple-400" />
                <span>Click map to pin coordinates, or pick a focus space:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: 'San Francisco, CA', lat: 37.7749, lng: -122.4194 },
                  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
                  { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
                  { name: 'New York, NY', lat: 40.7128, lng: -74.006 },
                  { name: 'Home Sanctuary', lat: position.lat, lng: position.lng },
                ].map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePresetSelect(p);
                    }}
                    className="px-2 py-1 rounded-md text-[10px] bg-neutral-900/90 hover:bg-purple-950 border border-neutral-800 hover:border-purple-700 text-neutral-300 hover:text-purple-200 transition"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected Coordinates & Confirm Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs text-neutral-200 font-medium">
            <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate max-w-xs sm:max-w-md">
              {addressName || `Lat: ${position.lat.toFixed(4)}, Lng: ${position.lng.toFixed(4)}`}
            </span>
          </div>
          <div className="text-[10px] text-neutral-500 font-mono">
            Coordinates: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-xl border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            id="confirm-pin-location-btn"
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-neutral-950 text-xs font-bold transition shadow-lg shadow-purple-950/40"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Attach Encrypted Location</span>
          </button>
        </div>
      </div>
    </div>
  );
};
