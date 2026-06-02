export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || '';

export const requireApiBaseUrl = () => {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured for this environment.');
  }
  return API_BASE_URL;
};
