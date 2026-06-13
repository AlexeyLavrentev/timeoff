#!/usr/bin/env node

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const port = process.env.PORT || '3000';
const testHost = process.env.TEST_HOST || '127.0.0.1';
const host = `http://${testHost}:${port}`;
const node = process.execPath;
const dbStorage = process.env.TEST_DB_STORAGE || path.join(process.cwd(), 'db.test.sqlite');
const baseTestEnv = Object.assign({}, process.env, {
  PORT: port,
  HOST: testHost,
  TEST_HOST: testHost,
  DB_DIALECT: 'sqlite',
  DB_STORAGE: dbStorage,
  DISABLE_NOTIFICATIONS_POLLING: 'true',
  TIMEOFF_FEATURES: 'all',
});
const serverEnv = Object.assign({}, baseTestEnv, {
  ALLOW_CREATE_NEW_ACCOUNTS: 'true',
  DISABLE_AUTH_RATE_LIMIT: 'true',
});

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, Object.assign({
    stdio: 'inherit',
    env: baseTestEnv,
  }, options));

  child.on('error', reject);
  child.on('exit', code => {
    if (code === 0) {
      resolve();
      return;
    }

    reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
  });
});

const waitForServer = () => new Promise((resolve, reject) => {
  const deadline = Date.now() + 30000;

  const attempt = () => {
    const req = http.get(`${host}/login/`, res => {
      res.resume();
      if (res.statusCode >= 200 && res.statusCode < 500) {
        resolve();
        return;
      }
      retry();
    });

    req.on('error', retry);
    req.setTimeout(1000, () => {
      req.destroy();
      retry();
    });
  };

  const retry = () => {
    if (Date.now() >= deadline) {
      reject(new Error(`Timed out waiting for test server at ${host}`));
      return;
    }

    setTimeout(attempt, 250);
  };

  attempt();
});

const stopServer = server => new Promise(resolve => {
  if (!server || server.killed) {
    resolve();
    return;
  }

  server.once('exit', () => resolve());
  server.kill('SIGTERM');
  setTimeout(() => {
    if (!server.killed) {
      server.kill('SIGKILL');
    }
    resolve();
  }, 5000);
});

const mochaArgs = process.argv.slice(2).filter(arg => arg !== '--');

let server;

if (!process.env.KEEP_TEST_DB && fs.existsSync(dbStorage)) {
  fs.unlinkSync(dbStorage);
}

run(node, ['bin/db_update.js'])
  .then(() => {
    server = spawn(node, ['bin/wwww'], {
      stdio: 'inherit',
      env: serverEnv,
    });

    server.on('exit', code => {
      if (code !== null && code !== 0) {
        console.error(`Test server exited with ${code}`);
      }
    });

    return waitForServer();
  })
  .then(() => run(node, ['node_modules/mocha/bin/mocha', '--recursive', 't'].concat(mochaArgs)))
  .then(() => stopServer(server))
  .catch(error => stopServer(server).then(() => {
    console.error(error && error.stack || error);
    process.exit(1);
  }));
