const saveKey = "ritual-clicker-state-v2";

const upgrades = [
  {
    id: "candle",
    icon: "♨",
    name: "Ember Candle",
    desc: "+1 essence per click",
    baseCost: 15,
    scale: 1.45,
    apply(state) {
      state.perClick += 1;
    },
  },
  {
    id: "chant",
    icon: "◌",
    name: "Chant Circle",
    desc: "+2 essence per second",
    baseCost: 50,
    scale: 1.55,
    apply(state) {
      state.perSecond += 2;
    },
  },
  {
    id: "relic",
    icon: "✧",
    name: "Dusk Relic",
    desc: "+5 essence per click",
    baseCost: 160,
    scale: 1.62,
    apply(state) {
      state.perClick += 5;
    },
  },
  {
    id: "altar",
    icon: "▣",
    name: "Moss Altar",
    desc: "+11 essence per second",
    baseCost: 520,
    scale: 1.7,
    apply(state) {
      state.perSecond += 11;
    },
  },
  {
    id: "mirror",
    icon: "◇",
    name: "Cracked Mirror",
    desc: "Invocation grants 35% more",
    baseCost: 1400,
    scale: 1.85,
    apply(state) {
      state.invokeBonus += 0.35;
    },
  },
];

const milestones = [
  { at: 100, text: "The chalk lines begin to glow softly." },
  { at: 500, text: "The air thickens, as if the room is holding its breath." },
  { at: 2000, text: "The ritual circle now recognizes your name." },
  { at: 7500, text: "The altar shadow moves faster than the light." },
  { at: 25000, text: "The Invocation becomes a low thunder behind the wall." },
];

const state = loadState();

const nodes = {
  essence: document.querySelector("#essence"),
  perClick: document.querySelector("#perClick"),
  perSecond: document.querySelector("#perSecond"),
  focusText: document.querySelector("#focusText"),
  focusFill: document.querySelector("#focusFill"),
  sigilButton: document.querySelector("#sigilButton"),
  invokeButton: document.querySelector("#invokeButton"),
  resetButton: document.querySelector("#resetButton"),
  accountStatus: document.querySelector("#accountStatus"),
  xLoginButton: document.querySelector("#xLoginButton"),
  metaMaskButton: document.querySelector("#metaMaskButton"),
  logoutButton: document.querySelector("#logoutButton"),
  shopList: document.querySelector("#shopList"),
  statusText: document.querySelector("#statusText"),
  leaderboardList: document.querySelector("#leaderboardList"),
  playerRank: document.querySelector("#playerRank"),
  template: document.querySelector("#upgradeTemplate"),
};

renderShop();
render();
setInterval(tick, 1000);
setInterval(saveState, 5000);

nodes.sigilButton.addEventListener("click", (event) => {
  const gain = Math.ceil(state.perClick * state.multiplier);
  state.essence += gain;
  state.totalEarned += gain;
  state.focus = Math.min(100, state.focus + 3 + state.perClick * 0.05);
  popText(event.clientX, event.clientY, `+${format(gain)}`);
  nodes.sigilButton.classList.add("clicked");
  setTimeout(() => nodes.sigilButton.classList.remove("clicked"), 120);
  checkMilestones();
  render();
});

nodes.invokeButton.addEventListener("click", () => {
  if (state.focus < 100) return;
  const reward = Math.ceil((state.perClick * 25 + state.perSecond * 12 + 75) * state.invokeBonus);
  state.essence += reward;
  state.totalEarned += reward;
  state.focus = 0;
  state.multiplier = 2;
  state.multiplierEndsAt = Date.now() + 15000;
  addLog(`Invocation completed. Essence surges +${format(reward)}.`);
  render();
});

nodes.resetButton.addEventListener("click", () => {
  const ok = window.confirm("Reset the ritual circle from the beginning?");
  if (!ok) return;
  localStorage.removeItem(saveKey);
  Object.assign(state, defaultState());
  renderShop();
  render();
});

nodes.xLoginButton.addEventListener("click", () => {
  const handle = window.prompt("Enter your X username for this demo login:");
  if (!handle) return;

  const cleanHandle = handle.trim().replace(/^@/, "");
  if (!cleanHandle) return;

  state.account = {
    type: "x",
    label: `@${cleanHandle}`,
  };
  addLog(`Logged in with X as @${cleanHandle}.`);
  render();
});

nodes.metaMaskButton.addEventListener("click", async () => {
  if (!window.ethereum) {
    addLog("MetaMask was not detected in this browser.");
    nodes.accountStatus.textContent = "MetaMask not detected";
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const address = accounts[0];
    if (!address) return;

    state.account = {
      type: "metamask",
      label: shortenAddress(address),
      address,
    };
    addLog(`MetaMask connected: ${shortenAddress(address)}.`);
    render();
  } catch {
    addLog("MetaMask connection was cancelled.");
    render();
  }
});

nodes.logoutButton.addEventListener("click", () => {
  state.account = null;
  addLog("Account disconnected.");
  render();
});

function tick() {
  if (Date.now() > state.multiplierEndsAt) {
    state.multiplier = 1;
  }

  const gain = Math.ceil(state.perSecond * state.multiplier);
  if (gain > 0) {
    state.essence += gain;
    state.totalEarned += gain;
    state.focus = Math.min(100, state.focus + 0.8 + state.perSecond * 0.01);
    checkMilestones();
  }

  render();
}

function renderShop() {
  nodes.shopList.innerHTML = "";

  upgrades.forEach((upgrade) => {
    const clone = nodes.template.content.firstElementChild.cloneNode(true);
    clone.dataset.id = upgrade.id;
    clone.querySelector(".upgrade-icon").textContent = upgrade.icon;
    clone.querySelector(".upgrade-name").textContent = upgrade.name;
    clone.querySelector(".upgrade-desc").textContent = upgrade.desc;
    clone.addEventListener("click", () => buyUpgrade(upgrade.id));
    nodes.shopList.appendChild(clone);
  });
}

function render() {
  nodes.essence.textContent = format(state.essence);
  nodes.perClick.textContent = format(Math.ceil(state.perClick * state.multiplier));
  nodes.perSecond.textContent = format(Math.ceil(state.perSecond * state.multiplier));
  nodes.focusText.textContent = `${Math.floor(state.focus)}%`;
  nodes.focusFill.style.width = `${state.focus}%`;
  nodes.invokeButton.disabled = state.focus < 100;
  nodes.statusText.textContent = getStatusText();
  renderAccount();
  renderLeaderboard();

  document.querySelectorAll(".upgrade-card").forEach((card) => {
    const upgrade = upgrades.find((item) => item.id === card.dataset.id);
    const owned = state.owned[upgrade.id] || 0;
    const cost = getCost(upgrade);
    card.disabled = state.essence < cost;
    card.querySelector(".upgrade-meta").textContent = `Owned ${owned}`;
    card.querySelector(".upgrade-cost").textContent = format(cost);
  });

  saveState();
}

function buyUpgrade(id) {
  const upgrade = upgrades.find((item) => item.id === id);
  const cost = getCost(upgrade);
  if (state.essence < cost) return;

  state.essence -= cost;
  state.owned[id] = (state.owned[id] || 0) + 1;
  upgrade.apply(state);
  addLog(`${upgrade.name} joined the circle.`);
  render();
}

function getCost(upgrade) {
  const owned = state.owned[upgrade.id] || 0;
  return Math.floor(upgrade.baseCost * upgrade.scale ** owned);
}

function getStatusText() {
  if (state.multiplier > 1) return "Invocation active: all gains are doubled for a short time.";
  if (state.focus >= 100) return "Focus is full. The Invocation is ready.";
  if (state.perSecond > 0) return "The chants are working on their own. The sigil still hungers.";
  return "Tap the sigil to start the circle.";
}

function renderAccount() {
  if (!state.account) {
    nodes.accountStatus.textContent = "Not connected";
    nodes.xLoginButton.hidden = false;
    nodes.metaMaskButton.hidden = false;
    nodes.logoutButton.hidden = true;
    return;
  }

  const provider = state.account.type === "metamask" ? "MetaMask" : "X";
  nodes.accountStatus.textContent = `${provider}: ${state.account.label}`;
  nodes.xLoginButton.hidden = true;
  nodes.metaMaskButton.hidden = true;
  nodes.logoutButton.hidden = false;
}

function renderLeaderboard() {
  const currentPlayer = getCurrentPlayer();
  const leaderboard = [
    { name: currentPlayer, score: state.totalEarned, active: true },
    { name: "Acolyte Zero", score: 25000 },
    { name: "Green Warden", score: 12000 },
    { name: "Null Oracle", score: 4800 },
    { name: "Chain Mystic", score: 1600 },
  ].sort((left, right) => right.score - left.score);

  const playerIndex = leaderboard.findIndex((entry) => entry.active);
  nodes.playerRank.textContent = `Rank #${playerIndex + 1}`;
  nodes.leaderboardList.innerHTML = leaderboard
    .slice(0, 5)
    .map(
      (entry) => `
        <li class="${entry.active ? "is-player" : ""}">
          <span class="leader-name">${entry.name}</span>
          <strong>${format(entry.score)}</strong>
        </li>
      `,
    )
    .join("");
}

function getCurrentPlayer() {
  if (state.account) return state.account.label;
  return "Anonymous Ritualist";
}

function checkMilestones() {
  milestones.forEach((milestone) => {
    if (state.totalEarned >= milestone.at && !state.milestones.includes(milestone.at)) {
      state.milestones.push(milestone.at);
      addLog(milestone.text);
    }
  });
}

function addLog(text) {
  state.log.push(text);
  state.log = state.log.slice(-18);
}

function popText(x, y, text) {
  const node = document.createElement("span");
  node.className = "float-text";
  node.textContent = text;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 800);
}

function format(value) {
  const number = Math.floor(value);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return String(number);
}

function shortenAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function defaultState() {
  return {
    essence: 0,
    totalEarned: 0,
    perClick: 1,
    perSecond: 0,
    focus: 0,
    multiplier: 1,
    multiplierEndsAt: 0,
    invokeBonus: 1,
    account: null,
    owned: {},
    milestones: [],
    log: [],
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(saveKey));
    return { ...defaultState(), ...saved };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(saveKey, JSON.stringify(state));
}
