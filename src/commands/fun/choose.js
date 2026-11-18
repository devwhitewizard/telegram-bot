const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

/**
 * Parse and validate /choose options separated by "|" or ",".
 * Exported for unit testing.
 */
function parseChooseOptions(rawInput) {
    const trimmed = String(rawInput || "").trim();
    if (!trimmed) {
        return { error: "Please provide options! Example: /choose Pizza | Burgers | Tacos" };
    }
    if (trimmed.length > 300) {
        return { error: "Input is too long (maximum 300 characters)." };
    }

    const separator = trimmed.includes("|") ? "|" : ",";
    const options = trimmed
        .split(separator)
        .map((s) => s.trim())
        .filter(Boolean);

    if (options.length < 2) {
        return { error: "Please provide at least 2 options separated by | or ,." };
    }
    if (options.length > 10) {
        return { error: "Please provide at most 10 options." };
    }

    return { options };
}

module.exports = {
    name: "choose",
    description: "Pick randomly between options (/choose opt1 | opt2 | ...)",
    parseChooseOptions,
    execute: async (ctx) => {
        const raw = getCommandArgs(ctx).join(" ");
        const parsed = parseChooseOptions(raw);

        if (parsed.error) {
            await ctx.reply(parsed.error);
            return;
        }

        const picked =
            parsed.options[Math.floor(Math.random() * parsed.options.length)];
        await ctx.reply(`🤔 I choose: <b>${escapeHtml(picked)}</b>`, {
            parse_mode: "HTML",
        });
    },
};

