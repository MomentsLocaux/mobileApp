import type { AddressDetails } from '../types/event-form';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  address: AddressDetails;
}

export class GeocodingService {
  static async reverseGeocode(lat: number, lon: number): Promise<AddressDetails | null> {
    try {
      const response = await fetch(
        `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'EventApp/1.0',
          },
        }
      );

      if (!response.ok) {
        console.error('Reverse geocoding failed:', response.status);
        return null;
      }

      const data = await response.json();

      if (!data.address) {
        return null;
      }

      return {
        streetNumber: data.address.house_number || '',
        streetName: data.address.road || data.address.street || '',
        city: data.address.city || data.address.town || data.address.village || '',
        postalCode: data.address.postcode || '',
      };
    } catch (error) {
      console.error('Error in reverse geocoding:', error);
      return null;
    }
  }

  static async geocodeAddress(address: AddressDetails): Promise<GeocodingResult | null> {
    try {
      const addressString = [
        address.streetNumber,
        address.streetName,
        address.postalCode,
        address.city,
      ]
        .filter(Boolean)
        .join(' ');

      if (!addressString.trim()) {
        return null;
      }

      const response = await fetch(
        `${NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(addressString)}&addressdetails=1&limit=1`,
        {
          headers: {
            'User-Agent': 'EventApp/1.0',
          },
        }
      );

      if (!response.ok) {
        console.error('Geocoding failed:', response.status);
        return null;
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        return null;
      }

      const result = data[0];

      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        address: {
          streetNumber: result.address?.house_number || address.streetNumber,
          streetName: result.address?.road || result.address?.street || address.streetName,
          city: result.address?.city || result.address?.town || result.address?.village || address.city,
          postalCode: result.address?.postcode || address.postalCode,
        },
      };
    } catch (error) {
      console.error('Error in geocoding:', error);
      return null;
    }
  }

  static formatAddress(address: AddressDetails): string {
    return [
      address.streetNumber,
      address.streetName,
      address.postalCode,
      address.city,
    ]
      .filter(Boolean)
      .join(' ');
  }
}
