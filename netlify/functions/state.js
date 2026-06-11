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

function getAuthenticatedUser(context) {
  return context?.clientContext?.user || null;
}

function getUserRoles(user) {
  const appRoles = user?.app_metadata?.roles;
  const userRoles = user?.user_metadata?.roles;
  const roles = Array.isArray(appRoles) ? appRoles : Array.isArray(userRoles) ? userRoles : [];
  return roles.map((role) => String(role).toLowerCase());
}

function isAdmin(user) {
  return getUserRoles(user).includes("admin");
}

function getUserEmail(user) {
  return String(user?.email || "").toLowerCase();
}

function findAppUser(state, identityUser) {
  const email = getUserEmail(identityUser);
  return state.users.find((user) => String(user.email || "").toLowerCase() === email);
}

function isValidTip(tip) {
  return (
    tip &&
    Array.isArray(tip.numbers) &&
    Array.isArray(tip.euroNumbers) &&
    tip.numbers.length === 5 &&
    tip.euroNumbers.length === 2 &&
    tip.numbers.every((number) => Number.isInteger(Number(number)) && Number(number) >= 1 && Number(number) <= 50) &&
    tip.euroNumbers.every((number) => Number.isInteger(Number(number)) && Number(number) >= 1 && Number(number) <= 12)
  );
}

async function readState(store) {
  const state = await store.get(STATE_KEY, { type: "json" });
  return normalizeState(state || defaultState);
}

async function writeState(store, state) {
  const normalized = normalizeState(state);
  await store.setJSON(STATE_KEY, normalized);
  return normalized;
}

exports.handler = async (event, context) => {
  const user = getAuthenticatedUser(context);

  if (!user) {
    return json(401, { error: "Authentication required" });
  }

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

    if (manualConfig) {
      try {
        store = getStore(STORE_NAME, manualConfig);
      } catch (error) {
        store = getStore({ name: STORE_NAME, ...manualConfig });
      }
    } else {
      store = getStore(STORE_NAME);
    }
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
      const state = await readState(store);
      return json(200, {
        ...state,
        currentUser: {
          email: user.email,
          roles: getUserRoles(user),
          isAdmin: isAdmin(user),
        },
      });
    }

    if (event.httpMethod === "POST") {
      const parsed = JSON.parse(event.body || "{}");
      const existingState = await readState(store);

      if (isAdmin(user)) {
        const state = await writeState(store, parsed);
        return json(200, state);
      }

      const appUser = findAppUser(existingState, user);

      if (!appUser) {
        return json(403, { error: "No matching app user for this identity" });
      }

      const requestedTip = Array.isArray(parsed.userTips)
        ? parsed.userTips.find((tip) => Number(tip.userId) === Number(appUser.id))
        : null;

      if (!isValidTip(requestedTip)) {
        return json(403, { error: "Members can only update their own valid tip" });
      }

      const nextTip = {
        userId: appUser.id,
        name: appUser.name,
        numbers: requestedTip.numbers.map(Number).sort((first, second) => first - second),
        euroNumbers: requestedTip.euroNumbers.map(Number).sort((first, second) => first - second),
      };
      const existingTipIndex = existingState.userTips.findIndex((tip) => Number(tip.userId) === Number(appUser.id));
      const userTips =
        existingTipIndex >= 0
          ? existingState.userTips.map((tip, index) => (index === existingTipIndex ? nextTip : tip))
          : [...existingState.userTips, nextTip];
      const state = await writeState(store, { ...existingState, userTips });

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
