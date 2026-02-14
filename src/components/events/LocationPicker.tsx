import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Lock, Unlock, Navigation } from 'lucide-react-native';
import { Input } from '../ui';
import { GeocodingService } from '../../services/geocoding.service';
import type { AddressDetails, LocationState } from '../../types/event-form';
import { colors, spacing, typography, borderRadius } from '@/components/ui/v2/theme';
import Constants from 'expo-constants';

Mapbox.setAccessToken(Constants.expoConfig?.extra?.mapboxToken || process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
Mapbox.setTelemetryEnabled(false);

interface LocationPickerProps {
  location: LocationState;
  address: AddressDetails;
  onLocationChange: (lat: number, lon: number) => void;
  onAddressChange: (address: AddressDetails) => void;
  onLockChange: (locked: boolean) => void;
  onSaveLocation: (lat: number, lon: number) => void;
}

const PARIS_COORDS = { latitude: 48.8566, longitude: 2.3522 };

export function LocationPicker({
  location,
  address,
  onLocationChange,
  onAddressChange,
  onLockChange,
  onSaveLocation,
}: LocationPickerProps) {
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateCoordinates = (lat: number, lon: number): boolean => {
    return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  };

  const getSafeCoordinates = () => {
    if (validateCoordinates(location.latitude, location.longitude)) {
      return { latitude: location.latitude, longitude: location.longitude };
    }
    return PARIS_COORDS;
  };

  const handleValidateLocation = async () => {
    setGeocodeLoading(true);
    setError(null);

    const coords = getSafeCoordinates();
    const result = await GeocodingService.reverseGeocode(coords.latitude, coords.longitude);

    if (result) {
      onAddressChange(result);
      onSaveLocation(coords.latitude, coords.longitude);
      onLockChange(true);
    } else {
      setError('Impossible de géocoder cette position');
    }

    setGeocodeLoading(false);
  };

  const handleGeocodeAddress = async () => {
    setGeocodeLoading(true);
    setError(null);

    const result = await GeocodingService.geocodeAddress(address);

    if (result) {
      onLocationChange(result.latitude, result.longitude);
      onAddressChange(result.address);
    } else {
      setError('Adresse introuvable');
    }

    setGeocodeLoading(false);
  };

  const handleUnlockLocation = () => {
    if (location.savedLocation) {
      onLocationChange(location.savedLocation.latitude, location.savedLocation.longitude);
    }
    onLockChange(false);
    setError(null);
  };

  const handleMapPress = (feature: any) => {
    if (location.isLocked) return;

    const coords = feature.geometry.coordinates;
    if (coords) {
      onLocationChange(coords[1], coords[0]);
    }
  };

  const safeCoords = getSafeCoordinates();

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <Mapbox.MapView
          style={styles.map}
          styleURL={Mapbox.StyleURL.Street}
          onPress={handleMapPress}
          scrollEnabled={!location.isLocked}
          zoomEnabled={!location.isLocked}
          pitchEnabled={false}
          rotateEnabled={false}
        >
          <Mapbox.Camera
            zoomLevel={14}
            centerCoordinate={[safeCoords.longitude, safeCoords.latitude]}
          />

          <Mapbox.ShapeSource
            id="location-source"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [safeCoords.longitude, safeCoords.latitude],
              },
              properties: {},
            }}
            onPress={(event) => {
              if (location.isLocked) return;
              const coords = (event.features?.[0]?.geometry as any)?.coordinates;
              if (coords) {
                onLocationChange(coords[1], coords[0]);
              }
            }}
          >
            <Mapbox.SymbolLayer
              id="location-symbol"
              style={{
                iconImage: 'marker-15',
                iconSize: 1.4,
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
                iconColor: location.isLocked ? colors.scale.neutral[500] : colors.scale.primary[600],
              }}
            />
          </Mapbox.ShapeSource>
        </Mapbox.MapView>

        {location.isLocked && (
          <View style={styles.lockOverlay}>
            <Lock size={16} color={colors.scale.neutral[0]} />
            <Text style={styles.lockText}>Position verrouillée</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <View style={styles.coordsRow}>
          <View style={styles.coordInput}>
            <Input
              label="Latitude"
              value={location.latitude.toFixed(6)}
              onChangeText={(text) => {
                const val = parseFloat(text);
                if (!isNaN(val)) {
                  onLocationChange(val, location.longitude);
                }
              }}
              keyboardType="numeric"
              editable={!location.isLocked}
            />
          </View>
          <View style={styles.coordInput}>
            <Input
              label="Longitude"
              value={location.longitude.toFixed(6)}
              onChangeText={(text) => {
                const val = parseFloat(text);
                if (!isNaN(val)) {
                  onLocationChange(location.latitude, val);
                }
              }}
              keyboardType="numeric"
              editable={!location.isLocked}
            />
          </View>
        </View>

        <Input
          label="Numéro"
          value={address.streetNumber}
          onChangeText={(text) => onAddressChange({ ...address, streetNumber: text })}
          editable={!location.isLocked}
        />

        <Input
          label="Rue"
          value={address.streetName}
          onChangeText={(text) => onAddressChange({ ...address, streetName: text })}
          editable={!location.isLocked}
        />

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Input
              label="Code postal"
              value={address.postalCode}
              onChangeText={(text) => onAddressChange({ ...address, postalCode: text })}
              keyboardType="numeric"
              editable={!location.isLocked}
            />
          </View>
          <View style={styles.halfInput}>
            <Input
              label="Ville"
              value={address.city}
              onChangeText={(text) => onAddressChange({ ...address, city: text })}
              editable={!location.isLocked}
            />
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.actions}>
          {!location.isLocked ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={handleGeocodeAddress}
                disabled={geocodeLoading}
              >
                {geocodeLoading ? (
                  <ActivityIndicator size="small" color={colors.scale.primary[600]} />
                ) : (
                  <>
                    <Navigation size={18} color={colors.scale.primary[600]} />
                    <Text style={styles.buttonSecondaryText}>Localiser</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleValidateLocation}
                disabled={geocodeLoading}
              >
                {geocodeLoading ? (
                  <ActivityIndicator size="small" color={colors.scale.neutral[0]} />
                ) : (
                  <>
                    <Lock size={18} color={colors.scale.neutral[0]} />
                    <Text style={styles.buttonPrimaryText}>Valider</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, { flex: 1 }]}
              onPress={handleUnlockLocation}
            >
              <Unlock size={18} color={colors.scale.primary[600]} />
              <Text style={styles.buttonSecondaryText}>Modifier</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  mapContainer: {
    height: 300,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  lockOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.scale.success[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  lockText: {
    ...typography.caption,
    color: colors.scale.neutral[0],
    fontWeight: '600',
  },
  controls: {
    gap: spacing.md,
  },
  coordsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  coordInput: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  error: {
    ...typography.bodySmall,
    color: colors.scale.error[600],
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  buttonPrimary: {
    backgroundColor: colors.scale.primary[600],
  },
  buttonSecondary: {
    backgroundColor: colors.scale.primary[50],
    borderWidth: 1,
    borderColor: colors.scale.primary[200],
  },
  buttonPrimaryText: {
    ...typography.body,
    color: colors.scale.neutral[0],
    fontWeight: '600',
  },
  buttonSecondaryText: {
    ...typography.body,
    color: colors.scale.primary[600],
    fontWeight: '600',
  },
});
