import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FRANCE_CAMERA_CENTER, MAP_LOCAL_ZOOM } from '../constants/map-screen';
import {
  resolveMapInitialCamera,
  shouldBootstrapViewportFetch,
} from './map-camera-fallback';

describe('map camera fallback', () => {
  it('prefers a real GPS position', () => {
    const camera = resolveMapInitialCamera({
      userLocation: { latitude: 48.69, longitude: 6.18 },
      placeCenter: { latitude: 43.3, longitude: 5.4 },
    });
    assert.equal(camera.kind, 'user');
    assert.equal(camera.zoom, MAP_LOCAL_ZOOM);
    assert.equal(camera.latitude, 48.69);
  });

  it('uses an explicit searched place when GPS is missing', () => {
    const camera = resolveMapInitialCamera({
      userLocation: null,
      placeCenter: { latitude: 47.32, longitude: 5.04 },
    });
    assert.equal(camera.kind, 'place');
    assert.equal(camera.latitude, 47.32);
    assert.equal(camera.longitude, 5.04);
  });

  it('opens on metropolitan France instead of a hardcoded town', () => {
    const camera = resolveMapInitialCamera({
      userLocation: null,
      placeCenter: null,
    });
    assert.equal(camera.kind, 'country');
    assert.equal(camera.latitude, FRANCE_CAMERA_CENTER.latitude);
    assert.equal(camera.longitude, FRANCE_CAMERA_CENTER.longitude);
    assert.equal(shouldBootstrapViewportFetch('country'), false);
    assert.equal(shouldBootstrapViewportFetch('place'), true);
    assert.equal(shouldBootstrapViewportFetch('user'), true);
  });
});
