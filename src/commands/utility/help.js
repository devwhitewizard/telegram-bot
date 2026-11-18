const { escapeHtml } = require("../../utils/escapeMarkdown");
const { getCommandArgs } = require("../../utils/extractUser");

const CATEGORY_LABELS = {
    utility: "🛠️ Utility",
    group: "⚙️ Group & Settings",
    admin: "🛡️ Moderation (Admin)",
    protection: "🧱 Group Protection (Admin)",
    engagement: "👋 Welcome & Engagement",
    games: "🎮 Games & Competitions",
    fun: "🎉 Entertainment",
    integrations: "🌐 API Integrations",
};

const MAX_MESSAGE_LENGTH = 3800;

/**
 * Split an array of formatted sections into chunks under MAX_MESSAGE_LENGTH.
 */
function chunkSections(sections, maxLen = MAX_MESSAGE_LENGTH) {
    const chunks = [];
    let current = "";

    for (const section of sections) {
        const candidate = current ? `${current}\n\n${section}` : section;
        if (candidate.length <= maxLen) {
            current = candidate;
        } else {
            if (current) chunks.push(current);
            if (section.length <= maxLen) {
                current = section;
            } else {
                // Split oversized single section by lines
                const lines = section.split("\n");
                let lineBuf = "";
                for (const line of lines) {
                    const nextBuf = lineBuf ? `${lineBuf}\n${line}` : line;
                    if (nextBuf.length <= maxLen) {
                        lineBuf = nextBuf;
                    } else {
                        if (lineBuf) chunks.push(lineBuf);
                        lineBuf = line;
                    }
                }
                current = lineBuf;
            }
        }
    }

    if (current) {
        chunks.push(current);
    }

    return chunks;
}

module.exports = {
    name: "help",
    description: "Show available commands (optionally filter by category)",
    cooldown: 2,
    chunkSections,
    execute: async (ctx) => {
        const commandsMap = ctx.commands;
        if (!commandsMap || commandsMap.size === 0) {
            await ctx.reply("No commands are currently registered.");
            return;
        }

        const filterCategory = (getCommandArgs(ctx)[0] || "").trim().toLowerCase();
        const grouped = new Map();

        for (const cmd of commandsMap.values()) {
            if (cmd.hidden) continue;
            const cat = cmd.category || "utility";
            if (filterCategory && cat !== filterCategory) continue;
            if (!grouped.has(cat)) grouped.set(cat, []);
            grouped.get(cat).push(cmd);
        }

        if (grouped.size === 0) {
            const available = Object.keys(CATEGORY_LABELS).join(", ");
            await ctx.reply(
                `No commands found for category "${escapeHtml(filterCategory)}".\nAvailable categories: ${available}`,
                { parse_mode: "HTML" }
            );
            return;
        }

        const orderedCategories = [
            ...Object.keys(CATEGORY_LABELS),
            ...Array.from(grouped.keys()).filter((c) => !CATEGORY_LABELS[c]),
        ];

        const sections = [];
        for (const cat of orderedCategories) {
            const cmds = grouped.get(cat);
            if (!cmds || cmds.length === 0) continue;

            const title = CATEGORY_LABELS[cat] || cat.toUpperCase();
            const lines = cmds
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((cmd) => `/${escapeHtml(cmd.name)} - ${escapeHtml(cmd.description)}`);
            sections.push(`<b>${escapeHtml(title)}</b>\n${lines.join("\n")}`);
        }

        const chunks = chunkSections(sections);
        for (let i = 0; i < chunks.length; i += 1) {
            const header =
                i === 0
                    ? `📖 <b>Available Commands (${commandsMap.size})</b>\n<i>Tip: use /help &lt;category&gt; to filter.</i>\n\n`
                    : "";
            await ctx.reply(`${header}${chunks[i]}`, { parse_mode: "HTML" });
        }
    },
};
