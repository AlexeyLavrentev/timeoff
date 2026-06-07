"use strict";

const redis = require('redis');
const { promisify } = require('util');

const { sessionStore: sessionStoreConfig } = require(__dirname + '/../../config/app.json') || {};

const VACATION_PLAN_CACHE_PREFIX = 'vacation-plans:data:';
const VACATION_PLAN_VERSION_PREFIX = 'vacation-plans:version:';
const VACATION_PLAN_CACHE_TTL_SECONDS = 60;
const VACATION_PLAN_CACHE_MAX = 80;

let redisClient;
let redisGetAsync;
let redisSetExAsync;
let redisSetAsync;
let redisIncrAsync;
let redisReady = false;
let redisInitAttempted = false;

const entries = new Map();
const versions = new Map();
const inFlightLoads = new Map();

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
    console.warn('Vacation plan Redis cache disabled: missing host/port in config.');
    return;
  }

  try {
    redisClient = redis.createClient({ host, port });
    redisGetAsync = promisify(redisClient.get).bind(redisClient);
    redisSetExAsync = promisify(redisClient.setex).bind(redisClient);
    redisSetAsync = promisify(redisClient.set).bind(redisClient);
    redisIncrAsync = promisify(redisClient.incr).bind(redisClient);

    redisClient.on('ready', function() {
      redisReady = true;
      console.log('Vacation plan Redis cache connected successfully');
    });

    redisClient.on('error', function(error) {
      redisReady = false;
      console.warn(`Vacation plan Redis cache error: ${error}`);
    });
  } catch (error) {
    redisReady = false;
    console.warn(`Failed to initialize vacation plan Redis cache: ${error}`);
  }
};

const purgeExpired = () => {
  const now = Date.now();
  for (const [key, entry] of entries.entries()) {
    if (entry.expiresAt <= now) {
      entries.delete(key);
    }
  }
};

const getMemoryVersion = companyId => {
  const versionKey = String(companyId);
  const version = versions.get(versionKey);

  if (version) {
    return version;
  }

  versions.set(versionKey, 1);
  return 1;
};

const getVersion = async companyId => {
  const versionKey = `${VACATION_PLAN_VERSION_PREFIX}${companyId}`;

  initRedisIfNeeded();
  if (redisReady && redisGetAsync && redisSetAsync) {
    try {
      const value = await redisGetAsync(versionKey);
      if (value) {
        return value;
      }
      await redisSetAsync(versionKey, '1');
      return '1';
    } catch (error) {
      console.warn(`Vacation plan Redis cache get version failed: ${error}`);
    }
  }

  return String(getMemoryVersion(companyId));
};

const buildKey = ({companyId, year, version}) => `${VACATION_PLAN_CACHE_PREFIX}${companyId}:${year}:${version}`;

const clonePlans = plans => JSON.parse(JSON.stringify(plans));

const getFromMemory = key => {
  purgeExpired();

  const entry = entries.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    entries.delete(key);
    return null;
  }

  return clonePlans(entry.plans);
};

const setToMemory = ({key, plans}) => {
  purgeExpired();

  if (entries.size >= VACATION_PLAN_CACHE_MAX) {
    const oldestKey = entries.keys().next().value;
    if (oldestKey) {
      entries.delete(oldestKey);
    }
  }

  entries.set(key, {
    plans : clonePlans(plans),
    expiresAt : Date.now() + VACATION_PLAN_CACHE_TTL_SECONDS * 1000,
  });
};

const getPlansByKey = async key => {
  initRedisIfNeeded();
  if (redisReady && redisGetAsync) {
    try {
      const cached = await redisGetAsync(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn(`Vacation plan Redis cache get failed: ${error}`);
    }
  }

  return getFromMemory(key);
};

const getPlans = async ({companyId, year}) => {
  const version = await getVersion(companyId);
  return getPlansByKey(buildKey({companyId, year, version}));
};

const setPlans = async ({companyId, year, plans, key}) => {
  const cacheKey = key || buildKey({
    companyId,
    year,
    version : await getVersion(companyId),
  });

  initRedisIfNeeded();
  if (redisReady && redisSetExAsync) {
    try {
      await redisSetExAsync(cacheKey, VACATION_PLAN_CACHE_TTL_SECONDS, JSON.stringify(plans));
      return;
    } catch (error) {
      console.warn(`Vacation plan Redis cache set failed: ${error}`);
    }
  }

  setToMemory({key : cacheKey, plans});
};

const getOrLoadPlans = async ({companyId, year, load}) => {
  const version = await getVersion(companyId);
  const key = buildKey({companyId, year, version});
  const cachedPlans = await getPlansByKey(key);
  if (cachedPlans) {
    return cachedPlans;
  }

  const inFlightLoad = inFlightLoads.get(key);
  if (inFlightLoad) {
    return clonePlans(await inFlightLoad);
  }

  const loadPromise = Promise.resolve()
    .then(load)
    .then(async plans => {
      await setPlans({companyId, year, plans, key});
      return plans;
    })
    .finally(() => {
      inFlightLoads.delete(key);
    });

  inFlightLoads.set(key, loadPromise);

  return clonePlans(await loadPromise);
};

const bumpCompanyVersion = async companyId => {
  if (!companyId) {
    return;
  }

  initRedisIfNeeded();
  const redisVersionKey = `${VACATION_PLAN_VERSION_PREFIX}${companyId}`;

  if (redisReady && redisIncrAsync) {
    try {
      await redisIncrAsync(redisVersionKey);
    } catch (error) {
      console.warn(`Vacation plan Redis cache bump version failed: ${error}`);
    }
  }

  const memoryVersionKey = String(companyId);
  versions.set(memoryVersionKey, getMemoryVersion(companyId) + 1);

  for (const key of entries.keys()) {
    if (key.indexOf(`${VACATION_PLAN_CACHE_PREFIX}${companyId}:`) === 0) {
      entries.delete(key);
    }
  }

  for (const key of inFlightLoads.keys()) {
    if (key.indexOf(`${VACATION_PLAN_CACHE_PREFIX}${companyId}:`) === 0) {
      inFlightLoads.delete(key);
    }
  }
};

module.exports = {
  getPlans,
  getOrLoadPlans,
  setPlans,
  bumpCompanyVersion,
};
