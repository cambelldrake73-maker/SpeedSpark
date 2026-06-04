import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface ResolvedLocation {
  label: string;
  latitude: number;
  longitude: number;
}

export type LocationRequestResult =
  | { ok: true; location: ResolvedLocation }
  | { ok: false; error: string };

function formatNativeAddress(address: Location.LocationGeocodedAddress): string {
  const city =
    address.city ?? address.subregion ?? address.district ?? address.name ?? undefined;
  const region = address.region ?? address.isoCountryCode ?? undefined;

  if (city && region) return `${city}, ${region}`;
  if (city) return city;
  if (region) return region;
  return 'Your area';
}

async function reverseGeocodeNative(latitude: number, longitude: number): Promise<string | null> {
  const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
  if (!address) return null;
  return formatNativeAddress(address);
}

/** expo-location reverse geocode is unavailable on web — use a CORS-friendly client API */
async function reverseGeocodeWeb(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url =
      'https://api.bigdatacloud.net/data/reverse-geocode-client' +
      `?latitude=${encodeURIComponent(String(latitude))}` +
      `&longitude=${encodeURIComponent(String(longitude))}` +
      '&localityLanguage=en';

    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
    };

    const city = data.city ?? data.locality;
    const region = data.principalSubdivision ?? data.countryName;

    if (city && region) return `${city}, ${region}`;
    if (city) return city;
    if (region) return region;
    return null;
  } catch {
    return null;
  }
}

export async function requestDeviceLocation(): Promise<LocationRequestResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        ok: false,
        error:
          Platform.OS === 'web'
            ? 'Location was blocked. Allow it in your browser address bar, then tap again.'
            : 'Location access is required. Enable it in Settings, then try again.',
      };
    }

    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Platform.OS === 'web' ? Location.Accuracy.Low : Location.Accuracy.Balanced,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 15000);
      }),
    ]);

    const { latitude, longitude } = position.coords;

    const label =
      Platform.OS === 'web'
        ? await reverseGeocodeWeb(latitude, longitude)
        : await reverseGeocodeNative(latitude, longitude);

    return {
      ok: true,
      location: {
        label: label ?? 'Your area',
        latitude,
        longitude,
      },
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.message === 'timeout';
    return {
      ok: false,
      error: timedOut
        ? 'Location took too long. Check that location is enabled, then try again.'
        : Platform.OS === 'web'
          ? 'Could not read your location. Allow location when your browser asks, then try again.'
          : 'Could not read your location. Check that location services are on and try again.',
    };
  }
}
