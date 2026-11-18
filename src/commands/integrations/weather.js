const weatherService = require("../../services/weatherService");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "weather",
    description: "Get current weather for a city (/weather <city>)",
    cooldown: 5,
    execute: async (ctx) => {
        const location = getCommandArgs(ctx).join(" ").trim();
        if (!location) {
            await ctx.reply("Usage: /weather <city or location>");
            return;
        }

        try {
            const data = await weatherService.getWeather(location);
            if (!data.found) {
                await ctx.reply(`Could not find weather data for "${escapeHtml(data.query)}".`, {
                    parse_mode: "HTML",
                });
                return;
            }

            await ctx.reply(
                `🌤️ <b>Weather — ${escapeHtml(data.location)}</b>\n\n` +
                    `• Condition: <b>${escapeHtml(data.condition)}</b>\n` +
                    `• Temperature: <b>${data.temperatureC}°C</b> (${data.temperatureF}°F)\n` +
                    `• Humidity: <b>${data.humidity ?? "?"}%</b>\n` +
                    `• Wind: <b>${data.windKmh ?? "?"} km/h</b>`,
                { parse_mode: "HTML" }
            );
        } catch (err) {
            await ctx.reply(err.message || "Could not retrieve weather right now.");
        }
    },
};

