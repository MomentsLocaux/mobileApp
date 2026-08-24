import AsyncStorage from '@react-native-async-storage/async-storage';

export type LumiaTourStatus = 'pending' | 'done' | 'skipped';

const keyFor = (userId: string) => `lumia_tour_v1:${userId}`;

export async function getLumiaTourStatus(userId: string): Promise<LumiaTourStatus> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (raw === 'done' || raw === 'skipped') return raw;
    return 'pending';
  } catch {
    return 'pending';
  }
}

export async function setLumiaTourStatus(
  userId: string,
  status: Exclude<LumiaTourStatus, 'pending'>,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), status);
  } catch {
    // Local preference only — never block the app.
  }
}

export async function resetLumiaTour(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    // ignore
  }
}
