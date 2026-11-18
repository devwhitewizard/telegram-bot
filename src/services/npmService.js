const { request, HttpClientError } = require("./httpClient");

const NPM_NAME_REGEX = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * Retrieve public NPM package metadata and weekly download count.
 * @param {string} packageName
 */
async function lookupNpmPackage(packageName) {
    const clean = String(packageName || "").trim().toLowerCase();
    if (!clean || clean.length > 214 || !NPM_NAME_REGEX.test(clean)) {
        throw new TypeError("Please provide a valid NPM package name.");
    }

    const encoded = encodeURIComponent(clean);
    let pkg;
    try {
        pkg = await request({
            method: "GET",
            url: `https://registry.npmjs.org/${encoded}`,
        });
    } catch (err) {
        if (err instanceof HttpClientError && err.code === "NOT_FOUND") {
            return { found: false, name: clean };
        }
        throw err;
    }

    const latestVersion = pkg?.["dist-tags"]?.latest || "unknown";
    const latestMeta = pkg?.versions?.[latestVersion] || {};
    const author =
        typeof pkg?.author === "string"
            ? pkg.author
            : pkg?.author?.name || latestMeta?.author?.name || null;

    let weeklyDownloads = null;
    try {
        const dl = await request(
            {
                method: "GET",
                url: `https://api.npmjs.org/downloads/point/last-week/${encoded}`,
            },
            { retries: 0 }
        );
        weeklyDownloads = typeof dl?.downloads === "number" ? dl.downloads : null;
    } catch {
        weeklyDownloads = null;
    }

    return {
        found: true,
        name: pkg.name || clean,
        version: latestVersion,
        description: pkg.description || "No description",
        author,
        weeklyDownloads,
        url: `https://www.npmjs.com/package/${pkg.name || clean}`,
    };
}

module.exports = {
    lookupNpmPackage,
};

