const { env } = require("../config/env");
const { request, HttpClientError } = require("./httpClient");

const USER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
const REPO_REGEX = /^[a-zA-Z0-9._-]+$/;

/**
 * Look up a public GitHub user or repository ("username" or "owner/repo").
 * @param {string} target
 */
async function lookupGithub(target) {
    const clean = String(target || "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
    if (!clean) {
        throw new TypeError("Usage: /github <username> or /github <owner/repo>");
    }

    const headers = { Accept: "application/vnd.github+json" };
    if (env.apis.github.token) {
        headers.Authorization = `Bearer ${env.apis.github.token}`;
    }

    if (clean.includes("/")) {
        const parts = clean.split("/");
        if (parts.length !== 2 || !USER_REGEX.test(parts[0]) || !REPO_REGEX.test(parts[1])) {
            throw new TypeError("Invalid repository format. Use owner/repo.");
        }

        try {
            const repo = await request({
                method: "GET",
                url: `https://api.github.com/repos/${parts[0]}/${parts[1]}`,
                headers,
            });
            return {
                kind: "repo",
                found: true,
                fullName: repo.full_name,
                description: repo.description || "No description",
                stars: repo.stargazers_count ?? 0,
                forks: repo.forks_count ?? 0,
                language: repo.language || "Unknown",
                url: repo.html_url,
            };
        } catch (err) {
            if (err instanceof HttpClientError && err.code === "NOT_FOUND") {
                return { kind: "repo", found: false, query: clean };
            }
            throw err;
        }
    }

    if (!USER_REGEX.test(clean)) {
        throw new TypeError("Invalid GitHub username.");
    }

    try {
        const user = await request({
            method: "GET",
            url: `https://api.github.com/users/${clean}`,
            headers,
        });
        return {
            kind: "user",
            found: true,
            login: user.login,
            name: user.name || user.login,
            bio: user.bio || "No bio",
            publicRepos: user.public_repos ?? 0,
            followers: user.followers ?? 0,
            url: user.html_url,
        };
    } catch (err) {
        if (err instanceof HttpClientError && err.code === "NOT_FOUND") {
            return { kind: "user", found: false, query: clean };
        }
        throw err;
    }
}

module.exports = {
    lookupGithub,
};
