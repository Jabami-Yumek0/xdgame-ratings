// ==UserScript==
// @name         XDGAME 游戏评分助手
// @namespace    https://www.xdgame.com/
// @version      2.1.0
// @description  在 XDGAME 游戏列表和更新记录中显示小黑盒评分、全语言好评率与当前在线人数。
// @author       LIU
// @homepageURL  https://github.com/Jabami-Yumek0/xdgame-ratings
// @supportURL   https://github.com/Jabami-Yumek0/xdgame-ratings/issues
// @updateURL    https://raw.githubusercontent.com/Jabami-Yumek0/xdgame-ratings/main/xdgame-ratings.user.js
// @downloadURL  https://raw.githubusercontent.com/Jabami-Yumek0/xdgame-ratings/main/xdgame-ratings.user.js
// @match        *://xdgame.com/*
// @match        *://*.xdgame.com/*
// @connect      api.xiaoheihe.cn
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  const VERSION = "2.1.0";
  const CACHE_PREFIX = "xdgr:v3:rating:";
  const CACHE_TTL_MS = 15 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 12_000;
  const MAX_CONCURRENT_REQUESTS = 4;

  const settings = {
    steamEnabled: GM_getValue("steamEnabled", true),
    heyboxEnabled: GM_getValue("heyboxEnabled", true),
    onlineEnabled: GM_getValue("onlineEnabled", true)
  };

  let activeRequests = 0;
  const queue = [];
  const pendingRequests = new Map();
  const pendingAppIdRequests = new Map();

  addStyles();
  registerMenus();
  scanCards();
  observePage();

  function registerMenus() {
    GM_registerMenuCommand(
      `${settings.steamEnabled ? "✅" : "⬜"} 全语言好评率（点击${settings.steamEnabled ? "关闭" : "开启"}）`,
      () => {
        GM_setValue("steamEnabled", !settings.steamEnabled);
        location.reload();
      }
    );

    GM_registerMenuCommand(
      `${settings.heyboxEnabled ? "✅" : "⬜"} 小黑盒评分/心愿单（点击${settings.heyboxEnabled ? "关闭" : "开启"}）`,
      () => {
        GM_setValue("heyboxEnabled", !settings.heyboxEnabled);
        location.reload();
      }
    );

    GM_registerMenuCommand(
      `${settings.onlineEnabled ? "✅" : "⬜"} 当前在线人数（点击${settings.onlineEnabled ? "关闭" : "开启"}）`,
      () => {
        GM_setValue("onlineEnabled", !settings.onlineEnabled);
        location.reload();
      }
    );

    GM_registerMenuCommand("🔄 清除数据缓存并刷新", () => {
      for (const key of GM_listValues()) {
        if (key.startsWith("xdgr:")) {
          GM_deleteValue(key);
        }
      }
      location.reload();
    });

    GM_registerMenuCommand(`ℹ️ 当前版本 ${VERSION}`, () => {});
  }

  function scanCards() {
    const cards = document.querySelectorAll(
      ".game-list > li, .update-page .tab-panel.ing > li"
    );
    for (const card of cards) {
      if (card.dataset.xdgrState) {
        continue;
      }

      card.dataset.xdgrState = "pending";
      const container = ensureContainer(card, "");
      renderLoading(container);

      enqueue(async () => {
        const title = card.querySelector(".tit")?.textContent?.trim() || "";
        try {
          const appId = await resolveSteamAppId(card);
          if (!appId) {
            renderMissingId(card, container);
            return;
          }
          card.dataset.xdgrLoaded = appId;
          card.dataset.xdgrState = "loaded";
          container.dataset.appId = appId;
          const data = await getRatings(appId, title);
          renderRatings(container, data);
        } catch (error) {
          card.dataset.xdgrState = "error";
          renderError(container, error.message || "未知错误");
        }
      });
    }
  }

  async function resolveSteamAppId(card) {
    const directAppId = findSteamAppId(card);
    if (directAppId) {
      return directAppId;
    }

    const gameLink = card.querySelector(':scope > a.tit[href*="/game/"]');
    if (!gameLink) {
      return null;
    }

    const gameUrl = new URL(gameLink.href, location.href);
    const cacheKey = `xdgr:v3:app-id:${gameUrl.pathname}`;
    const cached = GM_getValue(cacheKey, null);
    if (/^\d+$/.test(String(cached?.appId || ""))) {
      return String(cached.appId);
    }

    if (pendingAppIdRequests.has(gameUrl.pathname)) {
      return pendingAppIdRequests.get(gameUrl.pathname);
    }

    const request = fetchSteamAppIdFromGamePage(gameUrl.href)
      .then((appId) => {
        if (appId) {
          GM_setValue(cacheKey, { appId, savedAt: Date.now() });
        }
        return appId;
      })
      .finally(() => pendingAppIdRequests.delete(gameUrl.pathname));
    pendingAppIdRequests.set(gameUrl.pathname, request);
    return request;
  }

  async function fetchSteamAppIdFromGamePage(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`XDGAME 详情页 HTTP ${response.status}`);
      }
      const html = await response.text();
      const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
      const scope = article || html;
      const match = scope.match(/\/steam\/apps\/(\d+)\//i)
        || scope.match(/\/store_item_assets\/steam\/apps\/(\d+)\//i)
        || scope.match(/\/store_trailers\/(\d+)\//i);
      return match ? match[1] : null;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("XDGAME 详情页请求超时");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function findSteamAppId(card) {
    for (const image of card.querySelectorAll("img")) {
      for (const attr of ["src", "data-original", "data-src"]) {
        const value = image.getAttribute(attr) || "";
        const match = value.match(/\/steam\/apps\/(\d+)\//i)
          || value.match(/\/apps\/(\d+)\//i);
        if (match) {
          return match[1];
        }
      }
    }
    return null;
  }

  async function getRatings(appId, title) {
    const cacheKey = `${CACHE_PREFIX}${appId}`;
    const cached = GM_getValue(cacheKey, null);
    if (
      cached
      && Date.now() - cached.savedAt < CACHE_TTL_MS
      && cacheCoversEnabledSources(cached.data)
    ) {
      return { ...cached.data, cached: true };
    }

    if (pendingRequests.has(appId)) {
      return pendingRequests.get(appId);
    }

    const request = loadRatings(appId, title)
      .finally(() => pendingRequests.delete(appId));
    pendingRequests.set(appId, request);
    return request;
  }

  function cacheCoversEnabledSources(data) {
    return (!settings.steamEnabled || data?.steam)
      && (!settings.heyboxEnabled || data?.heybox)
      && (!settings.onlineEnabled || data?.online);
  }

  async function loadRatings(appId, title) {
    const data = {
      appId,
      steam: null,
      heybox: null,
      online: null,
      fetchedAt: Date.now()
    };

    if (settings.steamEnabled || settings.heyboxEnabled || settings.onlineEnabled) {
      try {
        Object.assign(data, await fetchHeyboxBundle(appId, title));
      } catch (error) {
        const unavailable = {
          available: false,
          reason: "小黑盒数据请求失败",
          error: error.message || "未知错误"
        };
        if (settings.steamEnabled) data.steam = { ...unavailable };
        if (settings.heyboxEnabled) data.heybox = { ...unavailable };
        if (settings.onlineEnabled) data.online = { ...unavailable };
      }
    }

    GM_setValue(`${CACHE_PREFIX}${appId}`, {
      savedAt: Date.now(),
      data
    });

    return { ...data, cached: false };
  }

  async function fetchHeyboxBundle(appId, title) {
    const detailPath = "/game/get_game_detail/";
    const reviewPath = "/game/detail/review_graph";
    const detailRequest = requestJson(
      buildHeyboxApiUrl(detailPath, { steam_appid: appId }),
      "https://www.xiaoheihe.cn/"
    );
    const reviewRequest = settings.steamEnabled
      ? requestJson(
        buildHeyboxApiUrl(reviewPath, { appid: appId }),
        "https://web.xiaoheihe.cn/"
      )
      : Promise.resolve(null);

    const [detailSettled, reviewSettled] = await Promise.allSettled([
      detailRequest,
      reviewRequest
    ]);
    const detailPayload = detailSettled.status === "fulfilled"
      ? detailSettled.value
      : null;
    const reviewPayload = reviewSettled.status === "fulfilled"
      ? reviewSettled.value
      : null;
    const detail = detailPayload?.status === "ok" ? detailPayload.result : null;
    const review = reviewPayload?.status === "ok" ? reviewPayload.result : null;
    const pageUrl = `https://www.xiaoheihe.cn/app/topic/game/pc/${appId}`;

    return {
      steam: settings.steamEnabled
        ? makeLanguageRatingResult(detail, review, appId)
        : null,
      heybox: settings.heyboxEnabled
        ? makeHeyboxScoreResult(detail, pageUrl, title)
        : null,
      online: settings.onlineEnabled
        ? makeOnlineResult(detail, pageUrl)
        : null
    };
  }

  function makeLanguageRatingResult(detail, review, appId) {
    const summary = review?.summary || {};
    const metric = findGameMetric(detail, "全语言好评率");
    const percent = parsePercent(summary.total_percent)
      ?? parsePercent(metricDisplayValue(metric));
    const total = toFiniteNumber(summary.total_count);

    if (percent === null) {
      return {
        available: false,
        reason: "小黑盒暂无全语言好评率"
      };
    }

    return {
      available: true,
      percent: Math.round(percent),
      total,
      source: "小黑盒全语言好评率",
      url: `https://web.xiaoheihe.cn/account/game_statistic/favour_rate?appid=${appId}`
    };
  }

  function makeHeyboxScoreResult(detail, pageUrl, title) {
    if (!detail) {
      return {
        available: false,
        reason: "小黑盒游戏数据暂不可用",
        title
      };
    }

    const score = toFiniteNumber(detail.score);
    const scoreCount = toFiniteNumber(detail.comment_stats?.score_comment);
    const hasScore = score !== null
      && score >= 0
      && score <= 10
      && (score > 0 || (scoreCount !== null && scoreCount > 0));
    if (hasScore) {
      return {
        available: true,
        displayType: "rating",
        value: score,
        scale: 10,
        count: scoreCount,
        url: pageUrl
      };
    }

    const wishlistCount = toFiniteNumber(detail.follow_num)
      ?? toFiniteNumber(detail.comment_stats?.expect_num);
    if (wishlistCount !== null && wishlistCount >= 0) {
      return {
        available: true,
        displayType: "wishlist",
        wishlistCount,
        url: pageUrl
      };
    }

    return {
      available: false,
      reason: "小黑盒暂无评分或心愿单数据",
      title
    };
  }

  function makeOnlineResult(detail, pageUrl) {
    const metric = findGameMetric(detail, "当前在线");
    const displayValue = metricDisplayValue(metric);
    const count = parseWishlistCount(displayValue);
    if (!displayValue || displayValue === "-" || count === null) {
      return {
        available: false,
        reason: "小黑盒暂无当前在线数据"
      };
    }

    return {
      available: true,
      displayValue,
      count,
      url: pageUrl
    };
  }

  function findGameMetric(detail, label) {
    return detail?.user_num?.game_data?.find((item) => item?.desc === label) || null;
  }

  function metricDisplayValue(metric) {
    const richText = metric?.hb_rich_text?.attrs
      ?.filter((item) => item?.type === "text" && item.text !== undefined)
      .map((item) => String(item.text))
      .join("");
    return (richText || metric?.value || "").trim();
  }

  function parsePercent(value) {
    if (typeof value !== "string" && typeof value !== "number") {
      return null;
    }
    const match = String(value).match(/(\d+(?:\.\d+)?)\s*%?/);
    if (!match) {
      return null;
    }
    const percent = Number(match[1]);
    return Number.isFinite(percent) && percent >= 0 && percent <= 100
      ? percent
      : null;
  }

  function buildHeyboxApiUrl(path, query) {
    const time = Math.floor(Date.now() / 1000);
    const nonce = md5Hex(`${time}:${Date.now()}:${Math.random()}`).toUpperCase();
    const params = new URLSearchParams({
      app: "heybox",
      os_type: "web",
      x_app: "heybox_website",
      x_client_type: "weboutapp",
      x_os_type: getPlatformName(),
      web_version: "3.0.0",
      device_id: getHeyboxDeviceId(),
      version: "999.0.4",
      hkey: makeHeyboxHkey(path, time, nonce),
      _time: String(time),
      nonce,
      ...query
    });
    return `https://api.xiaoheihe.cn${path}?${params}`;
  }

  function getPlatformName() {
    const platform = navigator.platform || navigator.userAgent || "";
    if (/mac|iphone|ipad/i.test(platform)) return "Mac";
    if (/android/i.test(platform)) return "Android";
    return "Windows";
  }

  function getHeyboxDeviceId() {
    const storageKey = "xdgrHeyboxDeviceId";
    let deviceId = GM_getValue(storageKey, "");
    if (!/^[a-f0-9]{32}$/i.test(deviceId)) {
      deviceId = md5Hex(`${Date.now()}:${Math.random()}:${Math.random()}`);
      GM_setValue(storageKey, deviceId);
    }
    return deviceId;
  }

  function makeHeyboxHkey(path, time, nonce) {
    const alphabet = "AB45STUVWZEFGJ6CH01D237IXYPQRKLMN89";
    const normalizedPath = `/${path.split("/").filter(Boolean).join("/")}/`;
    const mappedTime = mapHkeyChars(String(time + 1), alphabet.slice(0, -2));
    const mappedPath = mapHkeyChars(normalizedPath, alphabet);
    const mappedNonce = mapHkeyChars(nonce, alphabet);
    const mixed = interleaveStrings([mappedTime, mappedPath, mappedNonce]).slice(0, 20);
    const digest = md5Hex(mixed);
    const checksum = String(
      mixHkeyBytes(digest.slice(-6).split("").map((char) => char.charCodeAt(0)))
        .reduce((sum, value) => sum + value, 0) % 100
    ).padStart(2, "0");
    return `${mapHkeyChars(digest.slice(0, 5), alphabet.slice(0, -4))}${checksum}`;
  }

  function mapHkeyChars(value, alphabet) {
    let result = "";
    for (const char of value) {
      result += alphabet[char.charCodeAt(0) % alphabet.length];
    }
    return result;
  }

  function interleaveStrings(values) {
    let result = "";
    const maxLength = Math.max(...values.map((value) => value.length));
    for (let index = 0; index < maxLength; index += 1) {
      for (const value of values) {
        if (index < value.length) result += value[index];
      }
    }
    return result;
  }

  function mixHkeyBytes(bytes) {
    const double = (value) => value & 128
      ? ((value << 1) ^ 27) & 255
      : value << 1;
    const multiply3 = (value) => double(value) ^ value;
    const multiply4 = (value) => multiply3(double(value));
    const multiply8 = (value) => multiply4(multiply3(double(value)));
    const multiply14 = (value) => multiply8(value) ^ multiply4(value) ^ multiply3(value);
    const mixed = [0, 0, 0, 0];
    mixed[0] = multiply14(bytes[0]) ^ multiply8(bytes[1]) ^ multiply4(bytes[2]) ^ multiply3(bytes[3]);
    mixed[1] = multiply3(bytes[0]) ^ multiply14(bytes[1]) ^ multiply8(bytes[2]) ^ multiply4(bytes[3]);
    mixed[2] = multiply4(bytes[0]) ^ multiply3(bytes[1]) ^ multiply14(bytes[2]) ^ multiply8(bytes[3]);
    mixed[3] = multiply8(bytes[0]) ^ multiply4(bytes[1]) ^ multiply3(bytes[2]) ^ multiply14(bytes[3]);
    bytes[0] = mixed[0];
    bytes[1] = mixed[1];
    bytes[2] = mixed[2];
    bytes[3] = mixed[3];
    return bytes;
  }

  function md5Hex(input) {
    const text = unescape(encodeURIComponent(String(input)));
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let index;

    for (index = 64; index <= text.length; index += 64) {
      md5Cycle(state, md5Block(text.substring(index - 64, index)));
    }

    const tail = new Array(16).fill(0);
    const remainder = text.substring(index - 64);
    for (index = 0; index < remainder.length; index += 1) {
      tail[index >> 2] |= remainder.charCodeAt(index) << ((index % 4) << 3);
    }
    tail[index >> 2] |= 0x80 << ((index % 4) << 3);
    if (index > 55) {
      md5Cycle(state, tail);
      tail.fill(0);
    }
    tail[14] = text.length * 8;
    md5Cycle(state, tail);
    return state.map(md5HexWord).join("");
  }

  function md5Block(text) {
    const block = [];
    for (let index = 0; index < 64; index += 4) {
      block[index >> 2] = text.charCodeAt(index)
        + (text.charCodeAt(index + 1) << 8)
        + (text.charCodeAt(index + 2) << 16)
        + (text.charCodeAt(index + 3) << 24);
    }
    return block;
  }

  function md5Cycle(state, block) {
    let [a, b, c, d] = state;
    const original = [a, b, c, d];

    a = md5Ff(a, b, c, d, block[0], 7, -680876936);
    d = md5Ff(d, a, b, c, block[1], 12, -389564586);
    c = md5Ff(c, d, a, b, block[2], 17, 606105819);
    b = md5Ff(b, c, d, a, block[3], 22, -1044525330);
    a = md5Ff(a, b, c, d, block[4], 7, -176418897);
    d = md5Ff(d, a, b, c, block[5], 12, 1200080426);
    c = md5Ff(c, d, a, b, block[6], 17, -1473231341);
    b = md5Ff(b, c, d, a, block[7], 22, -45705983);
    a = md5Ff(a, b, c, d, block[8], 7, 1770035416);
    d = md5Ff(d, a, b, c, block[9], 12, -1958414417);
    c = md5Ff(c, d, a, b, block[10], 17, -42063);
    b = md5Ff(b, c, d, a, block[11], 22, -1990404162);
    a = md5Ff(a, b, c, d, block[12], 7, 1804603682);
    d = md5Ff(d, a, b, c, block[13], 12, -40341101);
    c = md5Ff(c, d, a, b, block[14], 17, -1502002290);
    b = md5Ff(b, c, d, a, block[15], 22, 1236535329);

    a = md5Gg(a, b, c, d, block[1], 5, -165796510);
    d = md5Gg(d, a, b, c, block[6], 9, -1069501632);
    c = md5Gg(c, d, a, b, block[11], 14, 643717713);
    b = md5Gg(b, c, d, a, block[0], 20, -373897302);
    a = md5Gg(a, b, c, d, block[5], 5, -701558691);
    d = md5Gg(d, a, b, c, block[10], 9, 38016083);
    c = md5Gg(c, d, a, b, block[15], 14, -660478335);
    b = md5Gg(b, c, d, a, block[4], 20, -405537848);
    a = md5Gg(a, b, c, d, block[9], 5, 568446438);
    d = md5Gg(d, a, b, c, block[14], 9, -1019803690);
    c = md5Gg(c, d, a, b, block[3], 14, -187363961);
    b = md5Gg(b, c, d, a, block[8], 20, 1163531501);
    a = md5Gg(a, b, c, d, block[13], 5, -1444681467);
    d = md5Gg(d, a, b, c, block[2], 9, -51403784);
    c = md5Gg(c, d, a, b, block[7], 14, 1735328473);
    b = md5Gg(b, c, d, a, block[12], 20, -1926607734);

    a = md5Hh(a, b, c, d, block[5], 4, -378558);
    d = md5Hh(d, a, b, c, block[8], 11, -2022574463);
    c = md5Hh(c, d, a, b, block[11], 16, 1839030562);
    b = md5Hh(b, c, d, a, block[14], 23, -35309556);
    a = md5Hh(a, b, c, d, block[1], 4, -1530992060);
    d = md5Hh(d, a, b, c, block[4], 11, 1272893353);
    c = md5Hh(c, d, a, b, block[7], 16, -155497632);
    b = md5Hh(b, c, d, a, block[10], 23, -1094730640);
    a = md5Hh(a, b, c, d, block[13], 4, 681279174);
    d = md5Hh(d, a, b, c, block[0], 11, -358537222);
    c = md5Hh(c, d, a, b, block[3], 16, -722521979);
    b = md5Hh(b, c, d, a, block[6], 23, 76029189);
    a = md5Hh(a, b, c, d, block[9], 4, -640364487);
    d = md5Hh(d, a, b, c, block[12], 11, -421815835);
    c = md5Hh(c, d, a, b, block[15], 16, 530742520);
    b = md5Hh(b, c, d, a, block[2], 23, -995338651);

    a = md5Ii(a, b, c, d, block[0], 6, -198630844);
    d = md5Ii(d, a, b, c, block[7], 10, 1126891415);
    c = md5Ii(c, d, a, b, block[14], 15, -1416354905);
    b = md5Ii(b, c, d, a, block[5], 21, -57434055);
    a = md5Ii(a, b, c, d, block[12], 6, 1700485571);
    d = md5Ii(d, a, b, c, block[3], 10, -1894986606);
    c = md5Ii(c, d, a, b, block[10], 15, -1051523);
    b = md5Ii(b, c, d, a, block[1], 21, -2054922799);
    a = md5Ii(a, b, c, d, block[8], 6, 1873313359);
    d = md5Ii(d, a, b, c, block[15], 10, -30611744);
    c = md5Ii(c, d, a, b, block[6], 15, -1560198380);
    b = md5Ii(b, c, d, a, block[13], 21, 1309151649);
    a = md5Ii(a, b, c, d, block[4], 6, -145523070);
    d = md5Ii(d, a, b, c, block[11], 10, -1120210379);
    c = md5Ii(c, d, a, b, block[2], 15, 718787259);
    b = md5Ii(b, c, d, a, block[9], 21, -343485551);

    state[0] = md5Add(a, original[0]);
    state[1] = md5Add(b, original[1]);
    state[2] = md5Add(c, original[2]);
    state[3] = md5Add(d, original[3]);
  }

  function md5Common(value, a, b, word, shift, constant) {
    const sum = md5Add(md5Add(a, value), md5Add(word, constant));
    return md5Add((sum << shift) | (sum >>> (32 - shift)), b);
  }

  function md5Ff(a, b, c, d, word, shift, constant) {
    return md5Common((b & c) | ((~b) & d), a, b, word, shift, constant);
  }

  function md5Gg(a, b, c, d, word, shift, constant) {
    return md5Common((b & d) | (c & (~d)), a, b, word, shift, constant);
  }

  function md5Hh(a, b, c, d, word, shift, constant) {
    return md5Common(b ^ c ^ d, a, b, word, shift, constant);
  }

  function md5Ii(a, b, c, d, word, shift, constant) {
    return md5Common(c ^ (b | (~d)), a, b, word, shift, constant);
  }

  function md5Add(a, b) {
    return (a + b) & 0xFFFFFFFF;
  }

  function md5HexWord(value) {
    const characters = "0123456789abcdef";
    let result = "";
    for (let index = 0; index < 4; index += 1) {
      result += characters[(value >> (index * 8 + 4)) & 0x0F]
        + characters[(value >> (index * 8)) & 0x0F];
    }
    return result;
  }

  function requestJson(url, referer) {
    return request(url, "json", referer);
  }

  function request(url, responseType, referer = "") {
    return new Promise((resolve, reject) => {
      const headers = {
        Accept: responseType === "json"
          ? "application/json, text/plain, */*"
          : "text/html,application/xhtml+xml"
      };
      if (referer) {
        headers.Referer = referer;
      }

      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers,
        responseType,
        timeout: REQUEST_TIMEOUT_MS,
        anonymous: true,
        onload(response) {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`HTTP ${response.status}`));
            return;
          }

          if (responseType === "text") {
            resolve(response.responseText || String(response.response || ""));
            return;
          }

          try {
            const payload = typeof response.response === "object" && response.response
              ? response.response
              : JSON.parse(response.responseText);
            resolve(payload);
          } catch (_error) {
            reject(new Error("返回内容不是有效 JSON"));
          }
        },
        ontimeout() {
          reject(new Error("请求超时"));
        },
        onerror() {
          reject(new Error("网络请求失败"));
        }
      });
    });
  }

  function parseWishlistCount(value) {
    if (value && typeof value === "object") {
      for (const key of ["count", "num", "total", "value", "users", "user_count"]) {
        if (Object.hasOwn(value, key)) {
          const nested = parseWishlistCount(value[key]);
          if (nested !== null) {
            return nested;
          }
        }
      }
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== "string") {
      return null;
    }

    const match = value.replace(/,/g, "").trim().match(/(\d+(?:\.\d+)?)\s*(万|w|k)?/i);
    if (!match) {
      return null;
    }
    const number = Number(match[1]);
    const unit = (match[2] || "").toLowerCase();
    const multiplier = unit === "万" || unit === "w" ? 10000 : unit === "k" ? 1000 : 1;
    return Number.isFinite(number) ? number * multiplier : null;
  }

  function toFiniteNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value !== "string") {
      return null;
    }
    const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function ensureContainer(card, appId) {
    let container = card.querySelector(":scope > .xdgr-ratings");
    if (!container) {
      container = document.createElement("div");
      container.className = "xdgr-ratings";
      container.dataset.appId = appId;
      const insertionPoint = card.closest(".update-page")
        ? card.querySelector(":scope > .link")
        : card.querySelector(":scope > .data");
      card.insertBefore(container, insertionPoint || null);
      card.classList.add("xdgr-has-ratings");
      const title = card.querySelector(":scope > .tit");
      if (title && !title.title) {
        title.title = title.textContent.trim();
      }
    }
    return container;
  }

  function renderLoading(container) {
    const elements = [];
    if (settings.steamEnabled) {
      elements.push(makeStatCard({
        type: "steam",
        value: "…",
        sub: "读取评价",
        title: "正在从小黑盒获取全语言好评率",
        loading: true
      }));
    }
    if (settings.heyboxEnabled) {
      elements.push(makeStatCard({
        type: "heybox",
        value: "…",
        sub: "读取评价",
        title: "正在获取小黑盒评分",
        loading: true
      }));
    }
    if (settings.onlineEnabled) {
      elements.push(makeStatCard({
        type: "online",
        value: "…",
        sub: "当前在线",
        title: "正在获取当前在线人数",
        loading: true
      }));
    }
    container.replaceChildren(...elements);
  }

  function renderRatings(container, data) {
    const elements = [];

    if (settings.steamEnabled) {
      elements.push(data.steam?.available
        ? makeStatCard({
          type: "steam",
          value: `${data.steam.percent}%`,
          sub: formatReviewCount(data.steam.total),
          url: data.steam.url,
          title: `Steam 全语言好评率 ${data.steam.percent}%（数据源：小黑盒）`
        })
        : makeStatCard({
          type: "steam",
          value: "--",
          sub: "暂无评价",
          title: data.steam?.reason || data.steam?.error || "未能取得全语言好评率",
          unavailable: true
        }));
    }

    if (settings.heyboxEnabled) {
      if (data.heybox?.available && data.heybox.displayType === "wishlist") {
        elements.push(makeStatCard({
          type: "wishlist",
          value: formatCount(data.heybox.wishlistCount),
          sub: "人想玩",
          url: data.heybox.url,
          title: `小黑盒暂无评分 · ${formatCount(data.heybox.wishlistCount)} 人想玩`
        }));
      } else if (data.heybox?.available) {
        elements.push(makeStatCard({
          type: "heybox",
          value: formatHeyboxScore(data.heybox),
          sub: formatReviewCount(data.heybox.count),
          url: data.heybox.url,
          title: `小黑盒评分 ${formatHeyboxScore(data.heybox)} · ${formatReviewCount(data.heybox.count)}`,
          score: data.heybox.value
        }));
      } else {
        elements.push(makeStatCard({
          type: "heybox",
          value: "--",
          sub: "暂无评价",
          title: data.heybox?.reason || data.heybox?.error || "未能取得小黑盒评分",
          unavailable: true
        }));
      }
    }

    if (settings.onlineEnabled) {
      elements.push(data.online?.available
        ? makeStatCard({
          type: "online",
          value: data.online.displayValue,
          sub: "当前在线",
          url: data.online.url,
          title: `小黑盒当前在线 ${data.online.displayValue}`
        })
        : makeStatCard({
          type: "online",
          value: "--",
          sub: "当前在线",
          title: data.online?.reason || data.online?.error || "未能取得当前在线人数",
          unavailable: true
        }));
    }

    container.replaceChildren(...elements);
    container.classList.toggle("is-cached", Boolean(data.cached));
  }

  function renderError(container, message) {
    container.replaceChildren(makeStatus("评分加载失败", message, "error"));
  }

  function renderMissingId(card, existingContainer = null) {
    if (card.dataset.xdgrMissingId) {
      return;
    }
    card.dataset.xdgrMissingId = "true";
    card.dataset.xdgrState = "missing";
    const container = existingContainer || ensureContainer(card, "");
    container.replaceChildren(makeStatus(
      "未识别 Steam ID",
      "未能从游戏缩略图或详情页识别 Steam AppID",
      "unavailable"
    ));
  }

  function makeStatCard({ type, value, sub, url, title, score, unavailable, loading }) {
    const card = document.createElement(url ? "a" : "div");
    card.className = `xdgr-stat-card ${type}`;
    if (type === "heybox" && Number.isFinite(score)) {
      card.classList.add(`score-band-${getHeyboxScoreBand(score)}`);
    }
    if (unavailable) card.classList.add("unavailable");
    if (loading) card.classList.add("loading");
    card.title = title || "";

    if (url) {
      card.href = url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.addEventListener("click", (event) => event.stopPropagation());
    }

    const main = document.createElement("div");
    main.className = "xdgr-stat-main";
    const icon = makeIcon(type);
    const scoreText = document.createElement("div");
    scoreText.className = "xdgr-stat-value";
    scoreText.textContent = value;
    main.append(icon, scoreText);

    const footer = document.createElement("div");
    footer.className = "xdgr-stat-sub";
    footer.textContent = sub;
    card.append(main, footer);
    return card;
  }

  function makeStatus(text, title, className) {
    const status = document.createElement("div");
    status.className = `xdgr-status ${className}`;
    status.textContent = text;
    status.title = title;
    return status;
  }

  function makeIcon(type) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.classList.add("xdgr-stat-icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("viewBox", "0 0 24 24");

    if (type === "heybox") {
      svg.setAttribute("viewBox", "0 0 17 20");
      const path = document.createElementNS(namespace, "path");
      path.setAttribute("d", "M10.1166 1.6104 13.3311 3.4658 16.2599 5.1538c.1789.1039.2885.2943.2885.4992v8.6651c0 .2049-.1096.3953-.2885.4992l-2.4065 1.3879c-.2309.1328-.5194-.0346-.5194-.3V7.719c0-.2049-.1097-.3953-.2886-.4992l-2.493-1.4398c-.1929-.1097-.4329.0288-.4329.251v2.0083c0 .1904-.1558.3463-.3463.3463H7.2398c-.1904 0-.3462-.1559-.3462-.3463V.3466c0-.2655.2885-.4328.5194-.3l2.7036 1.5638ZM6.882 18.3924l-3.2144-1.8553L.7417 14.8491c-.1789-.1039-.2886-.2944-.2886-.4992V5.6848c0-.2049.1097-.3953.2886-.4992l2.4065-1.388c.2308-.1327.5194.0347.5194.3001v8.1862c0 .2048.1096.3953.2885.4992l2.4931 1.4398c.1933.1097.4328-.0288.4328-.251v-2.0083c0-.1905.1558-.3463.3463-.3463h2.5334c.1905 0 .3463.1558.3463.3463v7.6898c0 .2655-.2886.4328-.5194.3001L6.882 18.3924Z");
      svg.append(path);
      return svg;
    }

    if (type === "wishlist") {
      const path = document.createElementNS(namespace, "path");
      path.setAttribute("d", "M12 21s-8.1-4.8-9.7-10.2C1.1 6.8 3.5 3.5 7 3.5c2 0 3.8 1.1 5 2.7 1.2-1.6 3-2.7 5-2.7 3.5 0 5.9 3.3 4.7 7.3C20.1 16.2 12 21 12 21Z");
      svg.append(path);
      return svg;
    }

    if (type === "online") {
      const head = document.createElementNS(namespace, "circle");
      head.setAttribute("cx", "9");
      head.setAttribute("cy", "8");
      head.setAttribute("r", "3");
      const body = document.createElementNS(namespace, "path");
      body.setAttribute("d", "M3.5 20v-2.2c0-3 2.4-5.3 5.5-5.3s5.5 2.3 5.5 5.3V20H3.5Zm11.4-7.2c2.9.2 5.1 2.4 5.1 5.2v2h-3.4v-2.2c0-1.9-.6-3.6-1.7-5Zm-.6-7.6a3 3 0 0 1 0 5.7 5 5 0 0 0 0-5.7Z");
      svg.append(head, body);
      return svg;
    }

    const largeCircle = document.createElementNS(namespace, "circle");
    largeCircle.setAttribute("cx", "17");
    largeCircle.setAttribute("cy", "7");
    largeCircle.setAttribute("r", "3.2");
    largeCircle.setAttribute("fill", "none");
    largeCircle.setAttribute("stroke", "currentColor");
    largeCircle.setAttribute("stroke-width", "2");
    const smallCircle = document.createElementNS(namespace, "circle");
    smallCircle.setAttribute("cx", "6.2");
    smallCircle.setAttribute("cy", "16.2");
    smallCircle.setAttribute("r", "2.7");
    smallCircle.setAttribute("fill", "none");
    smallCircle.setAttribute("stroke", "currentColor");
    smallCircle.setAttribute("stroke-width", "2");
    const arm = document.createElementNS(namespace, "path");
    arm.setAttribute("d", "M8.4 14.6 14.7 9.2M3.8 15.1.8 13.9");
    arm.setAttribute("fill", "none");
    arm.setAttribute("stroke", "currentColor");
    arm.setAttribute("stroke-linecap", "round");
    arm.setAttribute("stroke-width", "2");
    svg.append(largeCircle, smallCircle, arm);
    return svg;
  }

  function getHeyboxScoreBand(score) {
    if (score >= 9) return 1;
    if (score >= 7) return 2;
    if (score >= 5) return 3;
    return 4;
  }

  function formatHeyboxScore(rating) {
    if (rating.scale === 100) {
      return `${Math.round(rating.value)}%`;
    }
    return Number(rating.value).toFixed(1).replace(/\.0$/, "");
  }

  function formatCount(value) {
    if (!Number.isFinite(value)) {
      return "0";
    }
    return new Intl.NumberFormat("zh-CN", {
      notation: value >= 10000 ? "compact" : "standard",
      maximumFractionDigits: 1
    }).format(value);
  }

  function formatReviewCount(value) {
    return Number.isFinite(value) ? `${formatCount(value)}人评价` : "评价数暂无";
  }

  function enqueue(task) {
    queue.push(task);
    drainQueue();
  }

  function drainQueue() {
    while (activeRequests < MAX_CONCURRENT_REQUESTS && queue.length) {
      const task = queue.shift();
      activeRequests += 1;
      Promise.resolve(task())
        .finally(() => {
          activeRequests -= 1;
          drainQueue();
        });
    }
  }

  function observePage() {
    const observer = new MutationObserver((mutations) => {
      const shouldScan = mutations.some((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          return true;
        }
        return mutation.type === "attributes"
          && mutation.target.matches?.(".update-page .tab-panel")
          && mutation.target.classList.contains("ing");
      });
      if (shouldScan) {
        scanCards();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true
    });
  }

  function addStyles() {
    GM_addStyle(`
      .xdgr-ratings {
        box-sizing: border-box;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(62px, 1fr));
        gap: 5px;
        min-height: 55px;
        order: 4;
        padding: 5px 7px 2px;
        width: 100%;
      }

      .xdgr-stat-card {
        box-sizing: border-box;
        color: #fff;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
        height: 50px;
        min-width: 0;
        overflow: hidden;
        text-align: center;
        text-decoration: none !important;
        transition: filter 120ms ease, transform 120ms ease, box-shadow 120ms ease;
      }

      a.xdgr-stat-card:hover {
        filter: brightness(1.04);
        transform: translateY(-1px);
        box-shadow: 0 3px 8px rgba(27, 37, 51, .16);
      }

      .xdgr-stat-main {
        align-items: center;
        background: #577188;
        border-radius: 6px 6px 0 0;
        box-sizing: border-box;
        display: flex;
        flex: 0 0 32px;
        gap: 4px;
        justify-content: center;
        min-width: 0;
        padding: 0 4px;
      }

      .xdgr-stat-sub {
        align-items: center;
        background: #f3f4f5;
        border-radius: 0 0 6px 6px;
        box-sizing: border-box;
        color: #222831;
        display: flex;
        flex: 0 0 18px;
        font-size: 9.5px;
        font-weight: 500;
        justify-content: center;
        line-height: 18px;
        min-width: 0;
        overflow: hidden;
        padding: 0 2px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .xdgr-stat-icon {
        color: currentColor;
        fill: currentColor;
        flex: 0 0 auto;
        height: 17px;
        width: 17px;
      }

      .xdgr-stat-value {
        font-size: 16px;
        font-variant-numeric: tabular-nums;
        font-weight: 900;
        letter-spacing: -.4px;
        line-height: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .xdgr-stat-card.steam .xdgr-stat-main {
        background: linear-gradient(135deg, #1b4f74, #2a78a7);
      }

      .xdgr-stat-card.heybox.score-band-1 .xdgr-stat-main {
        background: linear-gradient(45deg, #ff9f00, #f58045);
      }

      .xdgr-stat-card.heybox.score-band-2 .xdgr-stat-main {
        background: linear-gradient(45deg, #fa6eff, #cb33ff);
      }

      .xdgr-stat-card.heybox.score-band-3 .xdgr-stat-main {
        background: linear-gradient(45deg, #52b7ff, #1a91fe);
      }

      .xdgr-stat-card.heybox.score-band-4 .xdgr-stat-main {
        background: linear-gradient(45deg, #8fd427, #59d01b);
      }

      .xdgr-stat-card.wishlist .xdgr-stat-main {
        background: linear-gradient(135deg, #ff6f91, #f84871);
      }

      .xdgr-stat-card.online .xdgr-stat-main {
        background: linear-gradient(135deg, #19a890, #087f78);
      }

      .xdgr-stat-card.online .xdgr-stat-value,
      .xdgr-stat-card.wishlist .xdgr-stat-value {
        font-size: 14px;
      }

      .xdgr-stat-card.unavailable .xdgr-stat-main {
        background: #aeb5bd;
      }

      .xdgr-stat-card.loading {
        animation: xdgr-pulse 1.15s ease-in-out infinite alternate;
      }

      .xdgr-status {
        align-items: center;
        background: #f3f4f5;
        border-radius: 6px;
        color: #7b858e;
        display: flex;
        font: 500 10px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
        grid-column: 1 / -1;
        justify-content: center;
        min-height: 32px;
        padding: 4px 7px;
        text-align: center;
      }

      .xdgr-status.error {
        background: #fff2f0;
        color: #cf1322;
      }

      .update-page .left.update > ul li.xdgr-has-ratings {
        min-height: 66px;
      }

      .update-page .left.update > ul li .up-category {
        box-sizing: border-box;
        width: 88px;
      }

      .update-page .left.update > ul li .tit {
        flex: 1 1 auto;
        min-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .update-page .left.update > ul li .xdgr-ratings {
        align-self: center;
        flex: 0 0 224px;
        gap: 5px;
        min-height: 50px;
        order: 0;
        padding: 0;
        width: 224px;
      }

      .update-page .left.update > ul li .link {
        box-sizing: border-box;
        text-align: center;
        width: 52px;
      }

      .update-page .left.update > ul li time {
        box-sizing: border-box;
        overflow: hidden;
        text-align: right;
        text-overflow: ellipsis;
        white-space: nowrap;
        width: 104px;
      }

      body.dark .xdgr-stat-sub,
      html.dark .xdgr-stat-sub,
      body.night .xdgr-stat-sub,
      body.dark .xdgr-status,
      html.dark .xdgr-status {
        background: #30343a;
        color: #d6d9dc;
      }

      body.night .xdgr-status {
        background: #30343a;
        color: #d6d9dc;
      }

      @media screen and (max-width: 800px) {
        .update-page .left.update > ul li.xdgr-has-ratings {
          min-height: 0;
        }

        .update-page .left.update > ul li .tit {
          min-width: 0;
        }

        .update-page .left.update > ul li time {
          text-align: right;
          width: auto;
        }

        .update-page .left.update > ul li .xdgr-ratings {
          flex: 1 0 100%;
          min-height: 54px;
          order: 4;
          padding: 4px 0 0 36px;
          width: 100%;
        }
      }

      @keyframes xdgr-pulse {
        from { opacity: .58; }
        to { opacity: 1; }
      }
    `);
  }
})();
