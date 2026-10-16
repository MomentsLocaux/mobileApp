import {
  messageForWeatherPlan,
  openMeteoForecastUrl,
  parseOpenMeteoForecast,
  planEventWeather,
  type EventWeatherView,
} from '@/utils/weather-forecast';

const FORECAST_TIMEOUT_MS = 8000;

export async function fetchEventWeather(input: {
  latitude: number;
  longitude: number;
  startsAt: string;
  endsAt?: string | null;
  now?: Date;
}): Promise<EventWeatherView> {
  const plan = planEventWeather({
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    now: input.now,
  });
  if (plan.status !== 'fetch') {
    return { status: plan.status, message: messageForWeatherPlan(plan) };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FORECAST_TIMEOUT_MS);
  try {
    const response = await fetch(
      openMeteoForecastUrl({
        latitude: input.latitude,
        longitude: input.longitude,
        startDate: plan.startDate,
        endDate: plan.endDate,
      }),
      { signal: controller.signal },
    );
    if (!response.ok) {
      return { status: 'unavailable', message: 'Prévision indisponible pour le moment.' };
    }
    const payload: unknown = await response.json();
    return parseOpenMeteoForecast({
      payload,
      startsAt: input.startsAt,
      truncated: plan.truncated,
    });
  } catch {
    return { status: 'unavailable', message: 'Prévision indisponible pour le moment.' };
  } finally {
    clearTimeout(timer);
  }
}
