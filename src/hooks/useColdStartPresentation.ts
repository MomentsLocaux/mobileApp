import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useReduceMotion } from './useReduceMotion';

const MINIMUM_VISIBLE_MS = 3000;

// Runtime memory only: a warm resume or React remount keeps this launch consumed.
// A terminated process / fresh JS runtime creates a new cold start.
let presentationComplete = false;
let visibleUntil: number | null = null;

export function useColdStartPresentation() {
  const initialReduceMotion = useReducedMotion();
  const reduceMotion = useReduceMotion(initialReduceMotion);
  const [complete, setComplete] = useState(() => (
    presentationComplete || (visibleUntil !== null && Date.now() >= visibleUntil)
  ));
  const [laidOut, setLaidOut] = useState(() => visibleUntil !== null);

  const finish = useCallback(() => {
    presentationComplete = true;
    setComplete(true);
  }, []);

  const onLayout = useCallback(() => {
    if (presentationComplete) return;
    // Start the minimum from the visible React screen, rather than JS/module startup.
    if (visibleUntil === null) visibleUntil = Date.now() + MINIMUM_VISIBLE_MS;
    setLaidOut(true);
  }, []);

  useEffect(() => {
    if (complete || reduceMotion) {
      finish();
      return;
    }
    if (!laidOut || visibleUntil === null) return;

    // A startup that was interrupted must not become another welcome screen on resume.
    if (AppState.currentState === 'background') {
      finish();
      return;
    }
    const timer = setTimeout(finish, Math.max(0, visibleUntil - Date.now()));
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') finish();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [complete, finish, laidOut, reduceMotion]);

  return { complete, onLayout };
}
