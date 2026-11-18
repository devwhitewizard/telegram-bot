const { env } = require("../config/env");
const { request } = require("./httpClient");

const LANG_CODE_REGEX = /^[a-z]{2}(?:-[A-Z]{2})?$/i;
const MAX_TEXT_LENGTH = 1000;

/**
 * Translate text using the configured provider ("mymemory" keyless default or "libretranslate").
 *
 * @param {object} params
 * @param {string} params.text
 * @param {string} params.targetLang
 * @param {string} [params.sourceLang="auto"]
 * @param {object} [translateConfig=env.apis.translate]
 */
async function translateText(
    { text, targetLang, sourceLang = "auto" },
    translateConfig = env.apis.translate
) {
    const cleanText = String(text || "").trim();
    const target = String(targetLang || "").trim().toLowerCase();
    const source = String(sourceLang || "auto").trim().toLowerCase();

    if (!cleanText) {
        throw new TypeError("Please provide text to translate.");
    }
    if (cleanText.length > MAX_TEXT_LENGTH) {
        throw new TypeError(`Text is too long (maximum ${MAX_TEXT_LENGTH} characters).`);
    }
    if (!LANG_CODE_REGEX.test(target)) {
        throw new TypeError("Invalid target language code (use ISO code like en, es, fr, de).");
    }
    if (source !== "auto" && !LANG_CODE_REGEX.test(source)) {
        throw new TypeError("Invalid source language code.");
    }

    if (translateConfig.provider === "libretranslate") {
        const payload = {
            q: cleanText,
            source,
            target,
            format: "text",
        };
        if (translateConfig.apiKey) {
            payload.api_key = translateConfig.apiKey;
        }

        const data = await request(
            {
                method: "POST",
                url: translateConfig.apiUrl,
                headers: { "Content-Type": "application/json" },
                data: payload,
            },
            { retries: 0 }
        );

        if (!data?.translatedText) {
            throw new Error("Translation provider returned an empty result.");
        }

        return {
            translatedText: data.translatedText,
            sourceLang: data.detectedLanguage?.language || source,
            targetLang: target,
        };
    }

    // Default keyless MyMemory provider (requires explicit source lang; fallback to "en" if "auto" when target != "en")
    const effectiveSource = source === "auto" ? (target === "en" ? "es" : "en") : source;
    const data = await request({
        method: "GET",
        url: "https://api.mymemory.translated.net/get",
        params: {
            q: cleanText,
            langpair: `${effectiveSource}|${target}`,
        },
    });

    if (data?.responseStatus && Number(data.responseStatus) !== 200) {
        throw new Error(data.responseDetails || "Translation failed or unsupported language pair.");
    }

    const translated = data?.responseData?.translatedText;
    if (!translated) {
        throw new Error("Translation provider did not return translated text.");
    }

    return {
        translatedText: translated,
        sourceLang: effectiveSource,
        targetLang: target,
    };
}

module.exports = {
    MAX_TEXT_LENGTH,
    translateText,
};

