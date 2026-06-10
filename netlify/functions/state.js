const STORE_NAME = "eurojackpot-circle";
const STATE_KEY = "shared-state";

const defaultState = {
  members: [
    { name: "Anna", paid: true, note: "PayPal" },
    { name: "Ben", paid: true, note: "Ueberweisung" },
    { name: "Clara", paid: true, note: "Bar" },
    { name: "David", paid: true, note: "PayPal" },
    { name: "Eva", paid: true, note: "Ueberweisung" },
    { name: "Felix", paid: true, note: "PayPal" },
    { name: "Mira", paid: true, note: "Bar" },
    { name: "Noah", paid: true, note: "Ueberweisung" },
    { name: "Lena", paid: false, note: "Offen" },
    { name: "Tom", paid: false, note: "Offen" },
  ],
  users: [
    { id: 1, name: "Anna", email: "anna@firma.de", role: "Admin", active: true },
    { id: 2, name: "Ben", email: "ben@firma.de", role: "Mitglied", active: true },
    { id: 3, name: "Lena", email: "lena@firma.de", role: "Mitglied", active: false },
  ],
  userTips: [
    { userId: 1, numbers: [6, 14, 21, 32, 41], euroNumbers: [3, 7] },
    { userId: 2, numbers: [3, 20, 21, 42, 49], euroNumbers: [5, 6] },
    { userId: 3, numbers: [2, 18, 27, 35, 44], euroNumbers: [1, 9] },
    { userId: 4, name: "Clara", numbers: [8, 16, 22, 31, 50], euroNumbers: [2, 11] },
  ],
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function normalizeState(input) {
  return {
    members: Array.isArray(input.members) ? input.members : defaultState.members,
    users: Array.isArray(input.users) ? input.users : defaultState.users,
    userTips: Array.isArray(input.userTips) ? input.userTips : defaultState.userTips,
    updatedAt: new Date().toISOString(),
  };
}

exports.handler = async (event) => {
  let store;

  try {
    const { getStore } = require("@netlify/blobs");
    const manualConfig =
      process.env.NETLIFY_BLOBS_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN
        ? {
            siteID: process.env.NETLIFY_BLOBS_SITE_ID,
            token: process.env.NETLIFY_BLOBS_TOKEN,
          }
        : undefined;

    store = manualConfig ? getStore(STORE_NAME, manualConfig) : getStore(STORE_NAME);
  } catch (error) {
    const state = normalizeState(defaultState);
    state.storage = "local-fallback";
    state.warning = error.message;
    state.envCheck = {
      hasSiteId: Boolean(process.env.NETLIFY_BLOBS_SITE_ID),
      hasToken: Boolean(process.env.NETLIFY_BLOBS_TOKEN),
      version: "manual-env-v2",
    };
    return json(event.httpMethod === "GET" ? 200 : 202, state);
  }

  try {
    if (event.httpMethod === "GET") {
      const state = await store.get(STATE_KEY, { type: "json" });
      return json(200, state || normalizeState(defaultState));
    }

    if (event.httpMethod === "POST") {
      const parsed = JSON.parse(event.body || "{}");
      const state = normalizeState(parsed);
      await store.setJSON(STATE_KEY, state);
      return json(200, state);
    }

    return json(405, { error: "Method not allowed" });
  } catch (error) {
    return json(200, {
      ...normalizeState(defaultState),
      storage: "fallback-after-error",
      warning: error.message,
      envCheck: {
        hasSiteId: Boolean(process.env.NETLIFY_BLOBS_SITE_ID),
        hasToken: Boolean(process.env.NETLIFY_BLOBS_TOKEN),
        version: "manual-env-v2",
      },
    });
  }
};
