const settingsService = require("../services/settingsService");
const settingsRepository = require("../database/repositories/settingsRepository");
const { buildSettingsView } = require("../keyboards/settingsKeyboard");

const ADMIN_STATUSES = new Set(["creator", "administrator"]);

async function ensureCallbackAdmin(ctx) {
    if (!ctx.chat || (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup")) {
        await ctx.answerCbQuery("Group settings are only available in groups.");
        return false;
    }

    try {
        const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        if (!member || !ADMIN_STATUSES.has(member.status)) {
            await ctx.answerCbQuery("Only group administrators can change settings.", {
                show_alert: true,
            });
            return false;
        }
        return true;
    } catch {
        await ctx.answerCbQuery("Could not verify administrator permissions.");
        return false;
    }
}

async function renderUpdatedView(ctx, menu, settings) {
    const view = buildSettingsView(menu, settings, ctx.chat?.title || "Group");
    await ctx.answerCbQuery("Settings updated");
    try {
        await ctx.editMessageText(view.text, view.extra);
    } catch {
        // Ignore "message is not modified" errors
    }
}

function registerSettingsHandlers(bot) {
    bot.action(/^cfg:close$/, async (ctx) => {
        if (!(await ensureCallbackAdmin(ctx))) return;
        await ctx.answerCbQuery();
        try {
            await ctx.deleteMessage();
        } catch {
            // Ignore if bot lacks delete permission
        }
    });

    bot.action(/^cfg:menu:([a-z]+)$/, async (ctx) => {
        if (!(await ensureCallbackAdmin(ctx))) return;
        const group = ctx.state.group;
        const settings =
            ctx.state.groupSettings || (await settingsRepository.getGroupSettings(group.id));
        const view = buildSettingsView(ctx.match[1], settings, ctx.chat?.title || "Group");
        await ctx.answerCbQuery();
        try {
            await ctx.editMessageText(view.text, view.extra);
        } catch {
            // Ignore unchanged message
        }
    });

    bot.action(/^cfg:toggle:([a-zA-Z]+):([a-z]+)$/, async (ctx) => {
        if (!(await ensureCallbackAdmin(ctx))) return;
        const group = ctx.state.group;
        const settings =
            ctx.state.groupSettings || (await settingsRepository.getGroupSettings(group.id));
        const updated = await settingsService.toggleSetting(group.id, settings, ctx.match[1]);
        await renderUpdatedView(ctx, ctx.match[2], updated);
    });

    bot.action(/^cfg:cycle:([a-zA-Z]+):([a-z]+)$/, async (ctx) => {
        if (!(await ensureCallbackAdmin(ctx))) return;
        const group = ctx.state.group;
        const settings =
            ctx.state.groupSettings || (await settingsRepository.getGroupSettings(group.id));
        const updated = await settingsService.cycleSetting(group.id, settings, ctx.match[1]);
        await renderUpdatedView(ctx, ctx.match[2], updated);
    });

    bot.action(/^cfg:spam:(low|medium|high)$/, async (ctx) => {
        if (!(await ensureCallbackAdmin(ctx))) return;
        const updated = await settingsService.applyAntiSpamPreset(
            ctx.state.group.id,
            ctx.match[1]
        );
        await renderUpdatedView(ctx, "prot", updated);
    });

    bot.action(/^cfg:flood:(low|medium|high)$/, async (ctx) => {
        if (!(await ensureCallbackAdmin(ctx))) return;
        const updated = await settingsService.applyAntiFloodPreset(
            ctx.state.group.id,
            ctx.match[1]
        );
        await renderUpdatedView(ctx, "prot", updated);
    });
}

module.exports = {
    ensureCallbackAdmin,
    registerSettingsHandlers,
};

