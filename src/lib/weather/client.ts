export interface WeatherForecast {
  startDate: string;
  endDate: string;
  averageHigh: number;
  averageLow: number;
  totalRainfallMm: number;
  description: string;
  daily: Array<{
    date: string;
    maxC: number;
    minC: number;
    rainMm: number;
    weatherCode: number;
  }>;
}

type OpenMeteoDaily = {
  time?: string[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_sum?: number[];
  weather_code?: number[];
};

type OpenMeteoResponse = {
  daily?: OpenMeteoDaily;
};

export async function getWeatherForecast(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
): Promise<WeatherForecast | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code",
    );
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = (await response.json()) as OpenMeteoResponse;
    const daily = data.daily;
    if (!daily?.time?.length) return null;

    const days = daily.time.map((date, index) => ({
      date,
      maxC: daily.temperature_2m_max?.[index] ?? 0,
      minC: daily.temperature_2m_min?.[index] ?? 0,
      rainMm: daily.precipitation_sum?.[index] ?? 0,
      weatherCode: daily.weather_code?.[index] ?? 0,
    }));

    const averageHigh =
      days.reduce((sum, day) => sum + day.maxC, 0) / days.length;
    const averageLow =
      days.reduce((sum, day) => sum + day.minC, 0) / days.length;
    const totalRainfallMm = days.reduce((sum, day) => sum + day.rainMm, 0);

    const description =
      totalRainfallMm > 20
        ? `Expect rain. Daily highs around ${Math.round(averageHigh)}C, lows around ${Math.round(averageLow)}C.`
        : `Mostly dry. Daily highs around ${Math.round(averageHigh)}C, lows around ${Math.round(averageLow)}C.`;

    return {
      startDate,
      endDate,
      averageHigh,
      averageLow,
      totalRainfallMm,
      description,
      daily: days,
    };
  } catch (err) {
    console.error("getWeatherForecast failed:", err);
    return null;
  }
}
