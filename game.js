
const supabaseUrl = "https://mtylbhyptcoeiquvsrzc.supabase.co";
const supabaseAnonKey = "sb_publishable_DnSluUiFZLIF-k176e7joA_NFhgwFZe";
const supabaseTable = "ritual_clicker_saves";
const legacySaveKey = "ritual-clicker-state-v2";
const walletConnectProjectId = "71bea141c12e2b6160ce94e7a89924ce";
const dailyRitualContractAddress = "0x98c49CC264Cc8460144500F305231f92a5542128";
const ritualScoreContractAddress = "0x55d5C4B9f92e956a10665f143c561B0F10c881d5";
const ritualAchievementsContractAddress = "0x989bb911bF43679037a277b403291612BA8eecAB";
const ritualInvocationContractAddress = "0x841D0428871858a4065e73BB866301d1Dd559DCe";
const ritualDailyQuestContractAddress = "0xF6f3A1F41744E91b2eB0c1b37021E5D3D99Beab7";
const dailyRitualAbi = [
  "function previewClaim(address player) view returns (bool canClaim, uint256 reward, uint256 nextStreak, uint256 today)",
  "function claimDaily() returns (uint256 reward, uint256 streak)",
  "function getPlayer(address player) view returns (uint256 lastClaimDay, uint256 streak, uint256 totalClaimed)",
];
const ritualScoreAbi = [
  "function submitScore(uint256 totalEarned, uint256 totalClicks) returns (bool improved)",
  "function getScore(address player) view returns (uint256 bestEssence, uint256 bestClicks, uint256 submittedAt)",
];
const ritualAchievementsAbi = [
  "function claimAchievement(string achievementId) returns (bool claimedNow)",
  "function hasClaimed(address player, string achievementId) view returns (bool)",
];
const ritualInvocationAbi = [
  "function invokeRite(uint256 reward, uint256 totalClicks, uint256 totalEarned) returns (uint256 count)",
  "function getInvocation(address player) view returns (uint256 count, uint256 totalReward, uint256 lastReward, uint256 lastTotalClicks, uint256 lastTotalEarned, uint256 lastInvokedAt)",
];
const ritualDailyQuestAbi = [
  "function claimQuest(uint256 day, string questType, uint256 reward) returns (bool claimedNow)",
  "function hasClaimed(address player, uint256 day) view returns (bool)",
  "function getClaim(address player) view returns (uint256 day, string questType, uint256 reward, uint256 totalReward, uint256 claimedAt)",
];
const supabaseClient = window.supabase?.createClient?.(supabaseUrl, supabaseAnonKey) || null;
let cloudSession = null;
let cloudSaveTimer = null;
let isLoadingCloudState = false;
let walletConnectProvider = null;
let cloudLeaderboard = [];
let shareAvatarDataUrl = "";
let shareXAvatarDataUrl = "";
let shareXProfileHandle = "";
let shareXProfileName = "";
let shareProfileLookupTimer = 0;
const comboRuntime = {
  count: 0,
  lastClickAt: 0,
  resetTimer: 0,
};

const comboWindowMs = 950;
const comboCap = 20;
const comboStepBonus = 0.05;
const critChance = 0.07;
const critMultiplier = 3;

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
    icon: "🔥",
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
    icon: "▰",
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
    desc: "2x Boost reward grants 35% more",
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
  { id: "ritualist-certified", name: "Ritualist Certified", requirement: "Become Ritualist", isUnlocked: () => hasReachedTitle("Ritualist") },
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
  { at: 25000, text: "The 2x Boost becomes a low thunder behind the wall." },
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
  dailyQuestStatus: document.querySelector("#dailyQuestStatus"),
  dailyQuestTitle: document.querySelector("#dailyQuestTitle"),
  dailyQuestObjective: document.querySelector("#dailyQuestObjective"),
  dailyQuestReward: document.querySelector("#dailyQuestReward"),
  dailyQuestFill: document.querySelector("#dailyQuestFill"),
  dailyQuestClaimButton: document.querySelector("#dailyQuestClaimButton"),
  shopList: document.querySelector("#shopList"),
  statusText: document.querySelector("#statusText"),
  achievementsList: document.querySelector("#achievementsList"),
  achievementCount: document.querySelector("#achievementCount"),
  leaderboardList: document.querySelector("#leaderboardList"),
  leaderboardPlayerRank: document.querySelector("#leaderboardPlayerRank"),
  playerRank: document.querySelector("#playerRank"),
  submitScoreButton: document.querySelector("#submitScoreButton"),
  submitScoreStatus: document.querySelector("#submitScoreStatus"),
  shareButton: document.querySelector("#shareButton"),
  shareModal: document.querySelector("#shareModal"),
  closeShareButton: document.querySelector("#closeShareButton"),
  shareUsername: document.querySelector("#shareUsername"),
  shareProfileStatus: document.querySelector("#shareProfileStatus"),
  shareAvatarInput: document.querySelector("#shareAvatarInput"),
  shareAvatar: document.querySelector("#shareAvatar"),
  shareRank: document.querySelector("#shareRank"),
  shareName: document.querySelector("#shareName"),
  shareEssence: document.querySelector("#shareEssence"),
  shareEarned: document.querySelector("#shareEarned"),
  shareClicks: document.querySelector("#shareClicks"),
  shareIncome: document.querySelector("#shareIncome"),
  shareAchievements: document.querySelector("#shareAchievements"),
  shareCard: document.querySelector("#shareCard"),
  downloadShareButton: document.querySelector("#downloadShareButton"),
  postShareButton: document.querySelector("#postShareButton"),
  template: document.querySelector("#upgradeTemplate"),
  mobileNavButtons: document.querySelectorAll("[data-tab-target]"),
  mobileTabPanels: document.querySelectorAll("[data-tab-panel]"),
};

nodes.comboHud = createComboHud();

renderShop();
render();
initializeCloudSession();
loadCloudLeaderboard();
setInterval(tick, 1000);
setInterval(saveState, 5000);
setInterval(loadCloudLeaderboard, 30000);

nodes.sigilButton.addEventListener("click", (event) => {
  const combo = updateCombo();
  const comboMultiplier = getComboMultiplier(combo);
  const isCrit = Math.random() < critChance;
  const gain = Math.ceil(state.perClick * state.multiplier * comboMultiplier * (isCrit ? critMultiplier : 1));
  state.totalClicks += 1;
  state.essence += gain;
  state.totalEarned += gain;
  state.focus = Math.min(100, state.focus + 3 + state.perClick * 0.05);
  updateDailyQuestProgress("click", { amount: 1 });
  updateDailyQuestProgress("earn", { amount: gain });
  touchProgress();
  popText(event.clientX, event.clientY, `${isCrit ? "CRIT " : ""}+${format(gain)}`, isCrit ? "crit" : "");
  burstParticles(event.clientX, event.clientY, isCrit);
  renderComboHud(combo, isCrit);
  nodes.sigilButton.classList.add("clicked");
  setTimeout(() => nodes.sigilButton.classList.remove("clicked"), 120);
  checkMilestones();
  render();
});

nodes.invokeButton.addEventListener("click", invokeRite);

async function invokeRite() {
  if (state.focus < 100) return;
  const reward = Math.ceil((state.perClick * 25 + state.perSecond * 12 + 75) * state.invokeBonus);

  if (ritualInvocationContractAddress) {
    await invokeRiteOnchain(reward);
    return;
  }

  nodes.accountStatus.textContent = "Deploy RitualInvocation contract first";
  addLog("Activate 2x Boost needs RitualInvocation.sol deployed before it can be onchain.");
  completeInvokeReward(reward);
  addLog(`2x Boost activated locally. Essence surges +${format(reward)}.`);
  render();
}

async function invokeRiteOnchain(reward) {
  setWalletBusy(true, "Activating 2x Boost...");
  nodes.invokeButton.disabled = true;
  nodes.invokeButton.textContent = "Confirm in wallet...";

  try {
    const provider = await getWalletProvider();
    const accounts = await getWalletAccounts(provider);
    const address = accounts?.[0];
    if (!address) throw new Error("No wallet address returned.");

    await switchOrAddRitualTestnet(provider);
    attachWalletAccount(address, "ritual");

    const { BrowserProvider, Contract } = await import("https://esm.sh/ethers@6.13.5");
    const browserProvider = new BrowserProvider(provider);
    const signer = await browserProvider.getSigner();
    const contract = new Contract(ritualInvocationContractAddress, ritualInvocationAbi, signer);
    const tx = await contract.invokeRite(Math.floor(reward), Math.floor(state.totalClicks), Math.floor(state.totalEarned + reward));
    nodes.invokeButton.textContent = "Waiting onchain...";
    await tx.wait();

    completeInvokeReward(reward);
    nodes.accountStatus.textContent = "2x Boost activated onchain";
    addLog(`Onchain 2x Boost activated. Essence surges +${format(reward)}.`);
    render();
  } catch (error) {
    const message = getReadableError(error);
    nodes.accountStatus.textContent = `2x Boost failed: ${message}`;
    addLog(`Onchain 2x Boost failed: ${message}`);
    render();
  } finally {
    setWalletBusy(false);
  }
}

function completeInvokeReward(reward) {
  state.essence += reward;
  state.totalEarned += reward;
  state.focus = 0;
  state.multiplier = 2;
  state.multiplierEndsAt = Date.now() + 15000;
  updateDailyQuestProgress("boost", { amount: 1 });
  touchProgress();
}

if (nodes.resetButton) {
  nodes.resetButton.addEventListener("click", () => {
    const ok = window.confirm("Reset the ritual circle from the beginning?");
    if (!ok) return;
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
  nodes.accountStatus.textContent = "Saving progress...";
  await flushCloudSave();
  if (supabaseClient) {
    await supabaseClient.auth.signOut({ scope: "local" });
  }
  cloudSession = null;
  Object.assign(state, defaultState());
  addLog("Account disconnected.");
  render();
});

if (window.ethereum?.on) {
  window.ethereum.on("accountsChanged", async (accounts) => {
    const address = accounts?.[0];
    if (!address) {
      nodes.accountStatus.textContent = "Saving progress...";
      await flushCloudSave();
      if (supabaseClient) {
        await supabaseClient.auth.signOut({ scope: "local" });
      }
      cloudSession = null;
      Object.assign(state, defaultState());
      render();
      return;
    }

    nodes.accountStatus.textContent = "Wallet changed. Connect again to sync.";
    await flushCloudSave();
    Object.assign(state, defaultState());
    render();
  });
}

window.addEventListener("pagehide", () => {
  flushCloudSave();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushCloudSave();
  }
});

nodes.dailyClaimButton.addEventListener("click", claimDailyReward);
nodes.dailyQuestClaimButton.addEventListener("click", claimDailyQuestReward);

nodes.submitScoreButton.addEventListener("click", submitOnchainScore);
nodes.shareButton.addEventListener("click", openShareModal);
nodes.closeShareButton.addEventListener("click", closeShareModal);
nodes.shareUsername.addEventListener("input", handleShareUsernameInput);
nodes.shareAvatarInput.addEventListener("change", handleShareAvatar);
nodes.downloadShareButton.addEventListener("click", downloadShareCard);
nodes.postShareButton.addEventListener("click", postShareToX);
nodes.shareModal.addEventListener("click", (event) => {
  if (event.target === nodes.shareModal) closeShareModal();
});

nodes.achievementsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-claim-achievement]");
  if (!button) return;
  claimOnchainAchievement(button.dataset.claimAchievement);
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
    updateDailyQuestProgress("earn", { amount: gain });
    touchProgress();
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
  nodes.invokeButton.textContent = "Activate 2x Boost";
  nodes.statusText.textContent = getStatusText();
  renderAccount();
  renderDailyLogin();
  checkAchievements();
  renderAchievements();
  renderLeaderboard();
  if (nodes.shareModal && !nodes.shareModal.hidden) updateShareCard();

  document.querySelectorAll(".upgrade-card").forEach((card) => {
    const upgrade = upgrades.find((item) => item.id === card.dataset.id);
    const owned = state.owned[upgrade.id] || 0;
    const cost = getCost(upgrade);
    card.disabled = state.essence < cost;
    card.querySelector(".upgrade-meta").textContent = `Owned ${owned}`;
    card.querySelector(".upgrade-cost").textContent = `Cost ${format(cost)}`;
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
  updateDailyQuestProgress("upgrade", { amount: 1 });
  touchProgress();
  addLog(`${upgrade.name} joined the circle.`);
  render();
}

function getCost(upgrade) {
  const owned = state.owned[upgrade.id] || 0;
  return Math.floor(upgrade.baseCost * upgrade.scale ** owned);
}

function getStatusText() {
  if (state.multiplier > 1) return "2x Boost active: clicks and passive income are doubled for 15 seconds.";
  if (state.focus >= 100) return "Boost Charge is full. Activate 2x Boost when ready.";
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
  nodes.accountStatus.textContent = cloudSession ? `Wallet synced: ${state.account.label}` : `${provider}: ${state.account.label}`;
  if (nodes.xLoginButton) nodes.xLoginButton.hidden = true;
  nodes.metaMaskButton.hidden = true;
  nodes.ritualTestnetButton.hidden = true;
  nodes.logoutButton.hidden = false;
}

async function connectWallet({ mode }) {
  setWalletBusy(true, mode === "ritual" ? "Adding Ritual..." : "Connecting...");

  try {
    const provider = await getWalletProvider();
    const accounts = await getWalletAccounts(provider);
    const address = accounts?.[0];
    if (!address) throw new Error("No wallet address returned.");
    const previousAddress = state.account?.address?.toLowerCase();
    const nextAddress = address.toLowerCase();
    if (previousAddress && previousAddress !== nextAddress) {
      Object.assign(state, defaultState());
    }

    if (mode === "ritual") {
      await switchOrAddRitualTestnet(provider);
      state.ritualTestnetConnected = true;
    }

    await signInAndSyncWallet(address, mode, provider);
    addLog(`${mode === "ritual" ? "Ritual Testnet" : "MetaMask"} synced: ${shortenAddress(address)}.`);
    render();
  } catch (error) {
    const message = getWalletErrorMessage(error, mode);
    nodes.accountStatus.textContent = message;
    addLog(`${message} Progress is not synced until wallet connection succeeds.`);
    saveState();
  } finally {
    setWalletBusy(false);
  }
}

async function getWalletProvider() {
  if (window.ethereum) return window.ethereum;
  if (!canUseWalletConnectHere()) {
    throw new Error("WalletConnect needs the deployed HTTPS website. Upload to Vercel first, then open that link in Chrome.");
  }
  return getWalletConnectProvider();
}

function canUseWalletConnectHere() {
  return location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

async function getWalletConnectProvider() {
  if (walletConnectProvider) return walletConnectProvider;

  nodes.accountStatus.textContent = "Opening WalletConnect...";
  const { EthereumProvider } = await import("https://esm.sh/@walletconnect/ethereum-provider@2.17.2");
  walletConnectProvider = await EthereumProvider.init({
    projectId: walletConnectProjectId,
    chains: [Number.parseInt(ritualNetwork.chainId, 16)],
    optionalChains: [1],
    rpcMap: {
      [Number.parseInt(ritualNetwork.chainId, 16)]: ritualNetwork.rpcUrls[0],
      1: "https://rpc.ankr.com/eth",
    },
    showQrModal: true,
    metadata: {
      name: "Ritual Clicker",
      description: "Ritual Clicker wallet sync",
      url: window.location.origin,
      icons: [],
    },
  });

  return walletConnectProvider;
}

async function getWalletAccounts(provider) {
  if (provider === window.ethereum) {
    return provider.request({ method: "eth_requestAccounts" });
  }

  if (!provider.session) {
    await provider.connect();
  }

  if (provider.accounts?.length) return provider.accounts;

  const accounts = await provider.request({ method: "eth_accounts" });
  if (accounts?.length) return accounts;

  await provider.connect();
  return provider.accounts || [];
}

async function signInAndSyncWallet(address, mode, provider) {
  attachWalletAccount(address, mode);

  if (!supabaseClient) {
    nodes.accountStatus.textContent = "Wallet connected. Cloud sync unavailable.";
    return;
  }

  nodes.accountStatus.textContent = "Sign to sync progress...";
  try {
    const { data, error } = await runWithEthereumProvider(provider, () =>
      supabaseClient.auth.signInWithWeb3({
        chain: "ethereum",
        statement: "Sign in to Ritual Clicker to sync your progress across devices.",
      }),
    );

    if (error) throw error;

    cloudSession = data.session;
    await syncCloudProgress(address, mode);
  } catch (error) {
    console.warn("Cloud wallet sync failed", error);
    nodes.accountStatus.textContent = `Wallet connected. Cloud sync failed: ${getReadableError(error)}`;
    saveState();
  }
}

async function runWithEthereumProvider(provider, action) {
  if (provider === window.ethereum) return action();

  const hadEthereum = "ethereum" in window;
  const previousEthereum = window.ethereum;

  try {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: provider,
    });
    return await action();
  } finally {
    if (hadEthereum) {
      Object.defineProperty(window, "ethereum", {
        configurable: true,
        value: previousEthereum,
      });
    } else {
      delete window.ethereum;
    }
  }
}

function attachWalletAccount(address, mode) {
  const account = {
    type: mode,
    label: shortenAddress(address),
    address,
  };
  state.account = account;
  state.ritualTestnetConnected = mode === "ritual" || state.ritualTestnetConnected;
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
  if (`${error?.message || ""}`.includes("WalletConnect needs")) return error.message;
  if (`${error?.message || ""}`) return getReadableError(error);
  if (mode === "ritual") return "Could not add Ritual Testnet";
  return "Could not connect wallet";
}

function getReadableError(error) {
  const message = `${error?.message || error || ""}`.trim();
  if (!message) return "check Supabase setup";
  if (message.length > 120) return `${message.slice(0, 117)}...`;
  return message;
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
  const walletAddress = address.toLowerCase();
  try {
    const { data, error } = await supabaseClient
      .from(supabaseTable)
      .select("progress, wallet_address, updated_at")
      .eq("wallet_address", walletAddress)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    const remoteState = normalizeState(data?.[0]?.progress);
    const legacyState = loadLegacyStateForWallet(address);
    const account = {
      type: mode,
      label: shortenAddress(address),
      address,
    };

    const mergedState = mergeProgressStates(remoteState, legacyState, hasMeaningfulProgress(state) ? state : null);

    if (mergedState && hasMeaningfulProgress(mergedState)) {
      Object.assign(state, {
        ...mergedState,
        account,
        ritualTestnetConnected: mode === "ritual" || mergedState.ritualTestnetConnected,
      });
      await saveCloudState({ force: true, skipRemoteCheck: true, silent: true });
    } else {
      state.account = account;
    }
    await loadCloudLeaderboard();
    nodes.accountStatus.textContent = `Wallet synced: ${shortenAddress(address)}`;
  } catch (error) {
    console.warn("Cloud sync failed", error);
    nodes.accountStatus.textContent = `Wallet connected. Cloud sync failed: ${getReadableError(error)}`;
  } finally {
    isLoadingCloudState = false;
  }
}

function shouldUseRemoteState(remoteState, localState) {
  if (!hasMeaningfulProgress(localState)) return true;
  return (remoteState.totalEarned || 0) > (localState.totalEarned || 0);
}

async function saveCloudState({ force = false, skipRemoteCheck = false, silent = false } = {}) {
  if (!supabaseClient || !cloudSession?.user?.id || !state.account?.address) return false;
  if (isLoadingCloudState && !force) return false;

  if (!force) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => saveCloudState({ force: true, silent: true }), 1300);
    return false;
  }

  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = null;
  const walletAddress = state.account.address.toLowerCase();

  let remoteState = null;
  if (!skipRemoteCheck) {
    const { data: currentRows, error: fetchError } = await supabaseClient
      .from(supabaseTable)
      .select("progress")
      .eq("wallet_address", walletAddress)
      .limit(1);

    if (fetchError) {
      console.warn("Cloud save precheck failed", fetchError);
      nodes.accountStatus.textContent = "Wallet connected. Cloud save failed.";
      return false;
    }

    remoteState = normalizeState(currentRows?.[0]?.progress);
  }

  const portableState = createPortableState();
  if (remoteState && hasMeaningfulProgress(remoteState) && !hasMeaningfulProgress(portableState)) {
    restoreRemoteProgress(remoteState);
    if (!silent) nodes.accountStatus.textContent = `Restored: ${format(remoteState.essence)} essence`;
    render();
    return false;
  }

  if (remoteState && shouldKeepRemoteProgress(remoteState, portableState)) {
    restoreRemoteProgress(remoteState);
    if (!silent) nodes.accountStatus.textContent = `Restored: ${format(remoteState.essence)} essence`;
    render();
    return false;
  }

  const progress = mergeProgressStates(remoteState, portableState) || portableState;
  if (progress) {
    const account = state.account;
    Object.assign(state, {
      ...progress,
      account,
      ritualTestnetConnected: state.ritualTestnetConnected || progress.ritualTestnetConnected,
    });
  }
  const { error } = await supabaseClient.from(supabaseTable).upsert(
    {
      user_id: cloudSession.user.id,
      wallet_address: walletAddress,
      progress,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wallet_address" },
  );

  if (error) {
    console.warn("Cloud save failed", error);
    nodes.accountStatus.textContent = "Wallet connected. Cloud save failed.";
    return false;
  } else {
    await loadCloudLeaderboard();
    if (!silent) nodes.accountStatus.textContent = `Saved: ${format(progress.essence)} essence`;
    return true;
  }
}

async function flushCloudSave() {
  if (!cloudSession?.user?.id || !state.account?.address) return false;
  return saveCloudState({ force: true });
}

function restoreRemoteProgress(remoteState) {
  const account = state.account;
  const currentRitualStatus = state.ritualTestnetConnected;
  Object.assign(state, {
    ...remoteState,
    account,
    ritualTestnetConnected: currentRitualStatus || remoteState.ritualTestnetConnected,
  });
}

function shouldKeepRemoteProgress(remoteState, localState) {
  if (!hasMeaningfulProgress(remoteState) || !hasMeaningfulProgress(localState)) return false;

  const remoteScore = getProgressScore(remoteState);
  const localScore = getProgressScore(localState);
  const remoteOwned = getOwnedCount(remoteState);
  const localOwned = getOwnedCount(localState);
  const remoteUpdatedAt = remoteState.progressUpdatedAt || 0;
  const localUpdatedAt = localState.progressUpdatedAt || 0;

  if (localScore.totalEarned < remoteScore.totalEarned && localOwned <= remoteOwned && localScore.totalClicks <= remoteScore.totalClicks) {
    return true;
  }

  if (localUpdatedAt < remoteUpdatedAt && localScore.totalEarned <= remoteScore.totalEarned && localOwned <= remoteOwned) {
    return true;
  }

  return false;
}

function getProgressScore(progressState) {
  return {
    essence: Number(progressState?.essence) || 0,
    totalEarned: Number(progressState?.totalEarned) || 0,
    totalClicks: Number(progressState?.totalClicks) || 0,
  };
}

function getOwnedCount(progressState) {
  return Object.values(progressState?.owned || {}).reduce((sum, count) => sum + (Number(count) || 0), 0);
}

async function loadCloudLeaderboard() {
  if (!supabaseClient) {
    cloudLeaderboard = getLocalLeaderboardFallback();
    renderLeaderboard();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from(supabaseTable)
      .select("wallet_address, progress, updated_at")
      .limit(100);

    if (error) throw error;

    cloudLeaderboard = (data || [])
      .map((row) => {
        const progress = normalizeState(row.progress);
        if (!progress || !row.wallet_address) return null;
        return {
          address: row.wallet_address,
          name: `${shortenAddress(row.wallet_address)} · ${getLevelForClicks(progress.totalClicks || 0).title}`,
          score: Number(progress.totalEarned || 0),
          updatedAt: row.updated_at,
        };
      })
      .filter((entry) => entry && entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 10);

    cloudLeaderboard = mergeCurrentPlayerIntoLeaderboard(cloudLeaderboard);
    renderLeaderboard();
  } catch (error) {
    console.warn("Leaderboard load failed", error);
    cloudLeaderboard = getLocalLeaderboardFallback();
    renderLeaderboard();
  }
}

function getLocalLeaderboardFallback() {
  if (!state.account?.address || state.totalEarned <= 0) return [];
  return [
    {
      address: state.account.address,
      name: getCurrentPlayer(),
      score: state.totalEarned,
    },
  ];
}

function mergeCurrentPlayerIntoLeaderboard(entries) {
  if (!state.account?.address || state.totalEarned <= 0) return entries;

  const address = state.account.address.toLowerCase();
  const withoutCurrent = entries.filter((entry) => entry.address?.toLowerCase() !== address);
  return [
    ...withoutCurrent,
    {
      address: state.account.address,
      name: getCurrentPlayer(),
      score: state.totalEarned,
    },
  ]
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);
}

function createPortableState() {
  if (hasMeaningfulProgress(state)) touchProgress();
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
  nodes.dailyClaimButton.disabled = dailyRitualContractAddress ? claimed : false;
  nodes.dailyClaimButton.textContent = dailyRitualContractAddress
    ? claimed
      ? "Come Back Tomorrow"
      : "Claim Onchain Daily"
    : "Deploy Daily Contract First";
  renderDailyQuest();
}

function hasClaimedDailyToday() {
  return state.dailyLastClaimDate === getDateKey();
}

function getDailyReward(streak) {
  return Math.min(500, 250 + Math.max(0, streak - 1) * 50);
}

function ensureDailyQuest() {
  const today = getDateKey();
  const definition = generateDailyQuest(today);
  const current = normalizeDailyQuest(state.dailyQuest);
  const sameQuest = current && current.date === definition.date && current.type === definition.type && current.target === definition.target;

  if (!sameQuest) {
    state.dailyQuest = {
      ...definition,
      owner: "global",
      progress: 0,
      claimed: false,
    };
    touchProgress();
  } else {
    state.dailyQuest = {
      ...definition,
      owner: "global",
      progress: Math.min(definition.target, current.progress || 0),
      claimed: Boolean(current.claimed),
    };
  }

  return state.dailyQuest;
}

function generateDailyQuest(dateKey) {
  const seed = hashString(`${dateKey}:ritual-clicker-global-daily-quest`);
  const questTypes = ["click", "earn", "upgrade", "boost", "daily"];
  const type = questTypes[seed % questTypes.length];
  const difficulty = 1 + (seed % 4);
  const configs = {
    click: {
      target: [150, 300, 600, 1000][difficulty - 1],
      reward: [700, 1200, 2200, 3600][difficulty - 1],
      objective: "Click the sigil",
    },
    earn: {
      target: [5000, 15000, 35000, 75000][difficulty - 1],
      reward: [900, 1800, 3200, 5200][difficulty - 1],
      objective: "Earn essence",
    },
    upgrade: {
      target: [1, 2, 3, 4][difficulty - 1],
      reward: [800, 1700, 3000, 4800][difficulty - 1],
      objective: "Buy upgrades",
    },
    boost: {
      target: 1,
      reward: 1600 + difficulty * 350,
      objective: "Activate 2x Boost",
    },
    daily: {
      target: 1,
      reward: 1250 + difficulty * 300,
      objective: "Claim daily login",
    },
  };
  const titles = [
    "Whispers of the Circle",
    "A Signal Beneath the Sigil",
    "The Green Flame Wakes",
    "Echoes from the Testnet",
    "The Altar Requests Motion",
  ];
  const lore = [
    "The circle listens for proof that your ritual is still alive.",
    "A quiet instruction forms inside the glow. Complete it before the day resets.",
    "The sigil folds today's task into a clean line of fate.",
    "A small command arrives from the edge of the chain.",
    "The altar waits for one focused offering.",
  ];
  const config = configs[type];

  return {
    date: dateKey,
    owner: "global",
    type,
    target: config.target,
    progress: 0,
    reward: config.reward,
    objective: config.objective,
    title: titles[seed % titles.length],
    lore: lore[Math.floor(seed / 7) % lore.length],
    claimed: false,
    source: "daily-auto",
  };
}

function renderDailyQuest() {
  const quest = ensureDailyQuest();
  const progress = Math.min(quest.target, quest.progress || 0);
  const percent = Math.min(100, (progress / Math.max(1, quest.target)) * 100);
  const complete = progress >= quest.target;

  nodes.dailyQuestStatus.textContent = quest.claimed ? "Claimed" : complete ? "Complete" : "Active";
  nodes.dailyQuestTitle.textContent = quest.title;
  nodes.dailyQuestObjective.textContent = `${quest.objective}: ${format(progress)} / ${format(quest.target)}`;
  nodes.dailyQuestReward.textContent = `+${format(quest.reward)} essence`;
  nodes.dailyQuestFill.style.width = `${percent}%`;
  nodes.dailyQuestClaimButton.disabled = !complete || quest.claimed;
  nodes.dailyQuestClaimButton.textContent = quest.claimed ? "Quest Claimed" : complete ? "Claim Quest Onchain" : "Complete Quest First";
}

function updateDailyQuestProgress(type, { amount = 1 } = {}) {
  const quest = ensureDailyQuest();
  if (quest.type !== type || quest.claimed) return;
  quest.progress = Math.min(quest.target, (quest.progress || 0) + amount);
}

async function claimDailyQuestReward() {
  const quest = ensureDailyQuest();
  if (quest.claimed || (quest.progress || 0) < quest.target) return;
  if (!ritualDailyQuestContractAddress) {
    nodes.accountStatus.textContent = "Deploy RitualDailyQuest contract first";
    addLog("Daily Quest claim needs RitualDailyQuest.sol contract address.");
    return;
  }

  setWalletBusy(true, "Claiming quest onchain...");
  nodes.dailyQuestClaimButton.disabled = true;
  nodes.dailyQuestClaimButton.textContent = "Confirm in wallet...";

  try {
    const provider = await getWalletProvider();
    const accounts = await getWalletAccounts(provider);
    const address = accounts?.[0];
    if (!address) throw new Error("No wallet address returned.");

    await switchOrAddRitualTestnet(provider);
    attachWalletAccount(address, "ritual");

    const { BrowserProvider, Contract } = await import("https://esm.sh/ethers@6.13.5");
    const browserProvider = new BrowserProvider(provider);
    const signer = await browserProvider.getSigner();
    const contract = new Contract(ritualDailyQuestContractAddress, ritualDailyQuestAbi, signer);
    const questDay = getQuestDayNumber(quest.date);
    const alreadyClaimed = await contract.hasClaimed(address, questDay);
    if (alreadyClaimed) {
      quest.claimed = true;
      nodes.accountStatus.textContent = "Daily Quest already claimed onchain";
      render();
      return;
    }

    const tx = await contract.claimQuest(questDay, quest.type, Math.floor(quest.reward));
    nodes.dailyQuestClaimButton.textContent = "Waiting onchain...";
    await tx.wait();

    quest.claimed = true;
    state.essence += quest.reward;
    state.totalEarned += quest.reward;
    touchProgress();
    addLog(`Onchain Daily Quest claimed. Essence +${format(quest.reward)}.`);
    render();
  } catch (error) {
    const message = getReadableError(error);
    nodes.accountStatus.textContent = `Daily Quest claim failed: ${message}`;
    addLog(`Daily Quest claim failed: ${message}`);
    renderDailyQuest();
  } finally {
    setWalletBusy(false);
  }
}

function getQuestDayNumber(dateKey) {
  return Number(String(dateKey || getDateKey()).replaceAll("-", ""));
}

function hashString(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function claimDailyReward() {
  if (dailyRitualContractAddress) {
    await claimOnchainDailyReward();
    return;
  }

  nodes.accountStatus.textContent = "Daily contract not deployed yet";
  addLog("Daily Login needs the Ritual Testnet contract address before it can be onchain.");
}

async function claimOnchainDailyReward() {
  setWalletBusy(true, "Claiming Daily onchain...");
  nodes.dailyClaimButton.disabled = true;
  nodes.dailyClaimButton.textContent = "Confirm in wallet...";

  try {
    const provider = await getWalletProvider();
    const accounts = await getWalletAccounts(provider);
    const address = accounts?.[0];
    if (!address) throw new Error("No wallet address returned.");

    await switchOrAddRitualTestnet(provider);
    attachWalletAccount(address, "ritual");

    const { BrowserProvider, Contract } = await import("https://esm.sh/ethers@6.13.5");
    const browserProvider = new BrowserProvider(provider);
    const signer = await browserProvider.getSigner();
    const contract = new Contract(dailyRitualContractAddress, dailyRitualAbi, signer);
    const [canClaim, reward, nextStreak] = await contract.previewClaim(address);

    if (!canClaim) {
      nodes.accountStatus.textContent = "Daily already claimed onchain";
      addLog("Daily Login is already claimed today on Ritual Testnet.");
      render();
      return;
    }

    const tx = await contract.claimDaily();
    nodes.dailyClaimButton.textContent = "Waiting onchain...";
    await tx.wait();

    const rewardNumber = Number(reward);
    state.dailyLastClaimDate = getDateKey();
    state.dailyStreak = Number(nextStreak);
    state.essence += rewardNumber;
    state.totalEarned += rewardNumber;
    state.ritualTestnetConnected = true;
    updateDailyQuestProgress("daily", { amount: 1 });
    updateDailyQuestProgress("earn", { amount: rewardNumber });
    touchProgress();
    addLog(`Onchain Daily claimed. Essence +${format(rewardNumber)}.`);
    render();
  } catch (error) {
    const message = getReadableError(error);
    nodes.accountStatus.textContent = `Onchain daily failed: ${message}`;
    addLog(`Onchain Daily failed: ${message}`);
    renderDailyLogin();
  } finally {
    setWalletBusy(false);
  }
}

async function switchOrAddRitualTestnet(provider = window.ethereum) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ritualNetwork.chainId }],
    });
  } catch (error) {
    if (!isUnknownChainError(error)) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [ritualNetwork],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ritualNetwork.chainId }],
    });
  }
}

function isUnknownChainError(error) {
  return error?.code === 4902 || error?.data?.originalError?.code === 4902 || `${error?.message || ""}`.includes("Unrecognized chain ID");
}

function renderLeaderboard() {
  const leaderboard = cloudLeaderboard;
  const topLeaders = leaderboard.slice(0, 10);
  const currentAddress = state.account?.address?.toLowerCase();
  const playerIndex = currentAddress
    ? leaderboard.findIndex((entry) => entry.address?.toLowerCase() === currentAddress)
    : -1;
  const playerEntry = playerIndex >= 0 ? leaderboard[playerIndex] : null;
  const showPlayerRank = Boolean(playerEntry && playerIndex >= 10);

  nodes.playerRank.textContent = playerIndex >= 0 ? `Rank #${playerIndex + 1}` : `${leaderboard.length} players`;
  nodes.leaderboardList.innerHTML = topLeaders
    .map(
      (entry) => `
        <li class="${entry.address?.toLowerCase() === currentAddress ? "is-player" : ""}">
          <span class="leader-name">${entry.name}</span>
          <strong>${format(entry.score)}</strong>
        </li>
      `,
    )
    .join("");
  nodes.leaderboardPlayerRank.hidden = !showPlayerRank;
  nodes.leaderboardPlayerRank.innerHTML = showPlayerRank
    ? `<span>Your rank #${playerIndex + 1}</span><strong>${format(playerEntry.score)}</strong>`
    : "";
  nodes.submitScoreButton.disabled = state.totalEarned <= 0;
  nodes.submitScoreButton.textContent = ritualScoreContractAddress ? "Submit Score Onchain" : "Deploy Score Contract First";
  if (!ritualScoreContractAddress) {
    nodes.submitScoreStatus.textContent = "Score contract is not deployed yet.";
  } else if (!state.account?.address) {
    nodes.submitScoreStatus.textContent = "Connect wallet to submit your best score onchain.";
  } else {
    nodes.submitScoreStatus.textContent = `Ready to submit ${format(state.totalEarned)} total essence.`;
  }
}

function openShareModal() {
  updateShareCard();
  nodes.shareModal.hidden = false;
  nodes.shareUsername.focus();
}

function closeShareModal() {
  nodes.shareModal.hidden = true;
}

function handleShareAvatar(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    nodes.shareProfileStatus.textContent = "Upload an image file for the card.";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    shareAvatarDataUrl = String(reader.result || "");
    nodes.shareProfileStatus.textContent = "Using uploaded profile picture.";
    updateShareCard();
  });
  reader.readAsDataURL(file);
}

function handleShareUsernameInput() {
  shareXAvatarDataUrl = "";
  shareXProfileHandle = "";
  shareXProfileName = "";
  updateShareCard();
  nodes.shareProfileStatus.textContent = shareAvatarDataUrl
    ? "Using uploaded profile picture."
    : "Upload a profile picture for the share card.";
}

function getShareHandle() {
  const typed = nodes.shareUsername.value.trim().replace(/^@/, "");
  if (typed) return typed;
  if (state.account?.label) return state.account.label.replace(/^@/, "").replace(/^0x/i, "wallet-").slice(0, 18);
  return "ritualist";
}

function getShareAvatarSource(handle) {
  if (shareAvatarDataUrl) return shareAvatarDataUrl;
  if (shareXAvatarDataUrl) return shareXAvatarDataUrl;
  const initial = (handle[0] || "R").toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#020705"/>
      <circle cx="100" cy="100" r="88" fill="#063a25" stroke="#40ffaf" stroke-width="6"/>
      <text x="100" y="122" text-anchor="middle" font-family="Arial, sans-serif" font-size="84" font-weight="900" fill="#b9ffe1">${initial}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function updateShareCard() {
  const level = getCurrentLevel();
  const aura = levelAuras[level.title] || levelAuras.Bitty;
  const handle = getShareHandle();
  const unlocked = achievements.filter((achievement) => state.achievements[achievement.id]).length;

  nodes.shareCard.style.setProperty("--aura", aura.aura);
  nodes.shareCard.style.setProperty("--aura-soft", aura.soft);
  nodes.shareAvatar.src = getShareAvatarSource(handle);
  nodes.shareRank.textContent = level.title;
  nodes.shareName.textContent = shareXProfileName && shareXProfileHandle
    ? `${shareXProfileName} · @${shareXProfileHandle}`
    : `@${handle}`;
  nodes.shareEssence.textContent = format(state.essence);
  nodes.shareEarned.textContent = format(state.totalEarned);
  nodes.shareClicks.textContent = format(state.totalClicks);
  nodes.shareIncome.textContent = `${format(state.perSecond)}/s`;
  nodes.shareAchievements.textContent = `${unlocked}/${achievements.length} achievements`;
}

async function downloadShareCard() {
  updateShareCard();
  nodes.downloadShareButton.disabled = true;
  nodes.downloadShareButton.textContent = "Rendering...";

  try {
    const canvas = await renderShareCardCanvas();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not render share card.");
    const link = document.createElement("a");
    link.download = `ritual-clicker-${getShareHandle()}.png`;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } finally {
    nodes.downloadShareButton.disabled = false;
    nodes.downloadShareButton.textContent = "Download Card";
  }
}

function postShareToX() {
  updateShareCard();
  const level = getCurrentLevel();
  const text = [
    `I reached ${level.title} in Ritual Clicker.`,
    `Essence: ${format(state.essence)}`,
    `Total earned: ${format(state.totalEarned)}`,
    `Clicks: ${format(state.totalClicks)}`,
  ].join("\n");
  const url = new URL("https://twitter.com/intent/tweet");
  url.searchParams.set("text", text);
  url.searchParams.set("url", "https://ritual-clicker.vercel.app/");
  window.open(url.toString(), "_blank", "noopener");
}

async function renderShareCardCanvas() {
  const width = 1200;
  const height = 630;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const level = getCurrentLevel();
  const aura = levelAuras[level.title] || levelAuras.Bitty;
  const handle = getShareHandle();
  const avatar = await loadImage(getShareAvatarSource(handle));
  const unlocked = achievements.filter((achievement) => state.achievements[achievement.id]).length;

  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
  const glow = context.createRadialGradient(155, 120, 20, 155, 120, 500);
  glow.addColorStop(0, aura.soft);
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  const lowerGlow = context.createRadialGradient(width * 0.8, height * 0.92, 10, width * 0.8, height * 0.92, 520);
  lowerGlow.addColorStop(0, aura.soft);
  lowerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = lowerGlow;
  context.fillRect(0, 0, width, height);

  drawCircleImage(context, avatar, 78, 74, 168);
  context.strokeStyle = aura.aura;
  context.lineWidth = 5;
  context.beginPath();
  context.arc(162, 158, 86, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#b9ffe1";
  context.font = "900 92px Georgia, serif";
  context.fillText(level.title, 286, 145);
  context.font = "800 34px Arial, sans-serif";
  context.fillStyle = "#9ee8c5";
  context.fillText(`@${handle}`, 292, 198);

  const stats = [
    ["Essence", format(state.essence)],
    ["Total Earned", format(state.totalEarned)],
    ["Total Clicks", format(state.totalClicks)],
    ["Income", `${format(state.perSecond)}/s`],
  ];
  stats.forEach(([label, value], index) => {
    const x = 78 + index * 276;
    drawRoundedRect(context, x, 310, 240, 128, 18, "rgba(0, 0, 0, 0.56)", "rgba(64, 255, 175, 0.42)");
    context.fillStyle = "#9ee8c5";
    context.font = "800 24px Arial, sans-serif";
    context.fillText(label, x + 24, 352);
    context.fillStyle = "#40ffaf";
    context.font = "900 44px Arial, sans-serif";
    context.fillText(value, x + 24, 405);
  });

  context.fillStyle = "#b9ffe1";
  context.font = "900 32px Arial, sans-serif";
  context.fillText(`${unlocked}/${achievements.length} achievements`, 78, 540);
  context.textAlign = "right";
  context.font = "900 28px Arial, sans-serif";
  context.fillText("Ritual Clicker", width - 78, 520);
  context.font = "800 24px Arial, sans-serif";
  context.fillText("Made by @callmehannnnnnn", width - 78, 560);
  context.textAlign = "left";
  return canvas;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function drawCircleImage(context, image, x, y, size) {
  context.save();
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(image, x, y, size, size);
  context.restore();
}

function drawRoundedRect(context, x, y, width, height, radius, fill, stroke) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = 2;
  context.stroke();
}

async function submitOnchainScore() {
  if (!ritualScoreContractAddress) {
    nodes.submitScoreStatus.textContent = "Deploy RitualScore.sol first, then add its contract address.";
    return;
  }
  if (state.totalEarned <= 0) {
    nodes.submitScoreStatus.textContent = "Play first, then submit your score.";
    return;
  }

  setWalletBusy(true, "Submitting score...");
  nodes.submitScoreButton.disabled = true;
  nodes.submitScoreButton.textContent = "Confirm in wallet...";

  try {
    const provider = await getWalletProvider();
    const accounts = await getWalletAccounts(provider);
    const address = accounts?.[0];
    if (!address) throw new Error("No wallet address returned.");

    await switchOrAddRitualTestnet(provider);
    attachWalletAccount(address, "ritual");

    const { BrowserProvider, Contract } = await import("https://esm.sh/ethers@6.13.5");
    const browserProvider = new BrowserProvider(provider);
    const signer = await browserProvider.getSigner();
    const contract = new Contract(ritualScoreContractAddress, ritualScoreAbi, signer);
    const tx = await contract.submitScore(Math.floor(state.totalEarned), Math.floor(state.totalClicks));

    nodes.submitScoreButton.textContent = "Waiting onchain...";
    await tx.wait();
    nodes.submitScoreStatus.textContent = "Score submitted on Ritual Testnet.";
    addLog("Score submitted onchain.");
    render();
  } catch (error) {
    const message = getReadableError(error);
    nodes.submitScoreStatus.textContent = `Submit failed: ${message}`;
    addLog(`Submit Score failed: ${message}`);
    renderLeaderboard();
  } finally {
    setWalletBusy(false);
  }
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
    .map((achievement, index) => {
      const unlocked = Boolean(state.achievements[achievement.id]);
      const claimedOnchain = Boolean(state.onchainAchievements[achievement.id]);
      const claimLabel = ritualAchievementsContractAddress
        ? claimedOnchain
          ? "Claimed"
          : "Claim"
        : "Deploy";
      return `
        <li class="${unlocked ? "is-unlocked" : ""} ${claimedOnchain ? "is-onchain" : ""}">
          <span class="achievement-badge" aria-hidden="true">${getAchievementIcon(index, unlocked)}</span>
          <span class="achievement-copy">
            <span class="achievement-name">${achievement.name}</span>
            <span class="achievement-req">${achievement.requirement}</span>
            <button class="achievement-claim" type="button" data-claim-achievement="${achievement.id}" ${!unlocked || claimedOnchain ? "disabled" : ""}>
              ${claimLabel}
            </button>
          </span>
        </li>
      `;
    })
    .join("");
}

async function claimOnchainAchievement(achievementId) {
  const achievement = achievements.find((item) => item.id === achievementId);
  if (!achievement || !state.achievements[achievementId]) return;
  if (!ritualAchievementsContractAddress) {
    nodes.accountStatus.textContent = "Deploy achievements contract first";
    addLog("Achievement claim needs RitualAchievements contract address.");
    return;
  }

  setWalletBusy(true, "Claiming achievement...");
  const claimButton = [...nodes.achievementsList.querySelectorAll("[data-claim-achievement]")]
    .find((button) => button.dataset.claimAchievement === achievementId);
  if (claimButton) {
    claimButton.disabled = true;
    claimButton.textContent = "Confirm in wallet...";
  }

  try {
    const provider = await getWalletProvider();
    const accounts = await getWalletAccounts(provider);
    const address = accounts?.[0];
    if (!address) throw new Error("No wallet address returned.");

    await switchOrAddRitualTestnet(provider);
    attachWalletAccount(address, "ritual");

    const { BrowserProvider, Contract } = await import("https://esm.sh/ethers@6.13.5");
    const browserProvider = new BrowserProvider(provider);
    const signer = await browserProvider.getSigner();
    const contract = new Contract(ritualAchievementsContractAddress, ritualAchievementsAbi, signer);

    const tx = await contract.claimAchievement(achievementId);
    if (claimButton) claimButton.textContent = "Waiting onchain...";
    await tx.wait();

    state.onchainAchievements[achievementId] = Date.now();
    nodes.accountStatus.textContent = `${achievement.name} claimed onchain`;
    addLog(`${achievement.name} claimed onchain.`);
    render();
  } catch (error) {
    const message = getReadableError(error);
    if (message.toLowerCase().includes("already") || message.toLowerCase().includes("claimed")) {
      try {
        const provider = await getWalletProvider();
        const accounts = await getWalletAccounts(provider);
        const address = accounts?.[0];
        const { BrowserProvider, Contract } = await import("https://esm.sh/ethers@6.13.5");
        const browserProvider = new BrowserProvider(provider);
        const signer = await browserProvider.getSigner();
        const contract = new Contract(ritualAchievementsContractAddress, ritualAchievementsAbi, signer);
        const alreadyClaimed = address ? await contract.hasClaimed(address, achievementId) : false;
        if (alreadyClaimed) {
          state.onchainAchievements[achievementId] = Date.now();
          nodes.accountStatus.textContent = `${achievement.name} already claimed onchain`;
          render();
          return;
        }
      } catch (checkError) {
        console.warn("Could not verify onchain achievement claim", checkError);
      }
    }
    nodes.accountStatus.textContent = `Achievement claim failed: ${message}`;
    addLog(`Achievement claim failed: ${message}`);
    renderAchievements();
  } finally {
    setWalletBusy(false);
  }
}

function getAchievementIcon(index, unlocked) {
  const achievement = achievements[index];
  const icons = {
    "first-gritual": "✦",
    "tiny-cultist": "☽",
    "bitty-energy": "🪄",
    "ritual-beginner": "◇",
    "finger-destroyer": "☝",
    "ritty-certified": "🕯️",
    "ritualist-certified": "🔥",
    "sleep-temporary": "☾",
    "ritual-maxxing": "⬡",
    "infinite-grindset": "∞",
    "radiant-one": "🥇",
    "touch-grass": "🌿",
    "not-addicted": "◷",
    "ritual-never-ends": "⛓",
    "zealot-awakening": "🌀",
    "gpu-melter": "▣",
    "ritual-testnet-ready": "◆",
    "beyond-human": "★",
  };
  return unlocked ? icons[achievement.id] || "✦" : "×";
}

function getCurrentPlayer() {
  const name = state.account ? state.account.label : "Anonymous";
  return `${name} · ${getCurrentLevel().title}`;
}

function getLevelForClicks(clicks) {
  return levels.reduce((current, level) => {
    if (clicks >= level.clicks) return level;
    return current;
  }, levels[0]);
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

function createComboHud() {
  const node = document.createElement("div");
  node.className = "combo-hud";
  node.innerHTML = `
    <span class="combo-label">Combo</span>
    <strong>1x</strong>
    <em>Crit ready</em>
  `;
  nodes.sigilButton.appendChild(node);
  return node;
}

function updateCombo() {
  const now = Date.now();
  comboRuntime.count = now - comboRuntime.lastClickAt <= comboWindowMs
    ? Math.min(comboCap, comboRuntime.count + 1)
    : 1;
  comboRuntime.lastClickAt = now;

  window.clearTimeout(comboRuntime.resetTimer);
  comboRuntime.resetTimer = window.setTimeout(() => {
    comboRuntime.count = 0;
    renderComboHud(0, false);
  }, comboWindowMs);

  return comboRuntime.count;
}

function getComboMultiplier(combo) {
  return 1 + Math.max(0, Math.min(combo, comboCap) - 1) * comboStepBonus;
}

function renderComboHud(combo = comboRuntime.count, isCrit = false) {
  if (!nodes.comboHud) return;
  const multiplier = getComboMultiplier(combo);
  nodes.comboHud.classList.toggle("is-active", combo > 1);
  nodes.comboHud.classList.toggle("is-crit", isCrit);
  nodes.comboHud.querySelector("strong").textContent = combo > 1 ? `${combo}x` : "1x";
  nodes.comboHud.querySelector("em").textContent = isCrit
    ? "Critical hit"
    : combo > 1
      ? `+${Math.round((multiplier - 1) * 100)}% click`
      : "Tap fast";
}

function popText(x, y, text, tone = "") {
  const node = document.createElement("span");
  node.className = `float-text ${tone ? `is-${tone}` : ""}`.trim();
  node.textContent = text;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 800);
}

function burstParticles(x, y, isCrit = false) {
  const currentLevel = getCurrentLevel();
  const aura = levelAuras[currentLevel.title]?.aura || "#40ffaf";
  const baseCount = window.matchMedia("(max-width: 820px)").matches ? 7 : 12;
  const count = isCrit ? baseCount + 10 : baseCount;

  for (let index = 0; index < count; index += 1) {
    const node = document.createElement("span");
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.55;
    const distance = (isCrit ? 38 : 26) + Math.random() * (isCrit ? 70 : 46);
    const size = (isCrit ? 4 : 3) + Math.random() * (isCrit ? 7 : 5);

    node.className = "click-particle";
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.setProperty("--particle-x", `${Math.cos(angle) * distance}px`);
    node.style.setProperty("--particle-y", `${Math.sin(angle) * distance}px`);
    node.style.setProperty("--particle-size", `${size}px`);
    node.style.setProperty("--particle-color", isCrit ? "#ffd76a" : aura);
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 680);
  }
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
    dailyQuest: null,
    progressUpdatedAt: 0,
    ritualTestnetConnected: false,
    onchainAchievements: {},
    log: [],
  };
}

function loadState() {
  return defaultState();
}

function normalizeState(saved) {
  const base = defaultState();
  if (!saved || typeof saved !== "object") return null;

  return {
    ...base,
    ...saved,
    owned: { ...base.owned, ...saved.owned },
    achievements: { ...base.achievements, ...saved.achievements },
    onchainAchievements: { ...base.onchainAchievements, ...saved.onchainAchievements },
    milestones: Array.isArray(saved.milestones) ? saved.milestones : base.milestones,
    openedDays: Array.isArray(saved.openedDays) ? saved.openedDays : base.openedDays,
    dailyLastClaimDate: typeof saved.dailyLastClaimDate === "string" ? saved.dailyLastClaimDate : base.dailyLastClaimDate,
    dailyStreak: Number.isFinite(saved.dailyStreak) ? saved.dailyStreak : base.dailyStreak,
    dailyQuest: normalizeDailyQuest(saved.dailyQuest),
    progressUpdatedAt: Number.isFinite(saved.progressUpdatedAt) ? saved.progressUpdatedAt : base.progressUpdatedAt,
  };
}

function normalizeDailyQuest(quest) {
  if (!quest || typeof quest !== "object") return null;
  return {
    date: typeof quest.date === "string" ? quest.date : "",
    owner: typeof quest.owner === "string" ? quest.owner : "guest",
    type: typeof quest.type === "string" ? quest.type : "click",
    target: Number.isFinite(quest.target) ? quest.target : 1,
    progress: Number.isFinite(quest.progress) ? quest.progress : 0,
    reward: Number.isFinite(quest.reward) ? quest.reward : 0,
    objective: typeof quest.objective === "string" ? quest.objective : "Complete quest",
    title: typeof quest.title === "string" ? quest.title : "Daily Quest",
    lore: typeof quest.lore === "string" ? quest.lore : "A new task waits inside the circle.",
    claimed: Boolean(quest.claimed),
    source: typeof quest.source === "string" ? quest.source : "daily-auto",
  };
}

function saveState() {
  saveCloudState();
}

function touchProgress() {
  state.progressUpdatedAt = Date.now();
}

function loadLegacyStateForWallet(address) {
  const walletAddress = address.toLowerCase();
  const candidates = [
    `${legacySaveKey}:wallet:${walletAddress}`,
    legacySaveKey,
  ];

  for (const key of candidates) {
    try {
      const saved = normalizeState(JSON.parse(localStorage.getItem(key)));
      if (!saved || !hasMeaningfulProgress(saved)) continue;
      const savedAddress = saved.account?.address?.toLowerCase();
      if (savedAddress && savedAddress !== walletAddress) continue;
      return saved;
    } catch {}
  }

  return null;
}

function mergeProgressStates(...states) {
  const validStates = states.filter((item) => item && typeof item === "object");
  if (!validStates.length) return null;

  const normalizedStates = validStates.map((item) => normalizeState(item)).filter(Boolean);
  const spendState = normalizedStates.reduce((latest, item) => {
    const latestStamp = latest.progressUpdatedAt || 0;
    const itemStamp = item.progressUpdatedAt || 0;
    if (itemStamp !== latestStamp) return itemStamp > latestStamp ? item : latest;
    const latestOwned = Object.values(latest.owned || {}).reduce((sum, count) => sum + count, 0);
    const itemOwned = Object.values(item.owned || {}).reduce((sum, count) => sum + count, 0);
    if (itemOwned !== latestOwned) return itemOwned > latestOwned ? item : latest;
    return (item.totalEarned || 0) >= (latest.totalEarned || 0) ? item : latest;
  }, normalizedStates[0]);

  const merged = normalizeState(spendState);
  normalizedStates.forEach((next) => {
    merged.totalEarned = Math.max(merged.totalEarned || 0, next.totalEarned || 0);
    merged.totalClicks = Math.max(merged.totalClicks || 0, next.totalClicks || 0);
    merged.focus = Math.max(merged.focus || 0, next.focus || 0);
    merged.playSeconds = Math.max(merged.playSeconds || 0, next.playSeconds || 0);
    merged.dailyStreak = Math.max(merged.dailyStreak || 0, next.dailyStreak || 0);
    merged.dailyQuest = mergeDailyQuest(merged.dailyQuest, next.dailyQuest);
    merged.progressUpdatedAt = Math.max(merged.progressUpdatedAt || 0, next.progressUpdatedAt || 0);
    merged.ritualTestnetConnected = merged.ritualTestnetConnected || next.ritualTestnetConnected;
    merged.dailyLastClaimDate = [merged.dailyLastClaimDate, next.dailyLastClaimDate].sort().pop() || "";
    merged.openedDays = [...new Set([...(merged.openedDays || []), ...(next.openedDays || [])])];
    merged.milestones = [...new Set([...(merged.milestones || []), ...(next.milestones || [])])];
    merged.achievements = { ...(merged.achievements || {}), ...(next.achievements || {}) };
    merged.onchainAchievements = { ...(merged.onchainAchievements || {}), ...(next.onchainAchievements || {}) };
  });

  return merged;
}

function mergeDailyQuest(currentQuest, nextQuest) {
  const current = normalizeDailyQuest(currentQuest);
  const next = normalizeDailyQuest(nextQuest);
  if (!current) return next;
  if (!next) return current;
  if (next.date > current.date) return next;
  if (current.date > next.date) return current;
  if (current.owner !== next.owner) return next.owner !== "guest" ? next : current;
  if (current.type !== next.type || current.target !== next.target) {
    return (next.progress || 0) > (current.progress || 0) ? next : current;
  }
  return {
    ...current,
    progress: Math.max(current.progress || 0, next.progress || 0),
    claimed: current.claimed || next.claimed,
  };
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

