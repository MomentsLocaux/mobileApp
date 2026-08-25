import { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import { LUMIA_TOUR_TARGET_RADIUS, type LumiaTourTargetId } from '@/constants/lumiaTour';
import { useLumiaTourStore } from '@/store/lumiaTourStore';

export function useLumiaTourTarget(id: LumiaTourTargetId | undefined) {
  const setTarget = useLumiaTourStore((s) => s.setTarget);
  const measureVersion = useLumiaTourStore((s) => s.measureVersion);
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    if (!id) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      const radius = Math.min(LUMIA_TOUR_TARGET_RADIUS[id], width / 2, height / 2);
      setTarget(id, { x, y, width, height, radius });
    });
  }, [id, setTarget]);

  useEffect(() => {
    if (!id) return;
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      setTarget(id, null);
    };
  }, [id, measure, setTarget]);

  useEffect(() => {
    if (!id) return;
    const frame = requestAnimationFrame(measure);
    const later = setTimeout(measure, 280);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(later);
    };
  }, [id, measure, measureVersion]);

  return {
    ref,
    onLayout: measure,
    measure,
  };
}
