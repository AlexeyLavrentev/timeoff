"use strict";

const redis = require('redis');
const { promisify } = require('util');

const { sessionStore: sessionStoreConfig } = require(__dirname + '/../../config/app.json') || {};

const TEAM_VIEW_CACHE_PREFIX = 'teamview:';
const TEAM_VIEW_CACHE_MAX = 200;
const TEAM_VIEW_VERSION_PREFIX = 'teamview:version:';

let redisClient;
let redisGetAsync;
let redisSetExAsync;
let redisSetAsync;
let redisIncrAsync;
let redisReady = false;
let redisInitAttempted = false;

const memoryCache = new Map();
const memoryVersions = new Map();

const initRedisIfNeeded = () => {
  if (redisInitAttempted) {
    return;
  }
  redisInitAttempted = true;

  if (!sessionStoreConfig || !sessionStoreConfig.useRedis) {
    return;
  }

  const { redisConnectionConfiguration = {} } = sessionStoreConfig;
  const { host, port } = redisConnectionConfiguration;

  if (!(host && port)) {
    console.warn('Redis cache disabled: missing host/port in config.');
    return;
  }

  try {
    redisClient = redis.createClient({ host, port });
    redisGetAsync = promisify(redisClient.get).bind(redisClient);
    redisSetExAsync = promisify(redisClient.setex).bind(redisClient);
    redisSetAsync = promisify(redisClient.set).bind(redisClient);
    redisIncrAsync = promisify(redisClient.incr).bind(redisClient);

    redisClient.on('ready', function () {
      redisReady = true;
      console.log('Redis cache connected successfully');
    });

    redisClient.on('error', function (err) {
      redisReady = false;
      console.warn(`Redis cache error: ${err}`);
    });
  } catch (error) {
    redisReady = false;
    console.warn(`Failed to initialize Redis cache: ${error}`);
  }
};

const purgeMemoryCache = () => {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
};

const getFromMemory = (key) => {
  purgeMemoryCache();
  const entry = memoryCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.html;
};

const setToMemory = (key, html, ttlSeconds) => {
  purgeMemoryCache();
  if (memoryCache.size >= TEAM_VIEW_CACHE_MAX) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }
  memoryCache.set(key, { html, expiresAt: Date.now() + ttlSeconds * 1000 });
};

const buildKey = (args) => TEAM_VIEW_CACHE_PREFIX + JSON.stringify(args);
const buildVersionKey = (companyId) => `${TEAM_VIEW_VERSION_PREFIX}${companyId}`;

const getHtml = async (key) => {
  initRedisIfNeeded();
  if (redisReady && redisGetAsync) {
    try {
      return await redisGetAsync(key);
    } catch (error) {
      console.warn(`Redis cache get failed: ${error}`);
      return getFromMemory(key);
    }
  }
  return getFromMemory(key);
};

const setHtml = async (key, html, ttlSeconds) => {
  initRedisIfNeeded();
  if (redisReady && redisSetExAsync) {
    try {
      await redisSetExAsync(key, ttlSeconds, html);
      return;
    } catch (error) {
      console.warn(`Redis cache set failed: ${error}`);
      setToMemory(key, html, ttlSeconds);
      return;
    }
  }
  setToMemory(key, html, ttlSeconds);
};

const getCompanyVersion = async (companyId) => {
  if (!companyId) {
    return '1';
  }

  initRedisIfNeeded();
  const versionKey = buildVersionKey(companyId);

  if (redisReady && redisGetAsync && redisSetAsync) {
    try {
      const value = await redisGetAsync(versionKey);
      if (value) {
        return value;
      }
      await redisSetAsync(versionKey, '1');
      return '1';
    } catch (error) {
      console.warn(`Redis cache get version failed: ${error}`);
    }
  }

  const current = memoryVersions.get(versionKey);
  if (current) {
    return current;
  }
  memoryVersions.set(versionKey, '1');
  return '1';
};

const bumpCompanyVersion = async (companyId) => {
  if (!companyId) {
    return;
  }

  initRedisIfNeeded();
  const versionKey = buildVersionKey(companyId);

  if (redisReady && redisIncrAsync) {
    try {
      await redisIncrAsync(versionKey);
      return;
    } catch (error) {
      console.warn(`Redis cache bump version failed: ${error}`);
    }
  }

  const current = Number(memoryVersions.get(versionKey) || '1');
  memoryVersions.set(versionKey, String(current + 1));
};

module.exports = {
  buildKey,
  getHtml,
  setHtml,
  getCompanyVersion,
  bumpCompanyVersion,
};
