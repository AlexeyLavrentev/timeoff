
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);

const redis = require('redis');
const connectRedis = require('connect-redis');
const config = require('../config');

const sessionStoreConfig = config.get('sessionStore') || {};

const parseBoolean = (value, defaultValue) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (['true', '1', 'yes', 'on'].includes(value.toLowerCase())) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(value.toLowerCase())) {
      return false;
    }
  }

  return defaultValue;
};

const parseCookieSameSite = (value) => {
  const normalizedValue = typeof value === 'string' ? value.toLowerCase() : 'lax';
  const allowedValues = ['lax', 'strict', 'none'];

  if (!allowedValues.includes(normalizedValue)) {
    throw new Error('Unsupported SESSION_COOKIE_SAME_SITE value: ' + value);
  }

  return normalizedValue;
};

const parseMaxAge = (value, defaultValue) => {
  if (typeof value === 'undefined' || value === null || value === '') {
    return defaultValue;
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error('SESSION_COOKIE_MAX_AGE_MS must be a positive integer');
  }

  return parsedValue;
};

const createSessionMiddleware = ({
  sequelizeDb,
}) => {
  let store;

  if (sessionStoreConfig && sessionStoreConfig.useRedis) {
    const RedisStore = connectRedis(session);
    const {redisConnectionConfiguration = {}} = sessionStoreConfig;
    const {host, port} = redisConnectionConfiguration;
    if (!(host && port)) {
      throw new Error('Missing configuration for Redis to use with Sessions');
    }
    const redisClient = redis.createClient({ host, port });

    redisClient.on('error', function (err) {
      throw new Error(`Failed to connect to Redis: ${err}`);
    });
    redisClient.on('connect', function (err) {
        console.log('Connected to redis successfully');
    });

    store = new RedisStore({ client: redisClient });
  } else {
    if (!sequelizeDb) {
      throw new Error('Database connection was not provided into Session store manager!');
    }
    store = new SequelizeStore({ db: sequelizeDb });
    store.sync();
  }

  const cookieSecure = parseBoolean(config.get('session_cookie_secure'), false);
  const cookieSameSite = parseCookieSameSite(config.get('session_cookie_same_site'));
  const cookieMaxAge = parseMaxAge(
    config.get('session_cookie_max_age_ms'),
    12 * 60 * 60 * 1000
  );

  if (cookieSameSite === 'none' && !cookieSecure) {
    throw new Error('SESSION_COOKIE_SAME_SITE=none requires SESSION_COOKIE_SECURE=true');
  }

  return session({
    store,
    secret: config.get('session_secret'),
    resave: false,
    saveUninitialized: false,
    proxy: parseBoolean(config.get('trust_proxy'), false),
    cookie: {
      httpOnly: true,
      sameSite: cookieSameSite,
      secure: cookieSecure,
      maxAge: cookieMaxAge,
    },
  });
};

module.exports = createSessionMiddleware;
