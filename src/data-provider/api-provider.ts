import { API_BASE_URL } from './config';
import type { IDataProvider } from './types';

const withAuthHeader = (token?: string): Record<string, string> =>
  token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};

const asJson = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return null;
};

export const apiProvider: Pick<IDataProvider, 'checkInEvent' | 'reportEvent' | 'reportComment' | 'purchaseItem'> = {
  async checkInEvent(eventId, lat, lon, token) {
    const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...withAuthHeader(token),
      },
      body: JSON.stringify({ lat, lon }),
    });

    if (!response.ok) {
      const details = await asJson(response);
      throw new Error(details?.message || 'Check-in failed');
    }

    const payload = await asJson(response);
    return payload || { success: true };
  },

  async reportEvent(
    eventId,
    payload: { reason: string; severity?: string; details?: string; token?: string },
    token?: string,
  ) {
    const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...withAuthHeader(token ?? payload.token),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await asJson(response);
      throw new Error(details?.message || 'Report failed');
    }

    await asJson(response);
    return true;
  },

  async reportComment(
    commentId,
    payload: { reason: string; severity?: string; details?: string; token?: string },
    token?: string,
  ) {
    const response = await fetch(`${API_BASE_URL}/api/comments/${commentId}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...withAuthHeader(token ?? payload.token),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await asJson(response);
      throw new Error(details?.message || 'Report failed');
    }

    await asJson(response);
    return true;
  },

  async purchaseItem(
    payload: { itemId: string; method: 'lumo' | 'eur'; userId: string; token?: string },
    token?: string,
  ) {
    const response = await fetch(`${API_BASE_URL}/api/shop/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...withAuthHeader(token ?? payload.token),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await asJson(response);
      throw new Error(details?.message || 'Purchase failed');
    }

    await asJson(response);
    return true;
  },
};
