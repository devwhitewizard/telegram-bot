const { env } = require("../config/env");
const { request } = require("./httpClient");

const MAX_PROMPT_LENGTH = 1000;
const MAX_TELEGRAM_RESPONSE = 3800;

/**
 * Send a single-turn prompt to the globally configured AI provider.
 * @param {string} prompt
 * @param {object} [aiConfig=env.apis.ai]
 */
async function askAi(prompt, aiConfig = env.apis.ai) {
    if (!aiConfig?.apiKey) {
        return {
            configured: false,
            error: "AI integration is not configured on this bot (missing AI_API_KEY).",
        };
    }

    const cleanPrompt = String(prompt || "").trim();
    if (!cleanPrompt) {
        throw new TypeError("Please provide a prompt. Example: /ai Explain async/await");
    }
    if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
        throw new TypeError(`Prompt is too long (maximum ${MAX_PROMPT_LENGTH} characters).`);
    }

    const data = await request(
        {
            method: "POST",
            url: `${aiConfig.baseUrl}/chat/completions`,
            headers: {
                Authorization: `Bearer ${aiConfig.apiKey}`,
                "Content-Type": "application/json",
            },
            data: {
                model: aiConfig.model,
                max_tokens: aiConfig.maxTokens,
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful, concise assistant in a Telegram chat.",
                    },
                    { role: "user", content: cleanPrompt },
                ],
            },
        },
        { retries: 0 }
    );

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
        throw new Error("AI provider returned an empty response.");
    }

    const trimmed = content.trim();
    const replyText =
        trimmed.length > MAX_TELEGRAM_RESPONSE
            ? `${trimmed.slice(0, MAX_TELEGRAM_RESPONSE)}...\n\n[Truncated for Telegram message limit]`
            : trimmed;

    return {
        configured: true,
        model: data?.model || aiConfig.model,
        text: replyText,
    };
}

module.exports = {
    MAX_PROMPT_LENGTH,
    MAX_TELEGRAM_RESPONSE,
    askAi,
};
