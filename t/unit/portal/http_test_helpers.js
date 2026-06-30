'use strict';

const listen = app => new Promise((resolve, reject) => {
  const server = app.listen(0, '127.0.0.1');
  const onError = error => reject(error);
  server.once('error', onError);
  server.once('listening', () => {
    server.removeListener('error', onError);
    resolve({ server, port: server.address().port });
  });
});

const close = server => new Promise((resolve, reject) => {
  if (!server || !server.listening) return resolve();
  server.close(error => error ? reject(error) : resolve());
});

module.exports = { listen, close };
