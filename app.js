const STORAGE_KEY = "eurojackpot-circle-state-v1";
const STATE_ENDPOINT = "/.netlify/functions/state";

const defaultMembers = [
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
];

const defaultUserTips = [
  { userId: 1, numbers: [6, 14, 21, 32, 41], euroNumbers: [3, 7] },
  { userId: 2, numbers: [3, 20, 21, 42, 49], euroNumbers: [5, 6] },
  { userId: 3, numbers: [2, 18, 27, 35, 44], euroNumbers: [1, 9] },
  { userId: 4, name: "Clara", numbers: [8, 16, 22, 31, 50], euroNumbers: [2, 11] },
];

const fallbackResult = {
  drawDate: "Freitag, 5. Juni 2026",
  numbers: [21, 23, 44, 47, 50],
  euroNumbers: [1, 7],
  jackpot: "27.733.144 EUR",
  source: "Fallback nach letzter bekannter Quelle",
  updatedAt: "2026-06-05T20:00:00.000Z",
};

const defaultUsers = [
  { id: 1, name: "Anna", email: "anna@firma.de", role: "Admin", active: true },
  { id: 2, name: "Ben", email: "ben@firma.de", role: "Mitglied", active: true },
  { id: 3, name: "Lena", email: "lena@firma.de", role: "Mitglied", active: false },
];

let members = defaultMembers;
let userTips = defaultUserTips;
let users = defaultUsers;
let latestResult = fallbackResult;
let selectedNumbers = [6, 14, 21, 32, 41];
let selectedEuroNumbers = [3, 7];

const todayLabel = document.querySelector("#todayLabel");
const numberBoard = document.querySelector("#numberBoard");
const euroBoard = document.querySelector("#euroBoard");
const memberList = document.querySelector("#memberList");
const paymentTable = document.querySelector("#paymentTable");
const tipsList = document.querySelector("#tipsList");
const tipsStatus = document.querySelector("#tipsStatus");
const resultStrip = document.querySelector("#resultStrip");
const userForm = document.querySelector("#userForm");
const userList = document.querySelector("#userList");
const userName = document.querySelector("#userName");
const userEmail = document.querySelector("#userEmail");
const tipOwner = document.querySelector("#tipOwner");
const saveTipButton = document.querySelector("#saveTipButton");
const ticketStrip = document.querySelector("#ticketStrip");
const quickPickButton = document.querySelector("#quickPickButton");
const drawButton = document.querySelector("#drawButton");
const daysValue = document.querySelector("#daysValue");
const hoursValue = document.querySelector("#hoursValue");
const minutesValue = document.querySelector("#minutesValue");
const jackpotValue = document.querySelector("#jackpotValue");
const jackpotMeta = document.querySelector("#jackpotMeta");
const resultDate = document.querySelector("#resultDate");
const resultSource = document.querySelector("#resultSource");
const appShell = document.querySelector("#appShell");
const authGate = document.querySelector("#authGate");
const loginButton = document.querySelector("#loginButton");
const logoutButton = document.querySelector("#logoutButton");
const currentUserLabel = document.querySelector("#currentUserLabel");
let remoteSaveTimer;
let currentIdentityUser = null;
let appIntervals = [];

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!stored) {
      return;
    }

    members = Array.isArray(stored.members) ? stored.members : defaultMembers;
    users = Array.isArray(stored.users) ? stored.users : defaultUsers;
    userTips = Array.isArray(stored.userTips) ? stored.userTips : defaultUserTips;
  } catch (error) {
    members = defaultMembers;
    users = defaultUsers;
    userTips = defaultUserTips;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ members, users, userTips }));
  scheduleRemoteSave();
}

function scheduleRemoteSave() {
  clearTimeout(remoteSaveTimer);
  remoteSaveTimer = setTimeout(saveRemoteState, 350);
}

async function loadRemoteState() {
  try {
    const response = await authFetch(STATE_ENDPOINT, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Remote state unavailable");
    }

    const state = await response.json();
    members = Array.isArray(state.members) ? state.members : members;
    users = Array.isArray(state.users) ? state.users : users;
    userTips = Array.isArray(state.userTips) ? state.userTips : userTips;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ members, users, userTips }));
  } catch (error) {
    loadState();
  }
}

async function saveRemoteState() {
  try {
    await authFetch(STATE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members, users, userTips }),
    });
  } catch (error) {
    // Local persistence already succeeded; Netlify sync retries on the next change.
  }
}

async function authFetch(url, options = {}) {
  const token = currentIdentityUser ? await currentIdentityUser.jwt() : "";
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
}

function getIdentityUser() {
  if (!window.netlifyIdentity) {
    return null;
  }

  return window.netlifyIdentity.currentUser();
}

function showSignedOut() {
  currentIdentityUser = null;
  authGate.classList.remove("is-hidden");
  appShell.classList.add("is-hidden");
}

async function showSignedIn(user) {
  currentIdentityUser = user;
  currentUserLabel.textContent = user?.email || "Angemeldet";
  authGate.classList.add("is-hidden");
  appShell.classList.remove("is-hidden");
  await initApp();
}

function initIdentity() {
  if (!window.netlifyIdentity) {
    authGate.querySelector("p").textContent = "Netlify Identity konnte nicht geladen werden.";
    return;
  }

  window.netlifyIdentity.on("init", (user) => {
    if (user) {
      showSignedIn(user);
    } else {
      showSignedOut();
    }
  });

  window.netlifyIdentity.on("login", (user) => {
    window.netlifyIdentity.close();
    showSignedIn(user);
  });

  window.netlifyIdentity.on("logout", () => {
    showSignedOut();
  });

  window.netlifyIdentity.init();
}

function formatDate() {
  const formatter = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  todayLabel.textContent = formatter.format(new Date());
}

function updateCountdown() {
  const now = new Date();
  const drawDays = [5];
  const draw = drawDays
    .map((day) => {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + ((day - now.getDay() + 7) % 7));
      candidate.setHours(20, 0, 0, 0);
      if (candidate <= now) {
        candidate.setDate(candidate.getDate() + 7);
      }
      return candidate;
    })
    .sort((first, second) => first - second)[0];

  const diff = Math.max(draw - now, 0);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  daysValue.textContent = String(days).padStart(2, "0");
  hoursValue.textContent = String(hours).padStart(2, "0");
  minutesValue.textContent = String(minutes).padStart(2, "0");
}

function renderNumbers() {
  numberBoard.innerHTML = "";

  for (let number = 1; number <= 50; number += 1) {
    const pill = document.createElement("button");
    pill.className = "number-pill";
    pill.type = "button";
    pill.textContent = String(number).padStart(2, "0");

    if (selectedNumbers.includes(number)) {
      pill.classList.add("selected");
    }

    pill.addEventListener("click", () => toggleNumber(number));
    numberBoard.appendChild(pill);
  }

  renderEuroNumbers();
  renderTicketStrip();
}

function renderEuroNumbers() {
  euroBoard.innerHTML = "";

  for (let number = 1; number <= 12; number += 1) {
    const pill = document.createElement("button");
    pill.className = "number-pill euro";
    pill.type = "button";
    pill.textContent = String(number).padStart(2, "0");

    if (selectedEuroNumbers.includes(number)) {
      pill.classList.add("selected");
    }

    pill.addEventListener("click", () => toggleEuroNumber(number));
    euroBoard.appendChild(pill);
  }
}

function renderTicketStrip() {
  ticketStrip.innerHTML = [
    ...selectedNumbers.map((number) => `<span>${String(number).padStart(2, "0")}</span>`),
    ...selectedEuroNumbers.map((number) => `<span class="euro">${String(number).padStart(2, "0")}</span>`),
  ].join("");
}

function renderTipOwners() {
  const activeUsers = users.filter((user) => user.active);
  const selectedValue = tipOwner.value || String(activeUsers[0]?.id || "");

  tipOwner.innerHTML = activeUsers
    .map((user) => `<option value="${user.id}">${user.name}</option>`)
    .join("");

  if (activeUsers.some((user) => String(user.id) === selectedValue)) {
    tipOwner.value = selectedValue;
  }
}

function toggleNumber(number) {
  if (selectedNumbers.includes(number)) {
    selectedNumbers = selectedNumbers.filter((item) => item !== number);
  } else if (selectedNumbers.length < 5) {
    selectedNumbers = [...selectedNumbers, number].sort((a, b) => a - b);
  }

  renderNumbers();
}

function toggleEuroNumber(number) {
  if (selectedEuroNumbers.includes(number)) {
    selectedEuroNumbers = selectedEuroNumbers.filter((item) => item !== number);
  } else if (selectedEuroNumbers.length < 2) {
    selectedEuroNumbers = [...selectedEuroNumbers, number].sort((a, b) => a - b);
  }

  renderEuroNumbers();
  renderTicketStrip();
}

function generateQuickPick() {
  const pool = Array.from({ length: 50 }, (_, index) => index + 1);
  const euroPool = Array.from({ length: 12 }, (_, index) => index + 1);
  selectedNumbers = [];
  selectedEuroNumbers = [];

  while (selectedNumbers.length < 5) {
    const index = Math.floor(Math.random() * pool.length);
    selectedNumbers.push(pool.splice(index, 1)[0]);
  }

  while (selectedEuroNumbers.length < 2) {
    const index = Math.floor(Math.random() * euroPool.length);
    selectedEuroNumbers.push(euroPool.splice(index, 1)[0]);
  }

  selectedNumbers.sort((a, b) => a - b);
  selectedEuroNumbers.sort((a, b) => a - b);
  renderNumbers();
}

function saveCurrentTip() {
  const userId = Number(tipOwner.value);

  if (!userId || selectedNumbers.length !== 5 || selectedEuroNumbers.length !== 2) {
    return;
  }

  const owner = users.find((user) => user.id === userId);
  const nextTip = {
    userId,
    name: owner?.name || "Gast",
    numbers: [...selectedNumbers],
    euroNumbers: [...selectedEuroNumbers],
  };
  const existingIndex = userTips.findIndex((tip) => tip.userId === userId);

  if (existingIndex >= 0) {
    userTips = userTips.map((tip, index) => (index === existingIndex ? nextTip : tip));
  } else {
    userTips = [...userTips, nextTip];
  }

  saveState();
  renderTips();
}

function editTip(userId) {
  const tip = userTips.find((item) => item.userId === userId);

  if (!tip) {
    return;
  }

  selectedNumbers = [...tip.numbers];
  selectedEuroNumbers = [...tip.euroNumbers];
  tipOwner.value = String(userId);
  renderNumbers();
  document.querySelector("#ticket").scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatTip(numbers, euroNumbers, result) {
  const resultNumbers = new Set(result.numbers);
  const resultEuroNumbers = new Set(result.euroNumbers);
  const numberHtml = numbers
    .map((number) => {
      const hit = resultNumbers.has(number) ? " hit" : "";
      return `<span class="tip-number${hit}">${String(number).padStart(2, "0")}</span>`;
    })
    .join("");
  const euroHtml = euroNumbers
    .map((number) => {
      const hit = resultEuroNumbers.has(number) ? " hit" : "";
      return `<span class="tip-number euro${hit}">${String(number).padStart(2, "0")}</span>`;
    })
    .join("");

  return `${numberHtml}${euroHtml}`;
}

function getTipScore(tip, result) {
  const resultNumbers = new Set(result.numbers);
  const resultEuroNumbers = new Set(result.euroNumbers);
  const mainHits = tip.numbers.filter((number) => resultNumbers.has(number)).length;
  const euroHits = tip.euroNumbers.filter((number) => resultEuroNumbers.has(number)).length;

  return { mainHits, euroHits };
}

function localizeDrawDate(value) {
  return value
    .replace("Friday", "Freitag")
    .replace("Tuesday", "Dienstag")
    .replace("January", "Januar")
    .replace("February", "Februar")
    .replace("March", "Maerz")
    .replace("April", "April")
    .replace("May", "Mai")
    .replace("June", "Juni")
    .replace("July", "Juli")
    .replace("August", "August")
    .replace("September", "September")
    .replace("October", "Oktober")
    .replace("November", "November")
    .replace("December", "Dezember");
}

function renderResult(result) {
  jackpotValue.textContent = result.jackpot;
  jackpotMeta.textContent = `Stand: ${localizeDrawDate(result.drawDate)}`;
  resultDate.textContent = localizeDrawDate(result.drawDate);
  resultSource.textContent = result.source.includes("http") ? "Automatisch geladen" : result.source;

  resultStrip.innerHTML = [
    ...result.numbers.map((number) => `<span>${String(number).padStart(2, "0")}</span>`),
    ...result.euroNumbers.map((number) => `<span class="euro">${String(number).padStart(2, "0")}</span>`),
  ].join("");

  renderTips();
}

function renderTips() {
  tipsList.innerHTML = userTips
    .map((tip) => {
      const user = users.find((item) => item.id === tip.userId) || { name: tip.name || "Gast", active: true };
      const score = getTipScore(tip, latestResult);
      const status = `${score.mainHits} Richtige + ${score.euroHits} Eurozahlen`;

      return `
        <div class="tip-row">
          <span>
            <span class="member-name">${user.name}</span>
            <span class="member-meta">${user.active ? "aktiv" : "pausiert"}</span>
          </span>
          <span class="tip-numbers">${formatTip(tip.numbers, tip.euroNumbers, latestResult)}</span>
          <span class="tip-actions">
            <span class="tag ${score.mainHits + score.euroHits > 0 ? "" : "open"}">${status}</span>
            <button class="text-button" type="button" data-edit-tip="${tip.userId}">bearbeiten</button>
          </span>
        </div>
      `;
    })
    .join("");

  tipsStatus.textContent = `${userTips.length} Tipps mit aktuellen Zahlen verglichen`;
}

async function loadEurojackpotData() {
  try {
    const response = await fetch("/.netlify/functions/eurojackpot", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Function unavailable");
    }

    latestResult = await response.json();
  } catch (error) {
    latestResult = fallbackResult;
  }

  renderResult(latestResult);
}

function renderMembers() {
  memberList.innerHTML = members
    .map((member) => {
      const initials = member.name.slice(0, 2).toUpperCase();
      return `
        <div class="member-row">
          <span class="avatar">${initials}</span>
          <span>
            <span class="member-name">${member.name}</span>
            <span class="member-meta">${member.note}</span>
          </span>
          <span class="tag ${member.paid ? "" : "open"}">${member.paid ? "bezahlt" : "offen"}</span>
        </div>
      `;
    })
    .join("");
}

function renderPayments() {
  paymentTable.innerHTML = members
    .map((member) => {
      return `
        <div class="payment-row">
          <span class="payment-name">${member.name}</span>
          <span class="payment-meta">12,00 &euro;</span>
          <button class="tag ${member.paid ? "" : "open"}" type="button" data-payment-name="${member.name}">
            ${member.paid ? "eingegangen" : "ausstehend"}
          </button>
        </div>
      `;
    })
    .join("");
}

function renderUsers() {
  userList.innerHTML = users
    .map((user) => {
      return `
        <div class="user-row">
          <span>
            <span class="member-name">${user.name}</span>
            <span class="member-meta">${user.email}</span>
          </span>
          <span class="tag">${user.role}</span>
          <button class="text-button" type="button" data-user-id="${user.id}">
            ${user.active ? "deaktivieren" : "aktivieren"}
          </button>
        </div>
      `;
    })
    .join("");
}

function addUser(event) {
  event.preventDefault();

  users = [
    ...users,
    {
      id: Date.now(),
      name: userName.value.trim(),
      email: userEmail.value.trim(),
      role: "Mitglied",
      active: true,
    },
  ];

  members = [
    ...members,
    {
      name: userName.value.trim(),
      paid: false,
      note: "Neu",
    },
  ];

  userForm.reset();
  saveState();
  renderUsers();
  renderMembers();
  renderPayments();
  renderTipOwners();
  renderTips();
}

function toggleUser(userId) {
  users = users.map((user) => {
    if (user.id !== userId) {
      return user;
    }

    return { ...user, active: !user.active };
  });

  renderUsers();
  renderTipOwners();
  saveState();
  renderTips();
}

function togglePayment(name) {
  members = members.map((member) => {
    if (member.name !== name) {
      return member;
    }

    return { ...member, paid: !member.paid, note: member.paid ? "Offen" : "Erledigt" };
  });

  saveState();
  renderMembers();
  renderPayments();
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"));
    item.classList.add("active");
    document.querySelector(`#${item.dataset.section}`).scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

quickPickButton.addEventListener("click", generateQuickPick);
saveTipButton.addEventListener("click", saveCurrentTip);
tipsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-tip]");

  if (!button) {
    return;
  }

  editTip(Number(button.dataset.editTip));
});
userForm.addEventListener("submit", addUser);
userList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-user-id]");

  if (!button) {
    return;
  }

  toggleUser(Number(button.dataset.userId));
});
paymentTable.addEventListener("click", (event) => {
  const button = event.target.closest("[data-payment-name]");

  if (!button) {
    return;
  }

  togglePayment(button.dataset.paymentName);
});
drawButton.addEventListener("click", () => {
  drawButton.textContent = "Kein Gewinntreffer";
  setTimeout(() => {
    drawButton.textContent = "Gewinnzahlen prüfen";
  }, 1800);
});

async function initApp() {
  if (!currentIdentityUser) {
    return;
  }

  appIntervals.forEach((intervalId) => clearInterval(intervalId));
  appIntervals = [];

  await loadRemoteState();
  formatDate();
  updateCountdown();
  renderNumbers();
  renderMembers();
  renderPayments();
  renderUsers();
  renderTipOwners();
  loadEurojackpotData();
  appIntervals = [setInterval(updateCountdown, 60000), setInterval(loadEurojackpotData, 900000)];
}

loginButton.addEventListener("click", () => {
  window.netlifyIdentity?.open("login");
});

logoutButton.addEventListener("click", () => {
  window.netlifyIdentity?.logout();
});

currentIdentityUser = getIdentityUser();
initIdentity();
