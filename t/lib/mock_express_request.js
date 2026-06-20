/*
 * Class whose instances are mocked ExpressJS request objects.
 *
 * */
'use strict';

module.exports = function(args){

    if (! args ) args = {};

    var params = args.params || {},
        error_messages = [];

    var translations = {
      'leaveRequest.messages.invalidEmployee' : 'Incorrect employee',
      'leaveRequest.messages.invalidLeaveType' : 'Incorrect leave type',
      'leaveRequest.messages.dateInvalid' : function(options) {
        return (options && options.label || 'Date') + ' should be a date';
      },
      'leaveRequest.messages.dayPartInvalid' : 'Incorrect day part',
    };

    var req = {
        session : {},
        user    : {
          company : {
            get_default_date_format : function() {'YYYY-MM-DD'},
            normalise_date : function(date) { return date; },
          },
        },
        body : params,
        t : function(key, options) {
          var translation = translations[key];

          if (typeof translation === 'function') {
            return translation(options || {});
          }

          return translation || key;
        },
    };

    // Make request be aware of flash messages
    require('../../lib/middleware/flash_messages')(req,{locals:{}},function(){});

    return req;
};
