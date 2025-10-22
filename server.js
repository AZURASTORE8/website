// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');

// fetch polyfill for Node < 18
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try {
    // node-fetch v2 style
    // npm i node-fetch@2
    fetchFn = require('node-fetch');
    // node-fetch v2 exports a function directly
  } catch (e) {
    console.warn('global fetch not available and node-fetch not installed. FiveM status checks will not work.');
  }
}

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression (dev-only attempt)
if (process.env.NODE_ENV !== 'production') {
  try {
    const compression = require('compression');
    app.use(compression());
  } catch (error) {
    console.log('Compression module not found, skipping...');
  }
}

// Configuration (centralized)
const config = {
  discord: {
    token: process.env.BOT_TOKEN,
    guildId: process.env.GUILD_ID,
    roleId: process.env.ROLE_ID,
    purchaseChannelId: process.env.PURCHASE_CHANNEL_ID
  },
  admin: {
    key: process.env.ADMIN_KEY || '',
    ids: (process.env.ADMIN_IDS || '').split(',').map(id => id.trim()).filter(Boolean)
  },
  bank: {
    name: process.env.BANK_NAME || 'ธนาคารกสิกรไทย',
    accountNo: process.env.BANK_ACCOUNT_NO || '188-3-38342-3',
    accountName: process.env.BANK_ACCOUNT_NAME || 'ปฐพี สุขรอบ',
    phone: process.env.TW_PHONE || '0614953242'
  },
  paths: {
    logs: path.join(__dirname, 'logs'),
    config: path.join(__dirname, 'config.txt'),
    rewardCodes: path.join(__dirname, 'rewardCodes.txt')
  },
  fivem: {
    url: process.env.FIVEM_STATUS_URL || '',
    host: process.env.FIVEM_HOST || '',
    port: process.env.FIVEM_PORT || ''
  }
};

// Ensure directories exist
try {
  if (!fs.existsSync(config.paths.logs)) fs.mkdirSync(config.paths.logs, { recursive: true });
} catch (err) {
  console.error('Error creating logs dir:', err);
}

// Helper constants (single-source)
const BOT_TOKEN = config.discord.token;
const GUILD_ID = config.discord.guildId;
const ROLE_ID = config.discord.roleId;
const PURCHASE_CHANNEL_ID = config.discord.purchaseChannelId;
const ADMIN_KEY = config.admin.key;
const ADMIN_IDS = config.admin.ids || [];
const TW_PHONE = config.bank.phone;
const BANK_NAME = config.bank.name;
const BANK_ACCOUNT_NO = config.bank.accountNo;
const BANK_ACCOUNT_NAME = config.bank.accountName;
const CONFIG_PATH = config.paths.config;
const REWARD_CODES_PATH = config.paths.rewardCodes;
const DATA_PATH = config.paths.data;
const LOG_DIR = config.paths.logs;
const FIVEM_STATUS_URL = config.fivem.url;
const FIVEM_HOST = config.fivem.host;
const FIVEM_PORT = config.fivem.port;

// Discord client init
let discordConfigured = Boolean(BOT_TOKEN && GUILD_ID && ROLE_ID);
let client = null;
if (discordConfigured) {
  client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  client.once('ready', () => {
    console.log(`Discord client logged in as ${client.user.tag}`);
  });
  client.login(BOT_TOKEN).catch(err => {
    console.error('Failed to login Discord client:', err);
    // don't crash the whole process - mark as not configured
    discordConfigured = false;
  });
} else {
  console.warn('[WARN] Discord is not configured. Set BOT_TOKEN, GUILD_ID, ROLE_ID in environment variables.');
}

// ---------- Data + persistence ----------
const userPoints = new Map();
const userRegistry = new Map();
const userHistory = new Map();

const rewardCodes = []; // will fill from file if exists
const redeemedCodes = new Map(); // userId -> Set(codeTypes)
const rewardClaims = new Map(); // rewardId -> { count, claims: Map }

if (fs.existsSync(REWARD_CODES_PATH)) {
  try {
    const raw = fs.readFileSync(REWARD_CODES_PATH, 'utf8');
    raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(code => rewardCodes.push(code));
  } catch (e) {
    console.warn('Could not read reward codes file:', e.message);
  }
}

const loadData = () => {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
      if (raw.userPoints) Object.entries(raw.userPoints).forEach(([k, v]) => userPoints.set(k, Number(v)));
      if (raw.userRegistry) Object.values(raw.userRegistry).forEach(u => { if (u && u.id) userRegistry.set(u.id, u); });
      if (raw.userHistory) Object.entries(raw.userHistory).forEach(([k, v]) => userHistory.set(k, v));
    }
  } catch (err) {
    console.warn('Failed to load data.json:', err.message);
  }
};

let saveTimer = null;
const saveData = () => {
  try { if (saveTimer) clearTimeout(saveTimer); } catch {}
  saveTimer = setTimeout(() => {
    try {
      const json = {
        userPoints: Object.fromEntries(Array.from(userPoints.entries())),
        userRegistry: Object.fromEntries(Array.from(userRegistry.entries()).map(([k, v]) => [k, v])),
        userHistory: Object.fromEntries(Array.from(userHistory.entries()).map(([k, v]) => [k, v])),
      };
      fs.writeFileSync(DATA_PATH, JSON.stringify(json, null, 2), 'utf8');
      // write a snapshot file for quick frontend reading
      try {
        const snapshot = {
          users: Array.from(userRegistry.entries()).map(([id, u]) => ({
            userId: id, username: u.username || 'USER', discriminator: u.discriminator || '', avatar: u.avatar || '', createdAt: u.createdAt || null, balance: userPoints.get(id) || 0
          })),
          histories: Object.fromEntries(Array.from(userHistory.entries()).map(([id, h]) => [id, h])),
          updatedAt: Date.now()
        };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
      } catch (e) {}
    } catch (err) {
      console.warn('Failed to save data.json:', err.message);
    }
  }, 300);
};

loadData();
saveData(); // ensure snapshot exists

// Serve static with tuned cache headers (safe)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    try {
      const ext = (filePath.split('.').pop() || '').toLowerCase();
      const longCache = ['png','jpg','jpeg','gif','webp','svg','ico','css','js','woff','woff2'];
      if (longCache.includes(ext)) {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7 days
      }
      if (ext === 'html' || /\b(index|main|shop|roles|rewards|topup)\.html$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
      if (filePath.endsWith('config.txt') || filePath.endsWith('data.json')) {
        res.setHeader('Cache-Control', 'no-store');
      }
    } catch {}
  }
}));

// --- FiveM status proxy
app.get('/fivem/status', async (_req, res) => {
  try {
    if (!fetchFn) return res.send({ success: true, clients: 0, max: 0, note: 'Fetch unavailable' });

    let base = '';
    if (FIVEM_STATUS_URL) {
      base = FIVEM_STATUS_URL.replace(/\/$/, '');
    } else if (FIVEM_HOST && FIVEM_PORT) {
      base = `http://${FIVEM_HOST}:${FIVEM_PORT}`;
    } else {
      return res.send({ success: true, clients: 0, max: 0, note: 'Not configured' });
    }

    const [infoResp, playersResp] = await Promise.all([
      fetchFn(base + '/info.json').catch(() => null),
      fetchFn(base + '/players.json').catch(() => null)
    ]);

    let max = 0, clients = 0;
    if (infoResp && infoResp.ok) {
      const info = await infoResp.json().catch(() => null);
      if (info && typeof info.vars?.sv_maxClients !== 'undefined') {
        const n = Number(info.vars.sv_maxClients);
        if (Number.isFinite(n)) max = n;
      } else if (typeof info?.maxPlayers !== 'undefined') {
        const n = Number(info.maxPlayers);
        if (Number.isFinite(n)) max = n;
      }
    }
    if (playersResp && playersResp.ok) {
      const arr = await playersResp.json().catch(() => []);
      if (Array.isArray(arr)) clients = arr.length;
    }
    return res.send({ success: true, clients, max });
  } catch (err) {
    return res.status(500).send({ success: false, message: String(err) });
  }
});

// Helper: send role - endpoints rely on these constants; ensure Discord client available
app.post('/give-role', async (req, res) => {
  if (!discordConfigured || !client) {
    return res.status(503).send({ success: false, message: 'Discord integration is not configured on the server' });
  }
  const { discordId } = req.body;
  if (!discordId) return res.status(400).send({ success: false, message: "Missing Discord ID" });

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) return res.status(500).send({ success:false, message:'Guild not found' });

    const me = await guild.members.fetchMe();
    if (!me) return res.status(500).send({ success:false, message:'Bot is not a member of the guild' });

    const role = await guild.roles.fetch(ROLE_ID);
    if (!role) return res.status(400).send({ success:false, message:'Target role not found in guild' });

    const canManage = me.permissions.has(PermissionsBitField.Flags.ManageRoles);
    if (!canManage) return res.status(403).send({ success:false, message:'Bot lacks Manage Roles permission' });
    if (me.roles.highest.comparePositionTo(role) <= 0) {
      return res.status(403).send({ success:false, message:'Bot role is not high enough to assign the target role' });
    }

    const member = await guild.members.fetch(discordId).catch((e) => { console.error('fetch member error:', e); return null; });
    if (!member) return res.status(404).send({ success:false, message:'Member not found in guild' });

    const has = member.roles.cache.has(ROLE_ID);
    if (!has) {
      await member.roles.add(role.id);
      console.log(`[give-role] Granted role ${role.id} to ${member.id} in guild ${guild.id}`);
      return res.send({ success: true, already: false });
    }
    console.log(`[give-role] Already had role ${role.id} for ${member.id}`);
    return res.send({ success: true, already: true });
  } catch (err) {
    console.error('give-role error:', err);
    const code = err.code || err.status || 500;
    return res.status(500).send({ success: false, message: err.message || String(err), code });
  }
});

// has-role
app.get('/has-role', async (req, res) => {
  if (!discordConfigured || !client) {
    return res.send({ success: true, has: false, note: 'Discord not configured' });
  }
  const discordId = req.query.discordId;
  if (!discordId) return res.status(400).send({ success: false, message: 'Missing Discord ID' });
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) return res.status(500).send({ success:false, message:'Guild not found' });
    const role = await guild.roles.fetch(ROLE_ID);
    if (!role) return res.status(400).send({ success:false, message:'Target role not found in guild' });
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) return res.send({ success: true, has: false, note:'Member not in guild' });
    const has = member.roles.cache.has(role.id);
    return res.send({ success: true, has });
  } catch (err) {
    console.error('has-role error:', err);
    const code = err.code || err.status || 500;
    return res.status(500).send({ success: false, message: err.message || String(err), code });
  }
});

// health
app.get('/health', (_req, res) => {
  res.send({
    ok: true,
    guildId: GUILD_ID || null,
    roleId: ROLE_ID || null,
    discordConfigured,
    twPhone: TW_PHONE,
    bankName: BANK_NAME,
    bankNo: BANK_ACCOUNT_NO,
    bankAccName: BANK_ACCOUNT_NAME,
    fivem: { url: FIVEM_STATUS_URL, host: FIVEM_HOST, port: FIVEM_PORT }
  });
});

// reset-at marker (simple example)
let RESET_AT = Date.now();
app.get('/reset-at', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.send({ success: true, resetAt: RESET_AT });
});

// public config
app.get('/config', (_req, res) => {
  res.send({ success: true, twPhone: TW_PHONE, bankName: BANK_NAME, bankNo: BANK_ACCOUNT_NO, bankAccName: BANK_ACCOUNT_NAME });
});

// join-guild
app.post('/join-guild', async (req, res) => {
  if (!discordConfigured || !client) return res.status(503).send({ success: false, message: 'Discord integration is not configured on the server' });
  const { userId, accessToken, guildId } = req.body || {};
  const targetGuildId = guildId || GUILD_ID;
  if (!userId || !accessToken) return res.status(400).send({ success: false, message: 'Missing userId or accessToken' });
  if (!targetGuildId) return res.status(400).send({ success: false, message: 'Missing guildId' });
  try {
    const guild = await client.guilds.fetch(targetGuildId);
    if (!guild) return res.status(404).send({ success:false, message:'Guild not found' });
    const existing = await guild.members.fetch(userId).catch(()=>null);
    if (existing) return res.send({ success:true, already:true });
    await guild.members.add(userId, { accessToken });
    return res.send({ success:true, already:false });
  } catch (err) {
    console.error('join-guild error:', err);
    const code = err.code || err.status || 500;
    return res.status(500).send({ success:false, message: err.message || String(err), code });
  }
});

// Minimal admin guard
const requireAdmin = (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.query.adminKey || (req.body && req.body.adminKey);
  if (ADMIN_KEY && key === ADMIN_KEY) return next();
  const adminId = req.headers['x-admin-user'] || req.query.adminId || (req.body && req.body.adminId);
  if (ADMIN_IDS.length && adminId && ADMIN_IDS.includes(String(adminId))) return next();
  return res.status(403).send({ success:false, message:'Forbidden' });
};

// Admin endpoints (users, user, clear, etc.)
app.get('/admin/check', (req, res) => {
  const adminId = req.query.userId;
  const ok = !!(ADMIN_IDS.length && adminId && ADMIN_IDS.includes(String(adminId)));
  const viaKey = !!ADMIN_KEY; // indicates key mode available
  res.send({ success:true, isAdmin: ok, keyMode: viaKey });
});

app.get('/admin/users', requireAdmin, (_req, res) => {
  const ids = new Set();
  for(const k of userRegistry.keys()) ids.add(k);
  for(const k of userHistory.keys()) ids.add(k);
  for(const k of userPoints.keys()) ids.add(k);
  const users = Array.from(ids).map(id=>{
    const u = userRegistry.get(id) || { id, username:'USER', discriminator:'', avatar:'', createdAt:null };
    return {
      userId: id,
      username: u.username || 'USER',
      discriminator: u.discriminator || '',
      avatar: u.avatar || '',
      createdAt: u.createdAt || null,
      balance: userPoints.get(id) || 0,
    };
  });
  res.send({ success:true, users });
});

app.get('/admin/user', requireAdmin, async (req, res) => {
  const userId = req.query.userId;
  if(!userId) return res.status(400).send({ success:false, message:'Missing userId' });
  const base = userRegistry.get(userId) || null;
  const hist = userHistory.get(userId) || { topups: [], purchases: [], rewards: [] };
  let joinedAt = null;
  try{
    if(discordConfigured && client){
      const guild = await client.guilds.fetch(GUILD_ID);
      if(guild){
        const member = await guild.members.fetch(userId).catch(()=>null);
        if(member && member.joinedTimestamp) joinedAt = member.joinedTimestamp;
      }
    }
  }catch{}
  return res.send({ success:true, user: base && { ...base, balance: userPoints.get(userId) || 0, joinedAt }, history: hist });
});

// Admin delete purchase
app.post('/admin/purchase/delete', requireAdmin, (req, res) => {
  const { userId, productId, ts, refund } = req.body || {};
  if(!userId || !productId) return res.status(400).send({ success:false, message:'Missing userId or productId' });
  const hist = userHistory.get(userId) || { topups: [], purchases: [], rewards: [] };
  const purchases = Array.isArray(hist.purchases) ? hist.purchases : [];
  const idx = purchases.findIndex(p => p && p.productId === productId && (ts ? p.ts === Number(ts) : true));
  if(idx === -1){ return res.status(404).send({ success:false, message:'Purchase not found' }); }
  const [removed] = purchases.splice(idx, 1);
  hist.purchases = purchases;
  userHistory.set(userId, hist);
  let balance = userPoints.get(userId) || 0;
  const doRefund = !!refund && removed && Number.isFinite(Number(removed.amount));
  if(doRefund){
    balance = userPoints.get(userId) || 0;
    userPoints.set(userId, balance + Number(removed.amount));
    saveData();
    balance = userPoints.get(userId);
  } else {
    saveData();
  }
  return res.send({ success:true, balance, removed });
});

// Admin clear all purchases & reset points
app.post('/admin/purchases/clear_all', requireAdmin, (req, res) => {
  try{
    let clearedPurchases = 0;
    let clearedRewards = 0;
    let resetPoints = 0;
    for(const [uid, hist] of userHistory.entries()){
      if(hist && Array.isArray(hist.purchases) && hist.purchases.length){
        clearedPurchases += hist.purchases.length;
        hist.purchases = [];
      }
      if(hist && Array.isArray(hist.rewards) && hist.rewards.length){
        clearedRewards += hist.rewards.length;
        hist.rewards = [];
      }
      userHistory.set(uid, hist);
      const cur = userPoints.get(uid) || 0;
      if(cur !== 0){ userPoints.set(uid, 0); resetPoints++; }
    }
    saveData();
    return res.send({ success:true, clearedPurchases, clearedRewards, resetPoints });
  }catch(err){
    return res.status(500).send({ success:false, message:String(err) });
  }
});

// Admin clear all
app.post('/admin/clear_all', requireAdmin, (_req, res) => {
  try{
    userPoints.clear();
    userRegistry.clear();
    userHistory.clear();
    RESET_AT = Date.now();
    saveData();
    return res.send({ success:true, resetAt: RESET_AT });
  }catch(err){
    return res.status(500).send({ success:false, message:String(err) });
  }
});

// Register user
app.post('/users/register', (req, res) => {
  const { id, username, discriminator, avatar } = req.body || {};
  if(!id || !username) return res.status(400).send({ success:false, message:'Missing id or username' });
  const existing = userRegistry.get(id);
  if(existing){
    userRegistry.set(id, { ...existing, username, discriminator, avatar });
  } else {
    userRegistry.set(id, { id, username, discriminator, avatar, createdAt: Date.now() });
    if(!userHistory.has(id)) userHistory.set(id, { topups: [], purchases: [], rewards: [] });
  }
  saveData();
  res.send({ success:true });
});

// user history
app.get('/history', (req, res) => {
  const userId = req.query.userId;
  if(!userId) return res.status(400).send({ success:false, message:'Missing userId' });
  const hist = userHistory.get(userId) || { topups: [], purchases: [], rewards: [] };
  const user = userRegistry.get(userId) || null;
  const balance = userPoints.get(userId) || 0;
  res.send({ success:true, history: hist, user: user && { ...user, balance } });
});

// Basic products & points helpers
const products = {
  vip_new_1_pack: { id: 'vip_new_1_pack', name: 'VIP NEW 1 PACK', price: 1299 },
  sweet_desert_daily: { id: 'sweet_desert_daily', name: 'SWEET DESERT DAILY PACK', price: 99 },
  sweet_desert_basic: { id: 'sweet_desert_basic', name: 'SWEET DESERT BASIC PACK', price: 399 },
};

const addPoints = (userId, amount) => {
  const current = userPoints.get(userId) || 0;
  userPoints.set(userId, current + amount);
  saveData();
  return userPoints.get(userId);
};

// check-codes
app.get('/api/check-codes', (req, res) => {
  try {
    const availableCodes = rewardCodes.length;
    res.json({ success: true, total: rewardCodes.length, remaining: Math.max(0, availableCodes), redeemed: 0 });
  } catch (err) {
    console.error('Error checking codes:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// redeem-code (simple)
app.post('/api/redeem-code', (req, res) => {
  try {
    const { codeType, userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });
    const userRedeemed = redeemedCodes.get(userId) || new Set();
    if (userRedeemed.has(codeType)) {
      return res.status(400).json({ success: false, message: 'คุณได้รับรหัสนี้ไปแล้ว', error: 'already_redeemed' });
    }
    if (rewardCodes.length <= 0) {
      return res.status(400).json({ success: false, message: 'รหัสหมดแล้ว', error: 'no_codes_available' });
    }
    const randomIndex = Math.floor(Math.random() * rewardCodes.length);
    const code = rewardCodes.splice(randomIndex, 1)[0];
    try { fs.writeFileSync(REWARD_CODES_PATH, rewardCodes.join('\n'), 'utf8'); } catch (e) { console.warn('Could not save reward codes file:', e.message); }
    userRedeemed.add(codeType);
    redeemedCodes.set(userId, userRedeemed);
    res.json({ success: true, message: 'รับรหัสสำเร็จ', code });
  } catch (err) {
    console.error('Error redeeming code:', err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการรับรหัส' });
  }
});

// points get
app.get('/points', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).send({ success:false, message:'Missing userId' });
  const balance = userPoints.get(userId) || 0;
  res.send({ success:true, balance });
});

// shop purchase
app.post('/shop/purchase', async (req, res) => {
  const { userId, productId, gameFirstName, gameLastName, gameUID } = req.body || {};
  if(!userId || !productId) return res.status(400).send({ success:false, message:'Missing userId or productId' });
  const product = products[productId];
  if(!product) return res.status(400).send({ success:false, message:'Invalid productId' });
  const price = Number(product.price) || 0;
  const balance = userPoints.get(userId) || 0;
  const hist = userHistory.get(userId) || { topups: [], purchases: [], rewards: [] };
  const already = (hist.purchases || []).some(p => p && p.productId === productId);
  if(already) return res.status(409).send({ success:false, message:'คุณได้ซื้อสินค้านี้ไปแล้ว' });
  if(balance < price) return res.status(402).send({ success:false, message:'พอยต์ไม่เพียงพอ' });

  const next = Math.max(0, balance - price);
  userPoints.set(userId, next);
  const entry = { ts: Date.now(), item: product.name, productId: product.id, amount: price, meta: { gameFirstName, gameLastName, gameUID } };
  hist.purchases = hist.purchases || [];
  hist.purchases.push(entry);
  userHistory.set(userId, hist);
  saveData();

  // daily logfile
  try{
    const now = new Date();
    const day = now.toISOString().slice(0,10);
    const file = path.join(LOG_DIR, `purchases-${day}.log`);
    const u = userRegistry.get(userId) || { id: userId, username: 'USER', discriminator: '' };
    const payload = {
      ts: now.toISOString(),
      userId,
      username: u.username || 'USER',
      discriminator: u.discriminator || '',
      productId: product.id,
      product: product.name,
      price,
      gameFirstName: gameFirstName || '',
      gameLastName: gameLastName || '',
      gameUID: gameUID || '',
      balanceAfter: userPoints.get(userId) || 0
    };
    const readable = `[${payload.ts}] user=${payload.username}${payload.discriminator&&payload.discriminator!=='0'?('#'+payload.discriminator):''} (${userId}) product=${product.name} price=${price} nameInGame="${(gameFirstName||'')+' '+(gameLastName||'')}" UID=${gameUID||''} balance=${payload.balanceAfter}`;
    fs.appendFile(file, JSON.stringify(payload) + "\n" + readable + "\n", ()=>{});
  }catch(e){ console.warn('log write failed', e.message); }

  // try sending discord embed to purchase channel (best-effort)
  (async()=>{
    try{
      if(discordConfigured && client && PURCHASE_CHANNEL_ID){
        const ch = await client.channels.fetch(PURCHASE_CHANNEL_ID).catch(()=>null);
        if(ch && ch.send){
          const u = userRegistry.get(userId) || { id: userId, username: 'USER' };
          const desc = [
            `\`\`\`👤ชื่อในเกม: ${( (`${gameFirstName||'-'} ${gameLastName||''}` ).trim() || '-')}\`\`\``,
            `\`\`\`🪪UID: ${gameUID||'-'}\`\`\``,
            `\`\`\`🛒สินค้า: ${product.name}\`\`\``,
            `\`\`\`🍪ราคา: ${price} POINT\`\`\``,
            `**<:user:1429692824047325244> ผู้ใช้ Discord: <@${userId}> | (${u.username||'USER'})**`,
          ].join('\n');
          const embed = new EmbedBuilder()
            .setTitle('มีผู้ใช้ใหม่ซื้อสินค้า')
            .setColor(0xffffff)
            .setDescription(desc)
            .setTimestamp(new Date());
          await ch.send({ embeds: [embed] }).catch(()=>{});
        }
      }
    }catch(e){ console.warn('discord notify failed', e && e.message); }
  })();

  return res.send({ success:true, balance: next, item: product.name, price });
});

// points admin
app.post('/points/add', requireAdmin, (req, res) => {
  const { userId, amount } = req.body || {};
  const amt = Number(amount);
  if (!userId || !Number.isFinite(amt)) return res.status(400).send({ success:false, message:'Missing userId or invalid amount' });
  const balance = addPoints(userId, Math.max(0, amt));
  res.send({ success:true, balance });
});

app.post('/points/subtract', requireAdmin, (req, res) => {
  const { userId, amount } = req.body || {};
  const amt = Number(amount);
  if (!userId || !Number.isFinite(amt)) return res.status(400).send({ success:false, message:'Missing userId or invalid amount' });
  const current = userPoints.get(userId) || 0;
  const next = Math.max(0, current - Math.max(0, amt));
  userPoints.set(userId, next);
  saveData();
  res.send({ success:true, balance: next });
});

// topup promptpay (demo)
app.post('/topup/promptpay', (req, res) => {
  const { userId, amount, slipData } = req.body || {};
  if(!userId) return res.status(400).send({ success:false, message:'Missing userId' });
  let amt = Number(amount);
  if(!Number.isFinite(amt) || amt <= 0){
    try{
      const text = typeof slipData === 'string' ? slipData : '';
      const matches = text.match(/(\d{2,6})/g);
      if(matches && matches.length){
        const picked = Number(matches[matches.length-1]);
        if(Number.isFinite(picked) && picked > 0) amt = picked;
      }
    }catch{}
  }
  if(!Number.isFinite(amt) || amt <= 0) amt = 100;
  const balance = addPoints(userId, amt);
  const hist = userHistory.get(userId) || { topups: [], purchases: [], rewards: [] };
  hist.topups.push({ ts: Date.now(), method: 'promptpay', amount: amt, balance });
  userHistory.set(userId, hist);
  saveData();
  res.send({ success:true, balance, detectedAmount: amt });
});

// topup truewallet (simple)
app.post('/topup/truewallet', (req, res) => {
  const { userId, amount, envelopeLink } = req.body || {};
  if(!userId || !amount || !envelopeLink) return res.status(400).send({ success:false, message:'Missing userId, amount or envelopeLink' });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).send({ success:false, message:'Invalid amount' });
  const balance = addPoints(userId, amt);
  const hist = userHistory.get(userId) || { topups: [], purchases: [], rewards: [] };
  hist.topups.push({ ts: Date.now(), method: 'truewallet', amount: amt, balance, envelopeLink });
  userHistory.set(userId, hist);
  saveData();
  res.send({ success:true, balance });
});

// auto truewallet simulation
const autoJobs = new Map();
app.post('/topup/truewallet/auto', (req, res) => {
  const { userId, envelopeLink } = req.body || {};
  if(!userId || !envelopeLink) return res.status(400).send({ success:false, message:'Missing userId or envelopeLink' });
  let amt = 0;
  try{
    const u = new URL(envelopeLink);
    const qsAmt = Number(u.searchParams.get('amount'));
    if(Number.isFinite(qsAmt) && qsAmt > 0) amt = qsAmt;
  }catch{}
  if(!amt){
    const m = String(envelopeLink).match(/(\d{2,5})/);
    if(m) amt = Number(m[1]);
  }
  if(!Number.isFinite(amt) || amt <= 0) amt = 100;
  const jobId = 'tw_' + Math.random().toString(36).slice(2);
  autoJobs.set(jobId, { status:'pending', userId, amount: amt });
  setTimeout(() => {
    try{
      const balance = addPoints(userId, amt);
      autoJobs.set(jobId, { status:'success', userId, amount: amt, balance });
      const hist = userHistory.get(userId) || { topups: [], purchases: [], rewards: [] };
      hist.topups.push({ ts: Date.now(), method: 'truewallet-auto', amount: amt, balance });
      userHistory.set(userId, hist);
      saveData();
    }catch(err){
      autoJobs.set(jobId, { status:'failed', userId, amount: amt });
    }
  }, 5000);
  res.send({ success:true, jobId });
});
app.get('/topup/truewallet/status', (req, res) => {
  const { jobId } = req.query;
  if(!jobId) return res.status(400).send({ success:false, message:'Missing jobId' });
  const job = autoJobs.get(jobId);
  if(!job) return res.status(404).send({ success:false, message:'Job not found' });
  res.send({ success:true, ...job });
});

// join-position
app.get('/join-position', async (req, res) => {
  if (!discordConfigured || !client) return res.status(503).send({ success: false, message: 'Discord integration is not configured on the server' });
  const discordId = req.query.discordId;
  const targetGuildId = req.query.guildId || GUILD_ID;
  if (!discordId) return res.status(400).send({ success: false, message: 'Missing Discord ID' });
  if (!targetGuildId) return res.status(400).send({ success: false, message: 'Missing Guild ID' });
  try {
    const guild = await client.guilds.fetch(targetGuildId);
    if (!guild) return res.status(404).send({ success:false, message:'Guild not found' });
    const collection = await guild.members.fetch();
    const members = Array.from(collection.values()).filter(m => !!m.joinedTimestamp);
    if (!members.length) return res.send({ success: true, found: false, total: 0 });
    members.sort((a,b) => (a.joinedTimestamp||0) - (b.joinedTimestamp||0));
    const index = members.findIndex(m => m.id === discordId);
    if (index === -1) return res.send({ success: true, found: false, total: members.length });
    return res.send({ success: true, found: true, position: index + 1, total: members.length });
  } catch (err) {
    console.error('join-position error:', err);
    const code = err.code || err.status || 500;
    return res.status(500).send({ success: false, message: err.message || String(err), code });
  }
});

// mount external routes if exists
try {
  const routesPath = path.join(__dirname, 'routes', 'api.js');
  if (fs.existsSync(routesPath)) {
    app.use('/api', require(routesPath));
  }
} catch (e) { console.warn('Could not mount ./routes/api:', e.message); }

// fallback static (already added above) and error handler
app.use((err, req, res, next) => {
  console.error('Error:', err && err.stack ? err.stack : err);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start server (single listener)
const PORT = process.env.PORT || 20087;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));

// exports for tests or usage
module.exports = { app, client, config };
