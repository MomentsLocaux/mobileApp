import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase/client';
import {
  createAnalyticsId,
  enqueueAnalyticsEvent,
  isAnalyticsEventName,
  sanitizeAnalyticsProps,
  takeAnalyticsBatch,
  type AnalyticsEventName,
  type AnalyticsProps,
  type QueuedAnalyticsEvent,
} from '@/utils/analytics-events';

const QUEUE_KEY = 'analytics_queue_v1';
const OPT_OUT_KEY = 'analytics_opt_out';

let sessionId = createAnalyticsId();
let sessionStartedAt = Date.now();
let optedOut: boolean | null = null;
let flushing = false;

const readQueue = async (): Promise<QueuedAnalyticsEvent[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedAnalyticsEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: QueuedAnalyticsEvent[]) => {
  if (queue.length === 0) {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return;
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

async function loadOptOut(): Promise<boolean> {
  if (optedOut != null) return optedOut;
  optedOut = (await AsyncStorage.getItem(OPT_OUT_KEY)) === '1';
  return optedOut;
}

export const AnalyticsService = {
  currentSessionId(): string {
    return sessionId;
  },

  startSession() {
    sessionId = createAnalyticsId();
    sessionStartedAt = Date.now();
  },

  sessionDurationSeconds(): number {
    return Math.max(0, Math.min(86_400, Math.floor((Date.now() - sessionStartedAt) / 1000)));
  },

  async isOptedOut(): Promise<boolean> {
    return loadOptOut();
  },

  async setOptOut(value: boolean): Promise<void> {
    optedOut = value;
    await AsyncStorage.setItem(OPT_OUT_KEY, value ? '1' : '0');
    if (value) await writeQueue([]);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      await supabase
        .from('user_preferences')
        .update({ analytics_opt_out: value } as never)
        .eq('user_id', data.user.id);
    } catch {
      // The column arrives with the migration. The local flag already applies.
    }
  },

  track(name: AnalyticsEventName, props?: AnalyticsProps) {
    if (!isAnalyticsEventName(name)) return;
    const safe = sanitizeAnalyticsProps(name, props);
    if (!safe) return;
    const event: QueuedAnalyticsEvent = {
      client_event_id: createAnalyticsId(),
      session_id: sessionId,
      name,
      props: safe,
      created_at: new Date().toISOString(),
    };
    void (async () => {
      if (await loadOptOut()) return;
      const queue = enqueueAnalyticsEvent(await readQueue(), event);
      await writeQueue(queue);
      await AnalyticsService.flush();
    })().catch(() => undefined);
  },

  async flush(): Promise<void> {
    if (flushing) return;
    if (await loadOptOut()) {
      await writeQueue([]);
      return;
    }
    flushing = true;
    try {
      let queue = await readQueue();
      while (queue.length > 0) {
        const { batch, rest } = takeAnalyticsBatch(queue);
        const { error } = await supabase.rpc('track_analytics_events', { p_events: batch });
        if (error) return;
        queue = rest;
        await writeQueue(queue);
      }
    } catch {
      // Offline: the queue stays until the next flush.
    } finally {
      flushing = false;
    }
  },
};
