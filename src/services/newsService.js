const { env } = require("../config/env");
const { request } = require("./httpClient");

const MAX_RESULTS = 5;

/**
 * Search recent news articles using the configured global news provider.
 * @param {string} query
 * @param {object} [newsConfig=env.apis.news]
 */
async function searchNews(query, newsConfig = env.apis.news) {
    if (!newsConfig?.apiKey) {
        return {
            configured: false,
            error: "News integration is not configured on this bot (missing NEWS_API_KEY).",
        };
    }

    const cleanQuery = String(query || "").trim();
    if (!cleanQuery || cleanQuery.length > 100) {
        throw new TypeError("Please provide a search topic (1–100 characters).");
    }

    let articles = [];
    if (newsConfig.provider === "newsapi") {
        const data = await request({
            method: "GET",
            url: "https://newsapi.org/v2/everything",
            headers: { "X-Api-Key": newsConfig.apiKey },
            params: { q: cleanQuery, pageSize: MAX_RESULTS, language: "en", sortBy: "publishedAt" },
        });
        articles = (data?.articles || []).slice(0, MAX_RESULTS).map((a) => ({
            title: a.title,
            description: a.description || "",
            source: a.source?.name || "Unknown",
            url: a.url,
        }));
    } else {
        const data = await request({
            method: "GET",
            url: "https://gnews.io/api/v4/search",
            params: {
                q: cleanQuery,
                max: MAX_RESULTS,
                lang: "en",
                apikey: newsConfig.apiKey,
            },
        });
        articles = (data?.articles || []).slice(0, MAX_RESULTS).map((a) => ({
            title: a.title,
            description: a.description || "",
            source: a.source?.name || "Unknown",
            url: a.url,
        }));
    }

    return {
        configured: true,
        query: cleanQuery,
        articles,
    };
}

module.exports = {
    searchNews,
};

