// MARK: - Configuration

const DEFAULTS = {
    retries: 3,
    timeoutMs: 5000,
};

// MARK: - Networking

const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, { ...DEFAULTS, ...options });
    return response.json();
};

// MARK: Utilities (dashless mark)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// MARK: -

module.exports = { fetchJson, sleep };
