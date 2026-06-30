/*
 *  Config object for tests.
 *
 *  Supposed to consolidate parameters for running tests.
 *
 * */

"use strict";

module.exports = {
  get_application_host : function(){
    return `http://${ process.env.TEST_HOST || process.env.HOST || 'localhost' }:${ process.env.PORT || 3000}/`;
  },

  /*
   *  Default timeout each integration test needs to be completed in
   *
   * */
  get_execution_timeout : function(){
    const configured = Number(process.env.TEST_EXECUTION_TIMEOUT_MS);
    return Number.isFinite(configured) && configured > 0
      ? configured
      : 60 * 1000;
  },
}
