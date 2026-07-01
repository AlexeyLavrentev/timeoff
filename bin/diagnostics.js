#!/usr/bin/env node
'use strict';

require('../lib/diagnostics').collect()
  .then(snapshot => process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n'))
  .catch(error => {
    require('../lib/middleware/request_logger').error('diagnostics_failed', {error});
    process.exitCode = 1;
  });
