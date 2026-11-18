const { request } = require("./httpClient");

const WMO_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Rain showers",
    95: "Thunderstorm",
};

/**
 * Fetch current weather for a city/location using keyless Open-Meteo APIs.
 * @param {string} location
 */
async function getWeather(location) {
    const query = String(location || "").trim();
    if (!query || query.length > 100) {
        throw new TypeError("Please provide a valid city or location name (1–100 chars).");
    }

    const geo = await request({
        method: "GET",
        url: "https://geocoding-api.open-meteo.com/v1/search",
        params: { name: query, count: 1, language: "en", format: "json" },
    });

    const place = geo?.results?.[0];
    if (!place) {
        return { found: false, query };
    }

    const forecast = await request({
        method: "GET",
        url: "https://api.open-meteo.com/v1/forecast",
        params: {
            latitude: place.latitude,
            longitude: place.longitude,
            current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
            temperature_unit: "celsius",
            wind_speed_unit: "kmh",
        },
    });

    const current = forecast?.current || {};
    const tempC = current.temperature_2m;
    const tempF = typeof tempC === "number" ? Number(((tempC * 9) / 5 + 32).toFixed(1)) : null;

    return {
        found: true,
        location: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
        condition: WMO_CODES[current.weather_code] || "Unknown",
        temperatureC: tempC,
        temperatureF: tempF,
        humidity: current.relative_humidity_2m ?? null,
        windKmh: current.wind_speed_10m ?? null,
    };
}

module.exports = {
    getWeather,
};

