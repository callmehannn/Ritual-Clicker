const saveKey = "ritual-clicker-state-v2";
const walletSavePrefix = `${saveKey}:wallet:`;
const supabaseUrl = "https://mtylbhyptcoeiquvsrzc.supabase.co";
const supabaseAnonKey = "sb_publishable_DnSluUiFZLIF-k176e7joA_NFhgwFZe";
const supabaseTable = "ritual_clicker_saves";
const supabaseClient = window.supabase?.createClient?.(supabaseUrl, supabaseAnonKey) || null;
let cloudSession = null;
let cloudSaveTimer = null;
let isLoadingCloudState = false;

const ritualNetwork = {
  chainId: "0x7bb",
  chainName: "Ritual Testnet",
  nativeCurrency: {
    name: "RITUAL",
    symbol: "RITUAL",
    decimals: 18,
  },
  rpcUrls: ["https://rpc.ritualfoundation.org/"],
  blockExplorerUrls: ["https://explorer.ritualfoundation.org"],
};

const upgrades = [
  {
    id: "candle",
    icon: "🪄",
    name: "Bitty",
    desc: "+1 essence per click",
    baseCost: 15,
    scale: 1.45,
    apply(state) {
      state.perClick += 1;
    },
  },
  {
    id: "chant",
    icon: "🕯️",
    name: "Ritty",
    desc: "+2 essence per second",
    baseCost: 50,
    scale: 1.55,
    apply(state) {
      state.perSecond += 2;
    },
  },
  {
    id: "relic",
    icon: "♨️",
    name: "Ritualist",
    desc: "+5 essence per click",
    baseCost: 160,
    scale: 1.62,
    apply(state) {
      state.perClick += 5;
    },
  },
  {
    id: "altar",
    icon: "🥇",
    name: "Radiant Ritualist",
    desc: "+11 essence per second",
    baseCost: 520,
    scale: 1.7,
    apply(state) {
      state.perSecond += 11;
    },
  },
  {
    id: "mirror",
    icon: "🌀",
    name: "Zealot",
    desc: "Invocation grants 35% more",
    baseCost: 1400,
    scale: 1.85,
    apply(state) {
      state.invokeBonus += 0.35;
    },
  },
];

const levels = [
  { level: 1, title: "Bitty", clicks: 0 },
  { level: 2, title: "Ritty", clicks: 100 },
  { level: 3, title: "Ritualist", clicks: 500 },
  { level: 4, title: "Radiant Ritualist", clicks: 2500 },
  { level: 5, title: "Zealot", clicks: 10000 },
];

const levelAuras = {
  Bitty: { aura: "#9eeeff", soft: "rgba(158, 238, 255, 0.5)" },
  Ritty: { aura: "#bd7cff", soft: "rgba(189, 124, 255, 0.5)" },
  Ritualist: { aura: "#40ffaf", soft: "rgba(64, 255, 175, 0.5)" },
  "Radiant Ritualist": { aura: "#ffd76a", soft: "rgba(255, 215, 106, 0.54)" },
  Zealot: { aura: "#5b1bb8", soft: "rgba(91, 27, 184, 0.58)" },
};

const achievements = [
  { id: "first-gritual", name: "First gRitual", requirement: "First click", isUnlocked: (state) => state.totalClicks >= 1 },
  { id: "tiny-cultist", name: "Tiny Cultist", requirement: "50 clicks", isUnlocked: (state) => state.totalClicks >= 50 },
  { id: "bitty-energy", name: "Bitty Energy", requirement: "Become Bitty", isUnlocked: () => hasReachedTitle("Bitty") },
  { id: "ritual-beginner", name: "Ritual Beginner", requirement: "100 clicks", isUnlocked: (state) => state.totalClicks >= 100 },
  { id: "finger-destroyer", name: "Finger Destroyer", requirement: "500 clicks", isUnlocked: (state) => state.totalClicks >= 500 },
  { id: "ritty-certified", name: "Ritty Certified", requirement: "Become Ritty", isUnlocked: () => hasReachedTitle("Ritty") },
  { id: "sleep-temporary", name: "Sleep Is Temporary", requirement: "1,000 clicks", isUnlocked: (state) => state.totalClicks >= 1000 },
  { id: "ritual-maxxing", name: "Ritual Maxxing", requirement: "2,500 clicks", isUnlocked: (state) => state.totalClicks >= 2500 },
  { id: "infinite-grindset", name: "Infinite Grindset", requirement: "5,000 clicks", isUnlocked: (state) => state.totalClicks >= 5000 },
  { id: "radiant-one", name: "Radiant One", requirement: "Become Radiant Ritualist", isUnlocked: () => hasReachedTitle("Radiant Ritualist") },
  { id: "touch-grass", name: "Touch Grass", requirement: "Play 1 hour", isUnlocked: (state) => state.playSeconds >= 3600 },
  { id: "not-addicted", name: "Not Addicted btw", requirement: "Open the game 3 days", isUnlocked: (state) => state.openedDays.length >= 3 },
  { id: "ritual-never-ends", name: "Ritual Never Ends", requirement: "10,000 clicks", isUnlocked: (state) => state.totalClicks >= 10000 },
  { id: "zealot-awakening", name: "Zealot Awakening", requirement: "Become Zealot", isUnlocked: () => hasReachedTitle("Zealot") },
  { id: "gpu-melter", name: "GPU Melter", requirement: "100 income/sec", isUnlocked: (state) => state.perSecond >= 100 },
  { id: "ritual-testnet-ready", name: "Ritual Testnet Ready", requirement: "Connect Ritual Testnet", isUnlocked: (state) => state.ritualTestnetConnected },
  { id: "beyond-human", name: "Beyond Human", requirement: "100,000 clicks", isUnlocked: (state) => state.totalClicks >= 100000 },
];

const milestones = [
  { at: 100, text: "The chalk lines begin to glow softly." },
  { at: 500, text: "The air thickens, as if the room is holding its breath." },
  { at: 2000, text: "The ritual circle now recognizes your name." },
  { at: 7500, text: "The altar shadow moves faster than the light." },
  { at: 25000, text: "The Invocation becomes a low thunder behind the wall." },
];

const state = loadState();
trackOpenDay();

const nodes = {
  essence: document.querySelector("#essence"),
  perClick: document.querySelector("#perClick"),
  perSecond: document.querySelector("#perSecond"),
  currentLevelTitle: document.querySelector("#currentLevelTitle"),
  totalClicks: document.querySelector("#totalClicks"),
  levelProgressFill: document.querySelector("#levelProgressFill"),
  levelProgressStart: document.querySelector("#levelProgressStart"),
  levelProgressEnd: document.querySelector("#levelProgressEnd"),
  focusText: document.querySelector("#focusText"),
  focusFill: document.querySelector("#focusFill"),
  sigilButton: document.querySelector("#sigilButton"),
  invokeButton: document.querySelector("#invokeButton"),
  resetButton: document.querySelector("#resetButton"),
  accountOptions: document.querySelector("#accountOptions"),
  accountStatus: document.querySelector("#accountStatus"),
  xLoginButton: document.querySelector("#xLoginButton"),
  metaMaskButton: document.querySelector("#metaMaskButton"),
  ritualTestnetButton: document.querySelector("#ritualTestnetButton"),
  logoutButton: document.querySelector("#logoutButton"),
  dailyStatus: document.querySelector("#dailyStatus"),
  dailyMonth: document.querySelector("#dailyMonth"),
  dailyDay: document.querySelector("#dailyDay"),
  dailyWeekday: document.querySelector("#dailyWeekday"),
  dailyWeek: document.querySelector("#dailyWeek"),
  dailyStreak: document.querySelector("#dailyStreak"),
  dailyReward: document.querySelector("#dailyReward"),
  dailyClaimButton: document.querySelector("#dailyClaimButton"),
  shopList: document.querySelector("#shopList"),
  statusText: document.querySelector("#statusText"),
  achievementsList: document.querySelector("#achievementsList"),
  achievementCount: document.querySelector("#achievementCount"),
  leaderboardList: document.querySelector("#leaderboardList"),
  playerRank: document.querySelector("#playerRank"),
  template: document.querySelector("#upgradeTemplate"),
  mobileNavButtons: document.querySelectorAll("[data-tab-target]"),
  mobileTabPanels: document.querySelectorAll("[data-tab-panel]"),
};

renderShop();
render();
initializeCloudSession();
setInterval(tick, 1000);
setInterval(saveState, 5000);

nodes.sigilButton.addEventListener("click", (event) => {
  const gain = Math.ceil(state.perClick * state.multiplier);
  state.totalClicks += 1;
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

if (nodes.resetButton) {
  nodes.resetButton.addEventListener("click", () => {
    const ok = window.confirm("Reset the ritual circle from the beginning?");
    if (!ok) return;
    try {
      localStorage.removeItem(saveKey);
    } catch {}
    Object.assign(state, defaultState());
    renderShop();
    render();
  });
}

if (nodes.xLoginButton) {
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
}

nodes.metaMaskButton.addEventListener("click", () => connectWallet({ mode: "metamask" }));

nodes.ritualTestnetButton.addEventListener("click", () => connectWallet({ mode: "ritual" }));

nodes.logoutButton.addEventListener("click", async () => {
  if (supabaseClient) {
    await supabaseClient.auth.signOut({ scope: "local" });
  }
  cloudSession = null;
  state.account = null;
  addLog("Account disconnected.");
  render();
});

if (window.ethereum?.on) {
  window.ethereum.on("accountsChanged", async (accounts) => {
    const address = accounts?.[0];
    if (!address) {
      if (supabaseClient) {
        await supabaseClient.auth.signOut({ scope: "local" });
      }
      cloudSession = null;
      state.account = null;
      render();
      return;
    }

    nodes.accountStatus.textContent = "Wallet changed. Connect again to sync.";
    state.account = null;
    saveState();
    renderAccount();
  });
}

nodes.dailyClaimButton.addEventListener("click", () => {
  if (hasClaimedDailyToday()) return;

  const today = getDateKey();
  const yesterday = getDateKey(-1);
  const nextStreak = state.dailyLastClaimDate === yesterday ? state.dailyStreak + 1 : 1;
  const reward = getDailyReward(nextStreak);

  state.dailyLastClaimDate = today;
  state.dailyStreak = nextStreak;
  state.essence += reward;
  state.totalEarned += reward;
  addLog(`Daily Login claimed. Essence +${format(reward)}.`);
  render();
});

nodes.mobileNavButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setMobileTab(button.dataset.tabTarget);
    document.querySelector(".shop-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

function tick() {
  state.playSeconds += 1;

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
    const icon = clone.querySelector(".upgrade-icon");
    icon.textContent = upgrade.icon;
    icon.classList.add(`upgrade-icon-${upgrade.id}`);
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
  renderLevelProgress();
  nodes.focusText.textContent = `${Math.floor(state.focus)}%`;
  nodes.focusFill.style.width = `${state.focus}%`;
  nodes.invokeButton.disabled = state.focus < 100;
  nodes.statusText.textContent = getStatusText();
  renderAccount();
  renderDailyLogin();
  checkAchievements();
  renderAchievements();
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
    if (nodes.xLoginButton) nodes.xLoginButton.hidden = false;
    nodes.metaMaskButton.hidden = false;
    nodes.ritualTestnetButton.hidden = false;
    nodes.logoutButton.hidden = true;
    return;
  }

  const provider = state.account.type === "metamask" ? "MetaMask" : state.account.type === "ritual" ? "Ritual Testnet" : "X";
  nodes.accountStatus.textContent = `${provider}: ${state.account.label}`;
  if (nodes.xLoginButton) nodes.xLoginButton.hidden = true;
  nodes.metaMaskButton.hidden = true;
  nodes.ritualTestnetButton.hidden = true;
  nodes.logoutButton.hidden = false;
}

async function connectWallet({ mode }) {
  if (!window.ethereum) {
    nodes.accountStatus.textContent = "MetaMask not detected";
    addLog("MetaMask was not detected. Progress is still saved on this browser.");
    saveState();
    return;
  }

  setWalletBusy(true, mode === "ritual" ? "Adding Ritual..." : "Connecting...");

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const address = accounts?.[0];
    if (!address) throw new Error("No wallet address returned.");

    if (mode === "ritual") {
      await switchOrAddRitualTestnet();
      state.ritualTestnetConnected = true;
    }

    await signInAndSyncWallet(address, mode);
    addLog(`${mode === "ritual" ? "Ritual Testnet" : "MetaMask"} synced: ${shortenAddress(address)}.`);
    render();
  } catch (error) {
    const message = getWalletErrorMessage(error, mode);
    nodes.accountStatus.textContent = message;
    addLog(`${message} Progress is still saved locally.`);
    saveState();
  } finally {
    setWalletBusy(false);
  }
}

async function signInAndSyncWallet(address, mode) {
  attachWalletAccount(address, mode);

  if (!supabaseClient) {
    nodes.accountStatus.textContent = "Wallet connected. Cloud sync unavailable.";
    return;
  }

  nodes.accountStatus.textContent = "Sign to sync progress...";
  const { data, error } = await supabaseClient.auth.signInWithWeb3({
    chain: "ethereum",
    statement: "Sign in to Ritual Clicker to sync your progress across devices.",
  });

  if (error) throw error;

  cloudSession = data.session;
  await syncCloudProgress(address, mode);
}

function attachWalletAccount(address, mode) {
  const account = {
    type: mode,
    label: shortenAddress(address),
    address,
  };
  const walletState = loadStateFromKey(getWalletSaveKey(address));

  if (walletState && !hasMeaningfulProgress(state)) {
    Object.assign(state, {
      ...walletState,
      account,
      ritualTestnetConnected: mode === "ritual" || walletState.ritualTestnetConnected,
    });
  } else {
    state.account = account;
  }

  saveState();
}

function setWalletBusy(isBusy, label = "") {
  nodes.metaMaskButton.disabled = isBusy;
  nodes.ritualTestnetButton.disabled = isBusy;
  if (label) nodes.accountStatus.textContent = label;
}

function getWalletErrorMessage(error, mode) {
  if (error?.code === 4001) return `${mode === "ritual" ? "Ritual Testnet" : "Wallet"} connection cancelled`;
  if (error?.code === -32002) return "Open MetaMask to finish the pending request";
  if (`${error?.message || ""}`.toLowerCase().includes("provider")) return "Enable Web3 provider in Supabase";
  if (`${error?.message || ""}`.toLowerCase().includes("redirect")) return "Add your Vercel URL to Supabase redirects";
  if (mode === "ritual") return "Could not add Ritual Testnet";
  return "Could not connect wallet";
}

async function initializeCloudSession() {
  if (!supabaseClient) return;

  try {
    const { data } = await supabaseClient.auth.getSession();
    cloudSession = data.session;
    if (!cloudSession) return;

    const address = state.account?.address || getSessionWalletAddress(cloudSession);
    if (!address) return;

    attachWalletAccount(address, state.account?.type || "metamask");
    await syncCloudProgress(address, state.account?.type || "metamask");
    render();
  } catch (error) {
    console.warn("Cloud session restore failed", error);
  }
}

async function syncCloudProgress(address, mode) {
  if (!supabaseClient || !cloudSession?.user?.id || isLoadingCloudState) return;

  isLoadingCloudState = true;
  try {
    const { data, error } = await supabaseClient
      .from(supabaseTable)
      .select("progress, wallet_address, updated_at")
      .eq("user_id", cloudSession.user.id)
      .maybeSingle();

    if (error) throw error;

    const remoteState = normalizeState(data?.progress);
    const account = {
      type: mode,
      label: shortenAddress(address),
      address,
    };

    if (remoteState && shouldUseRemoteState(remoteState, state)) {
      Object.assign(state, {
        ...remoteState,
        account,
        ritualTestnetConnected: mode === "ritual" || remoteState.ritualTestnetConnected,
      });
      saveState();
    } else {
      state.account = account;
      await saveCloudState({ force: true });
    }
  } catch (error) {
    console.warn("Cloud sync failed", error);
    nodes.accountStatus.textContent = "Wallet connected. Cloud table not ready.";
  } finally {
    isLoadingCloudState = false;
  }
}

function shouldUseRemoteState(remoteState, localState) {
  if (!hasMeaningfulProgress(localState)) return true;
  return (remoteState.totalEarned || 0) > (localState.totalEarned || 0);
}

async function saveCloudState({ force = false } = {}) {
  if (!supabaseClient || !cloudSession?.user?.id || !state.account?.address || isLoadingCloudState) return;

  if (!force) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => saveCloudState({ force: true }), 1300);
    return;
  }

  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = null;

  const { error } = await supabaseClient.from(supabaseTable).upsert(
    {
      user_id: cloudSession.user.id,
      wallet_address: state.account.address.toLowerCase(),
      progress: createPortableState(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.warn("Cloud save failed", error);
    nodes.accountStatus.textContent = "Wallet connected. Cloud save failed.";
  }
}

function createPortableState() {
  return {
    ...state,
    log: [],
  };
}

function getSessionWalletAddress(session) {
  const identities = session?.user?.identities || [];
  const identityData = identities.find((identity) => identity.provider === "web3")?.identity_data || identities[0]?.identity_data;
  return identityData?.sub || identityData?.wallet_address || identityData?.address || null;
}

function renderDailyLogin() {
  const today = getDateKey();
  const claimed = hasClaimedDailyToday();
  const nextStreak = claimed ? state.dailyStreak : state.dailyLastClaimDate === getDateKey(-1) ? state.dailyStreak + 1 : 1;
  const reward = getDailyReward(nextStreak);
  const todayDate = new Date();

  nodes.dailyStatus.textContent = claimed ? "Claimed" : "Ready";
  nodes.dailyMonth.textContent = new Intl.DateTimeFormat("en-US", { month: "short" }).format(todayDate);
  nodes.dailyDay.textContent = String(todayDate.getDate());
  nodes.dailyWeekday.textContent = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(todayDate);
  nodes.dailyWeek.innerHTML = getWeekDays(todayDate)
    .map((date) => `<span class="${date.toDateString() === todayDate.toDateString() ? "is-today" : ""}">${date.getDate()}</span>`)
    .join("");
  nodes.dailyStreak.textContent = `${state.dailyStreak} day${state.dailyStreak === 1 ? "" : "s"}`;
  nodes.dailyReward.textContent = `${format(reward)} essence`;
  nodes.dailyClaimButton.disabled = claimed;
  nodes.dailyClaimButton.textContent = claimed ? "Come Back Tomorrow" : "Claim Daily Essence";
}

function hasClaimedDailyToday() {
  return state.dailyLastClaimDate === getDateKey();
}

function getDailyReward(streak) {
  return Math.min(500, 250 + Math.max(0, streak - 1) * 50);
}

async function switchOrAddRitualTestnet() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ritualNetwork.chainId }],
    });
  } catch (error) {
    if (!isUnknownChainError(error)) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [ritualNetwork],
    });
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ritualNetwork.chainId }],
    });
  }
}

function isUnknownChainError(error) {
  return error?.code === 4902 || error?.data?.originalError?.code === 4902 || `${error?.message || ""}`.includes("Unrecognized chain ID");
}

function renderLeaderboard() {
  const currentPlayer = getCurrentPlayer();
  const leaderboard = [
    { name: currentPlayer, score: state.totalEarned, active: true },
    { name: "Zealot Prime", score: 25000 },
    { name: "Radiant Oracle", score: 12000 },
    { name: "Ritualist Zero", score: 4800 },
    { name: "Ritty Spark", score: 1600 },
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

function setMobileTab(target) {
  nodes.mobileNavButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tabTarget === target);
  });
  nodes.mobileTabPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.tabPanel === target);
  });
}

function checkAchievements() {
  achievements.forEach((achievement) => {
    if (state.achievements[achievement.id]) return;
    if (achievement.isUnlocked(state)) {
      state.achievements[achievement.id] = Date.now();
    }
  });
}

function renderAchievements() {
  const unlockedCount = achievements.filter((achievement) => state.achievements[achievement.id]).length;
  nodes.achievementCount.textContent = `${unlockedCount}/${achievements.length}`;
  nodes.achievementsList.innerHTML = achievements
    .map((achievement) => {
      const unlocked = Boolean(state.achievements[achievement.id]);
      return `
        <li class="${unlocked ? "is-unlocked" : ""}">
          <span class="achievement-name">${achievement.name}</span>
          <span class="achievement-req">${achievement.requirement}</span>
        </li>
      `;
    })
    .join("");
}

function getCurrentPlayer() {
  const name = state.account ? state.account.label : "Anonymous";
  return `${name} Â· ${getCurrentLevel().title}`;
}

function renderLevelProgress() {
  const currentLevel = getCurrentLevel();
  const nextLevel = getNextLevel();
  const aura = levelAuras[currentLevel.title] || levelAuras.Bitty;
  const start = currentLevel.clicks;
  const end = nextLevel ? nextLevel.clicks : currentLevel.clicks;
  const range = Math.max(1, end - start);
  const progress = nextLevel ? Math.min(100, ((state.totalClicks - start) / range) * 100) : 100;
  const labelProgress = Math.min(96, Math.max(4, progress));

  nodes.currentLevelTitle.textContent = currentLevel.title;
  nodes.sigilButton.style.setProperty("--aura", aura.aura);
  nodes.sigilButton.style.setProperty("--aura-soft", aura.soft);
  nodes.levelProgressFill.style.width = `${progress}%`;
  nodes.totalClicks.parentElement.style.setProperty("--level-progress", `${labelProgress}%`);
  nodes.levelProgressStart.textContent = format(start);
  nodes.levelProgressEnd.textContent = nextLevel ? format(end) : "Max";
  nodes.totalClicks.textContent = format(state.totalClicks);
}

function getCurrentLevel() {
  return levels.reduce((current, level) => {
    if (state.totalClicks >= level.clicks) return level;
    return current;
  }, levels[0]);
}

function getNextLevel() {
  return levels.find((level) => level.clicks > state.totalClicks);
}

function hasReachedTitle(title) {
  const target = levels.find((level) => level.title === title);
  return Boolean(target && state.totalClicks >= target.clicks);
}

function trackOpenDay() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (!state.openedDays.includes(today)) {
    state.openedDays.push(today);
  }
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

function getDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getWeekDays(date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function defaultState() {
  return {
    essence: 0,
    totalEarned: 0,
    totalClicks: 0,
    perClick: 1,
    perSecond: 0,
    focus: 0,
    multiplier: 1,
    multiplierEndsAt: 0,
    invokeBonus: 1,
    account: null,
    owned: {},
    milestones: [],
    achievements: {},
    playSeconds: 0,
    openedDays: [],
    dailyLastClaimDate: "",
    dailyStreak: 0,
    ritualTestnetConnected: false,
    log: [],
  };
}

function loadState() {
  return loadStateFromKey(saveKey) || defaultState();
}

function loadStateFromKey(key) {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(key)));
  } catch {
    return null;
  }
}

function normalizeState(saved) {
  const base = defaultState();
  if (!saved || typeof saved !== "object") return null;

  return {
    ...base,
    ...saved,
    owned: { ...base.owned, ...saved.owned },
    achievements: { ...base.achievements, ...saved.achievements },
    milestones: Array.isArray(saved.milestones) ? saved.milestones : base.milestones,
    openedDays: Array.isArray(saved.openedDays) ? saved.openedDays : base.openedDays,
    dailyLastClaimDate: typeof saved.dailyLastClaimDate === "string" ? saved.dailyLastClaimDate : base.dailyLastClaimDate,
    dailyStreak: Number.isFinite(saved.dailyStreak) ? saved.dailyStreak : base.dailyStreak,
  };
}

function saveState() {
  try {
    localStorage.setItem(saveKey, JSON.stringify(state));
    if (state.account?.address) {
      localStorage.setItem(getWalletSaveKey(state.account.address), JSON.stringify(state));
    }
    saveCloudState();
  } catch {
    // File previews can block storage; gameplay should still work.
  }
}

function getWalletSaveKey(address) {
  return `${walletSavePrefix}${address.toLowerCase()}`;
}

function hasMeaningfulProgress(currentState) {
  return (
    currentState.totalClicks > 0 ||
    currentState.totalEarned > 0 ||
    currentState.essence > 0 ||
    currentState.playSeconds > 10 ||
    Object.keys(currentState.owned || {}).length > 0
  );
}

