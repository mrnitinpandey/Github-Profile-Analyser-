
'use strict';

const API_BASE = 'https://api.github.com';

const form = document.getElementById('searchForm');
const usernameInput = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');
const messageEl = document.getElementById('message');
const loader = document.getElementById('loader');
const mainContent = document.getElementById('mainContent');

const el = (id) => document.getElementById(id);
const numberFormat = new Intl.NumberFormat();

let activeController = null;

// Search form
form.addEventListener('submit', (event) => {
    event.preventDefault();

    const username = usernameInput.value.trim().replace(/^@/, '');

    if (!username) {
        showMessage('Please enter a GitHub username.');
        usernameInput.focus();
        return;
    }

    exploreUser(username);
});

// Fetch GitHub profile
async function exploreUser(username) {

    if (activeController) {
        activeController.abort();
    }

    activeController = new AbortController();

    const { signal } = activeController;

    setLoading(true);
    showMessage('');
    mainContent.classList.add('hidden');

    try {
        const user = await apiRequest(
            `/users/${encodeURIComponent(username)}`,
            signal
        );

        const repos = await fetchAllRepositories(username, signal);

        renderProfile(user, repos);

        mainContent.classList.remove('hidden');

    } catch (error) {

        if (error.name === 'AbortError') return;

        showMessage(error.message || 'Something went wrong.');

    } finally {

        if (activeController && activeController.signal === signal) {
            setLoading(false);
            activeController = null;
        }
    }
}

// GitHub API request
async function apiRequest(path, signal) {

    const response = await fetch(`${API_BASE}${path}`, {
        headers: {
            Accept: 'application/vnd.github+json'
        },
        signal
    });

    if (response.status === 404) {
        throw new Error(
            'GitHub user not found. Check the username.'
        );
    }

    if (response.status === 403 || response.status === 429) {

        const reset = response.headers.get('X-RateLimit-Reset');

        const resetText = reset
            ? ` Try again after ${new Date(
                Number(reset) * 1000
            ).toLocaleTimeString()}.`
            : ' Please wait and try again.';

        throw new Error(`GitHub API rate limit reached.${resetText}`);
    }

    if (!response.ok) {
        throw new Error(
            `GitHub API request failed (${response.status}).`
        );
    }

    return response.json();
}

// Fetch repositories
async function fetchAllRepositories(username, signal) {

    return apiRequest(
        `/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`,
        signal
    );
}

// Display profile
function renderProfile(user, repos) {

    const displayName = user.name || user.login;

    el('avatar').src = user.avatar_url;
    el('avatar').alt = `${user.login}'s GitHub avatar`;

    el('name').textContent = displayName;

    const usernameLink = el('profileUsername');

    usernameLink.textContent = `@${user.login}`;
    usernameLink.href = user.html_url;

    el('bio').textContent =
        user.bio || 'This developer has not added a bio yet.';

    el('location').textContent =
        user.location ? `📍 ${user.location}` : '';

    el('joinedDate').textContent =
        `Joined GitHub ${formatDate(user.created_at)}`;

    const profileLink = el('profileLink');

    profileLink.href = user.html_url;
    profileLink.rel = 'noopener noreferrer';

    el('repoCount').textContent =
        numberFormat.format(user.public_repos || 0);

    el('followers').textContent =
        numberFormat.format(user.followers || 0);

    el('following').textContent =
        numberFormat.format(user.following || 0);

    const totalStars = repos.reduce(
        (sum, repo) => sum + (repo.stargazers_count || 0),
        0
    );

    el('totalStars').textContent =
        numberFormat.format(totalStars);

    el('repoTotal').textContent =
        `${repos.length} public ${
            repos.length === 1 ? 'repository' : 'repositories'
        }`;

    renderLanguages(repos);
    renderRepositories(repos);
}

// Programming languages
function renderLanguages(repos) {

    const counts = new Map();

    repos.forEach((repo) => {

        if (repo.language) {
            counts.set(
                repo.language,
                (counts.get(repo.language) || 0) + 1
            );
        }

    });

    const container = el('languagesContainer');

    container.replaceChildren();

    const sorted = [...counts.entries()]
        .sort((a, b) => b[1] - a[1]);

    if (!sorted.length) {

        container.append(
            createTextElement(
                'p',
                'No programming language data available.',
                'empty-state'
            )
        );

        return;
    }

    sorted.forEach(([language, count]) => {

        const item = document.createElement('div');

        item.className = 'language-item';

        item.append(document.createTextNode(language));

        const strong = document.createElement('strong');

        strong.textContent = count;

        item.append(strong);

        container.append(item);

    });
}

// Top repositories
function renderRepositories(repos) {

    const container = el('repositoriesContainer');

    container.replaceChildren();

    const sorted = [...repos]
        .sort(
            (a, b) =>
                (b.stargazers_count || 0) -
                (a.stargazers_count || 0)
        )
        .slice(0, 10);

    if (!sorted.length) {

        container.append(
            createTextElement(
                'p',
                'No public repositories found.',
                'empty-state'
            )
        );

        return;
    }

    sorted.forEach((repo) => {

        const card = document.createElement('article');

        card.className = 'repo-card';

        const heading = document.createElement('h3');

        const link = document.createElement('a');

        link.href = repo.html_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = repo.name;

        heading.append(link);

        const description = createTextElement(
            'p',
            repo.description ||
            'No description provided for this repository.'
        );

        const meta = document.createElement('div');

        meta.className = 'repo-meta';

        addMeta(meta, '⭐', numberFormat.format(
            repo.stargazers_count || 0
        ));

        addMeta(meta, '🍴', numberFormat.format(
            repo.forks_count || 0
        ));

        if (repo.language) {
            addMeta(meta, '●', repo.language);
        }

        addMeta(meta, 'Updated', formatDate(repo.updated_at));

        card.append(heading, description, meta);

        container.append(card);

    });
}

// Add repository information
function addMeta(parent, label, value) {

    const item = document.createElement('span');

    item.textContent = `${label} ${value}`;

    parent.append(item);
}

// Create safe text elements
function createTextElement(tag, text, className = '') {

    const node = document.createElement(tag);

    node.textContent = text;

    if (className) {
        node.className = className;
    }

    return node;
}

// Format dates
function formatDate(value) {

    if (!value) return 'an unknown date';

    return new Date(value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Display errors
function showMessage(message) {
    messageEl.textContent = message;
}

// Loading state
function setLoading(isLoading) {

    loader.classList.toggle('hidden', !isLoading);

    searchBtn.disabled = isLoading;

    searchBtn.textContent = isLoading
        ? 'Searching…'
        : 'Search';
}
