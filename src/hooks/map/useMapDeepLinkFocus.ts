import { useEffect, useRef } from 'react';

/** Deep-link focus: treat each event id once even if the screen mount is reused. */
export function useMapDeepLinkFocus(
  focus: string | undefined,
  onFocusEvent: (eventId: string) => void
) {
  const lastHandledFocusIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focus) return;
    const focusId = String(focus);
    if (lastHandledFocusIdRef.current === focusId) return;
    lastHandledFocusIdRef.current = focusId;
    onFocusEvent(focusId);
  }, [focus, onFocusEvent]);
}
