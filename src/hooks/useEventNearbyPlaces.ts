import { useEffect, useRef, useState } from 'react';
import {
  executeNearbyQuery,
  shouldApplyNearbyResult,
  type NearbyLoader,
  type NearbyPlace,
  type NearbyQueryResult,
} from '@/services/nearby/nearby-places';
import {
  nearbyProviderIsAvailable,
  requestNearbyPlaces,
} from '@/services/nearby/nearby-places-client';

type Options = {
  enabled: boolean;
  visible: boolean;
  eventId: string;
  latitude: number | null;
  longitude: number | null;
  attempt: number;
  loader?: NearbyLoader;
};

export type NearbySectionState = {
  status: NearbyQueryResult['status'] | 'idle' | 'loading';
  places: NearbyPlace[];
  attribution: string | null;
  errorReason: 'timeout' | 'unavailable' | null;
};

export function useEventNearbyPlaces({
  enabled,
  visible,
  eventId,
  latitude,
  longitude,
  attempt,
  loader = requestNearbyPlaces,
}: Options): NearbySectionState {
  const [state, setState] = useState<NearbySectionState>({
    status: 'idle',
    places: [],
    attribution: null,
    errorReason: null,
  });
  const requestRef = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const controller = new AbortController();
    const providerAvailable = nearbyProviderIsAvailable();

    if (!enabled || !visible || !providerAvailable) {
      setState({
        status: !enabled ? 'disabled' : !visible ? 'hidden' : 'blocked',
        places: [],
        attribution: null,
        errorReason: null,
      });
      return () => {
        requestRef.current += 1;
        controller.abort();
      };
    }

    setState({ status: 'loading', places: [], attribution: null, errorReason: null });
    void executeNearbyQuery(
      {
        featureEnabled: enabled,
        providerAvailable,
        visible,
        eventId,
        latitude,
        longitude,
      },
      { loader: loaderRef.current, signal: controller.signal },
    ).then((result) => {
      if (!shouldApplyNearbyResult(requestId, requestRef.current)) return;
      if (result.status === 'success') {
        setState({
          status: 'success',
          places: result.places,
          attribution: result.attribution,
          errorReason: null,
        });
        return;
      }
      setState({
        status: result.status,
        places: [],
        attribution: null,
        errorReason: result.status === 'error' ? result.reason : null,
      });
    });

    return () => {
      requestRef.current += 1;
      controller.abort();
    };
  }, [attempt, enabled, eventId, latitude, longitude, visible]);

  return state;
}
