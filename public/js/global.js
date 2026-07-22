
$(function () {
  var csrfToken = window.timeoff && window.timeoff.csrfToken;

  if (!csrfToken) {
    return;
  }

  $('form').each(function () {
    var method = String($(this).attr('method') || 'GET').toUpperCase();
    if (method !== 'GET' && !$(this).find('input[name="_csrf"]').length) {
      $('<input>', {type: 'hidden', name: '_csrf', value: csrfToken}).appendTo(this);
    }
  });

  $(document).ajaxSend(function (_event, xhr, settings) {
    var method = String(settings.type || settings.method || 'GET').toUpperCase();
    var url = document.createElement('a');
    url.href = settings.url || '';
    var sameOrigin = !url.host || url.host === window.location.host;
    if (sameOrigin && !/^(GET|HEAD|OPTIONS)$/.test(method)) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    }
  });
});

/*
 * Book Leave request pop-up window.
 *
 * */
$(document).ready(function(){
  /*
   *  When FROM field in New absense form chnages: update TO one if necessary
   */
  $('input.book-leave-from-input').on('change', function(e){
    e.stopPropagation();

    var from_date = $('input.book-leave-from-input').datepicker('getDate');

    if ( ! from_date ) {
      // no new value for FROM part, do nothing
      console.log('No from date');
      return;
    }

    var to_date = $('input.book-leave-to-input').datepicker('getDate');

    if ( ! to_date || ( to_date && to_date.getTime() < from_date.getTime() )) {
      $('input.book-leave-to-input').datepicker('setDate', $('input.book-leave-from-input').datepicker('getFormattedDate'));
    }
  });
});

$(document).ready(function(){
  var translations = (window.timeoff && window.timeoff.translations) || {};

  $(document).on('click', '.vacation-plan-conflict-toggle', function(){
    var $button = $(this);
    var $placeholder = $button.next('.vacation-plan-conflict-details-placeholder');

    if (!$placeholder.length) {
      return;
    }

    if (!$placeholder.hasClass('hidden')) {
      $placeholder.addClass('hidden');
      $button.attr('aria-expanded', 'false');
      return;
    }

    $button.attr('aria-expanded', 'true');
    $placeholder.removeClass('hidden');

    if ($placeholder.data('loaded')) {
      return;
    }

    $placeholder
      .html('<span class="text-muted">' + translations.loading + '</span>')
      .load($button.data('conflict-url'), function(response, status){
        if (status === 'error') {
          $placeholder.text(translations.requestFailed);
          return;
        }

        $placeholder.data('loaded', true);
      });
  });
});


/*
 * Bootstrap-datepicker
 *
 * */
$(function () {
  var locale = (window.timeoff && window.timeoff.locale) || 'en';
  var datepickerLocale = locale === 'en' ? 'en-GB' : locale;
  var translations = (window.timeoff && window.timeoff.translations) || {};
  var datepickerTranslations = translations.datepicker;

  if (datepickerTranslations) {
    $.fn.datepicker.dates[datepickerLocale] = datepickerTranslations;
    $.fn.datepicker.defaults.language = datepickerLocale;
  }

  $('[data-toggle="tooltip"]').tooltip({
    container: 'body',
    viewport: {
      selector: 'body',
      padding: 8,
    },
  })
})

$(function () {
  $('[data-toggle="popover"]').popover({
    container: 'body',
    viewport: {
      selector: 'body',
      padding: 8,
    },
  })
})

/*
 * This is handler for invocation of "add secondary supervisors" modal
 *
 * */

$('#add_secondary_supervisers_modal').on('show.bs.modal', function (event) {
  var button = $(event.relatedTarget),
      department_name = button.data('department_name'),
      department_id = button.data('department_id');
  var translations = (window.timeoff && window.timeoff.translations) || {};

  var modal = $(this);

  modal.find('.modal-title strong').text(department_name);

  // Make modal window to be no hiegher then window and its content
  // scrollable
  $('.modal .modal-body').css('overflow-y', 'auto');
  $('.modal .modal-body').css('max-height', $(window).height() * 0.7);

  $(this).find(".modal-body")
    // Show "loading" icon while content of modal is loaded
    .html('<p class="text-center"><i class="fa fa-refresh fa-spin fa-3x fa-fw"></i><span class="sr-only">' + translations.loading + '</span></p>')
    .load('/settings/departments/available-supervisors/'+department_id+'/', function(response, status){
      if (status === 'error') {
        $(this).text(translations.requestFailed);
      }
    });
});

/*
 *  Given URL string return its query paramters as object.
 *
 *  If URL is not provided location of current page is used.
 * */

function getUrlVars(url){
  if ( ! url ) {
    url = window.location.href;
  }
  var vars = {}, hash;
  var hashes = url.slice( url.indexOf('?') + 1).split('&');
  for (var i = 0; i < hashes.length; i++) {
    hash = hashes[i].split('=');
    vars[hash[0]] = hash[1];
  }
  return vars;
}

/*
 * Evend that is fired when user change base date (current month) on Team View page.
 *
 * */

$(document).ready(function(){

  $('#team_view_month_select_btn')
    .datepicker()
    .on('changeDate', function(e) {
      $('#team-view-loading').removeClass('hidden');

      var url = $(e.currentTarget).data('tom');

      var form = document.createElement("form");
      form.method = 'GET';
      form.action = url;

      var url_params = getUrlVars( url );
      url_params['date'] = e.format('yyyy-mm');

      // Move query parameters into the form
      $.each( url_params, function(key, val){
        var inp = document.createElement("input");
        inp.name = key;
        inp.value = val;
        inp.type = 'hidden';
        form.appendChild(inp);
      });

      document.body.appendChild(form);

      return form.submit();
    });

  if ($('#team_view_month_select_btn').length) {
    $(document).on('click', '.team-view-filters a, nav a, .team-view-months-buttons a', function() {
      var $link = $(this);
      var href = $link.attr('href');

      // Ignore controls that only toggle UI state (dropdowns/modals), they do not navigate.
      if (!href || href === '#' || href.indexOf('javascript:') === 0 || $link.is('[data-toggle="dropdown"], [data-toggle="modal"]')) {
        return;
      }

      $('#team-view-loading').removeClass('hidden');
    });
  }
});


$(document).ready(function(){

  $('[data-tom-color-picker] a')
    .on('click', function(e){
      e.stopPropagation();

      // Close dropdown
      $(e.target).closest('.dropdown-menu').dropdown('toggle');

      var new_class_name =  $(e.target).data('tom-color-picker-css-class');

      // Ensure newly selected color is on triggering element
      $(e.target).closest('[data-tom-color-picker]')
        .find('button.dropdown-toggle')
        .attr('class', function(idx, c){ return c.replace(/leave_type_color_\d+/g, '') })
        .addClass( new_class_name );

      // Capture newly picked up color in hidden input for submission
      $(e.target).closest('[data-tom-color-picker]')
        .find('input[type="hidden"]')
        .attr('value', new_class_name);

      return false;
    });
});

$(document).ready(function(){
  var translations = (window.timeoff && window.timeoff.translations) || {};

  function sidePopoverPlacement(tip, element) {
    var elementRect = element.getBoundingClientRect();
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    var popoverWidth = tip && tip.offsetWidth ? tip.offsetWidth : 320;

    return elementRect.right + popoverWidth + 24 > viewportWidth ? 'left' : 'right';
  }

  /*
    Employee summary popovers.

    Two separate initializations, keyed by marker class so the requests-page
    trigger (a real <button>) is fully keyboard/click driven while every other
    user-details trigger (Team View <td>, etc.) keeps its original hover-only
    behaviour:

      .requests-user-details-summary-trigger  -> manual controller (this page)
      .user-details-summary-trigger (other)   -> Bootstrap hover popover

    Bootstrap still owns aria-describedby and the .popover[role=tooltip]
    element in both cases.
  */

  // --- Shared placement helper used by both branches above and below. ---
  // (sidePopoverPlacement is already defined at the top of this ready block.)

  /*
    Other user-details triggers (Team View <td>, ...): original hover-only
    behaviour. No manual state, no click/focus handlers, no pointerPinned.
    The markup and selectors of those pages are intentionally untouched.
  */
  var $otherUserTriggers = $('.user-details-summary-trigger')
    .not('.requests-user-details-summary-trigger');

  if ($otherUserTriggers.length) {
    $otherUserTriggers.popover({
      title: translations.employeeSummary,
      container: 'body',
      html: true,
      trigger: 'hover',
      placement: sidePopoverPlacement,
      viewport: { selector: 'body', padding: 12 },
      delay: { show: 700, hide: 120 },
      content: function(){
        var $trigger = $(this);
        var $content = $('<div>', {
          'class': 'employee-summary-popover-content',
          'text': translations.loading
        });
        $.ajax({
          url: '/users/summary/' + $trigger.attr('data-user-id') + '/',
          success: function(response){ $content.html(response); },
          error: function(){ $content.text(translations.requestFailed); }
        });
        return $content[0];
      }
    });
  }

  /*
    Requests-page employee summary trigger: manual controller.
  */
  var $reqTriggers = $('.requests-user-details-summary-trigger');

  if ($reqTriggers.length) {
    var SHOW_DELAY_HOVER = 700;
    var HIDE_DELAY = 120;

    // One shared document-level Escape handler for requests popovers only.
    var ESCAPE_NS = 'keydown.userSummaryPopover';
    $(document).off(ESCAPE_NS).on(ESCAPE_NS, function(e){
      if (e.which !== 27) { return; }
      var current = currentOpen();
      if (!current) { return; }
      // Only act when our popover is the relevant one; let modal/dropdown
      // handle Escape themselves otherwise.
      hideTrigger(current);
    });

    // One shared document-level click handler for click-outside.
    var CLICK_NS = 'click.userSummaryPopover';
    $(document).off(CLICK_NS).on(CLICK_NS, function(e){
      $reqTriggers.each(function(){
        var $t = $(this);
        var state = $t.data('userSummaryState');
        if (!state || !state.pointerPinned) { return; }
        var insideTrigger = $.contains(this, e.target) || this === e.target;
        var tip = tipOf($t);
        var insidePopover = tip && ($.contains(tip, e.target) || tip === e.target);
        // Click on the trigger itself is handled by the trigger's own
        // click handler (toggle); do not double-process here.
        if (!insideTrigger && !insidePopover) {
          hideTrigger($t);
        }
      });
    });

    function tipOf($trigger) {
      var inst = $trigger.data('bs.popover');
      return inst && inst.tip ? inst.tip() : null;
    }

    function isOpen($trigger) {
      var tip = tipOf($trigger);
      return !!(tip && tip.is(':visible'));
    }

    function currentOpen() {
      var found = null;
      $reqTriggers.each(function(){
        if (isOpen($(this))) { found = $(this); }
      });
      return found;
    }

    function cancelShow(state) {
      if (state.showTimer) {
        window.clearTimeout(state.showTimer);
        state.showTimer = null;
      }
    }

    function cancelHide(state) {
      if (state.hideTimer) {
        window.clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
    }

    function shouldStayVisible(state) {
      return state.hovered || state.focused || state.pointerPinned || state.popoverHovered;
    }

    // Centralised open routine: cancel any pending timers, close any other
    // requests employee-summary popover, and show this one exactly once.
    function showTrigger($trigger) {
      var state = $trigger.data('userSummaryState');
      cancelShow(state);
      cancelHide(state);
      var other = currentOpen();
      if (other && !other.is($trigger)) {
        hideTrigger(other);
      }
      if (!isOpen($trigger)) {
        $trigger.popover('show');
      }
    }

    function scheduleShow($trigger, delay) {
      var state = $trigger.data('userSummaryState');
      cancelHide(state);
      if (isOpen($trigger)) { return; }
      if (state.showTimer) { return; }
      state.showTimer = window.setTimeout(function(){
        state.showTimer = null;
        showTrigger($trigger);
      }, delay);
    }

    function scheduleHide($trigger) {
      var state = $trigger.data('userSummaryState');
      cancelShow(state);
      if (state.hideTimer) { return; }
      state.hideTimer = window.setTimeout(function(){
        state.hideTimer = null;
        if (!shouldStayVisible(state)) {
          $trigger.popover('hide');
        }
      }, HIDE_DELAY);
    }

    function hideTrigger($trigger) {
      var state = $trigger.data('userSummaryState');
      cancelShow(state);
      cancelHide(state);
      state.pointerPinned = false;
      state.popoverHovered = false;
      if (state.currentXhr) {
        state.currentXhr.abort();
        // state.currentXhr is cleared by the xhr's own complete callback,
        // guarded by identity (see below).
      }
      if (isOpen($trigger)) {
        $trigger.popover('hide');
      }
    }

    function bindPopoverHover($trigger) {
      var $tip = tipOf($trigger);
      if (!$tip || $tip.data('userSummaryHoverBound')) { return; }
      $tip
        .on('mouseenter.userSummaryPopover', function(){
          var state = $trigger.data('userSummaryState');
          state.popoverHovered = true;
          cancelHide(state);
        })
        .on('mouseleave.userSummaryPopover', function(){
          var state = $trigger.data('userSummaryState');
          state.popoverHovered = false;
          scheduleHide($trigger);
        })
        .data('userSummaryHoverBound', true);
    }

    $reqTriggers.each(function(){
      var $trigger = $(this);
      // AJAX content object lives on the trigger; response can only land here.
      var $content = $('<div>', {
        'class': 'employee-summary-popover-content',
        'aria-live': 'polite',
        'aria-atomic': 'true',
        'text': translations.loading
      });

      var state = {
        hovered: false,
        focused: false,
        pointerPinned: false,
        popoverHovered: false,
        showTimer: null,
        hideTimer: null,
        currentXhr: null,
        content: $content
      };
      $trigger.data('userSummaryState', state);

      $trigger.popover({
        title: translations.employeeSummary,
        container: 'body',
        html: true,
        trigger: 'manual',
        placement: sidePopoverPlacement,
        viewport: { selector: 'body', padding: 12 },
        content: function(){ return $content[0]; }
      });

      // Once the popover element exists, attach hover handlers to its tip
      // so the user can move the pointer onto the popover without losing it.
      $trigger.on('shown.bs.popover', function(){
        bindPopoverHover($trigger);
      });

      $trigger
        .on('mouseenter.userSummaryPopover', function(){
          state.hovered = true;
          scheduleShow($trigger, SHOW_DELAY_HOVER);
        })
        .on('mouseleave.userSummaryPopover', function(){
          state.hovered = false;
          scheduleHide($trigger);
        })
        .on('focusin.userSummaryPopover', function(){
          state.focused = true;
          // Keyboard focus shows immediately: 700ms delay is tuned for
          // accidental hover and is painful for keyboard users.
          scheduleShow($trigger, 0);
        })
        .on('focusout.userSummaryPopover', function(){
          state.focused = false;
          scheduleHide($trigger);
        })
        .on('click.userSummaryPopover', function(e){
          // Distinguish pointer activation (mouse/touch) from keyboard
          // activation (Enter/Space synthesizes a click with detail=0 and,
          // for Enter, without a preceding pointerdown). detail === 0 means
          // keyboard; the popover is already open from focusin.
          var fromKeyboard = (e.detail === 0);
          if (fromKeyboard) {
            // Keyboard click is NOT a toggle:
            //  - if already open: keep it open (no change);
            //  - if closed (e.g. after Escape, while focus is still here):
            //    open immediately without a toggle that could hide it again.
            e.preventDefault();
            if (!isOpen($trigger)) {
              showTrigger($trigger);
            }
            return;
          }
          e.preventDefault();
          if (state.pointerPinned) {
            hideTrigger($trigger);
          } else {
            // A real pointer click on the button first fires focusin, which
            // calls scheduleShow(0). Cancel both timers so the show happens
            // exactly once, through showTrigger.
            state.pointerPinned = true;
            showTrigger($trigger);
          }
        });

      // Load AJAX content when the popover is first shown.
      $trigger.on('show.bs.popover', function(){
        // Abort a previous in-flight request for this trigger, if any.
        if (state.currentXhr) {
          state.currentXhr.abort();
        }
        $content.text(translations.loading);
        // Capture this specific request and compare by identity in every
        // callback so a late response from an older request can never
        // overwrite the content of a newer popover.
        var xhr = $.ajax({
          url: '/users/summary/' + $trigger.attr('data-user-id') + '/',
          success: function(response){
            if (state.currentXhr !== xhr) { return; }
            $content.html(response);
          },
          error: function(jqXhr, textStatus){
            // textStatus === 'abort' happens when we intentionally cancel
            // a stale request — do not surface a failure message for that.
            if (textStatus === 'abort') { return; }
            if (state.currentXhr !== xhr) { return; }
            $content.text(translations.requestFailed);
          },
          complete: function(){
            if (state.currentXhr === xhr) {
              state.currentXhr = null;
            }
          }
        });
        state.currentXhr = xhr;
      });
    });
  }
});

$(document).ready(function(){
  var translations = (window.timeoff && window.timeoff.translations) || {};

  function sidePopoverPlacement(tip, element) {
    var elementRect = element.getBoundingClientRect();
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    var popoverWidth = tip && tip.offsetWidth ? tip.offsetWidth : 320;

    return elementRect.right + popoverWidth + 24 > viewportWidth ? 'left' : 'right';
  }

  $('.leave-details-summary-trigger').popover({
    title: translations.leaveSummary,
    container: 'body',
    html: true,
    trigger: 'hover',
    placement: sidePopoverPlacement,
    viewport: {
      selector: 'body',
      padding: 12,
    },
    delay: {show: 700, hide: 120},
    content: function(){
      var divId =  "tmp-id-" + $.now();
      return detailsInPopup($(this).attr('data-leave-id'), divId);
    }
  });

  function detailsInPopup(leaveId, divId){
    $.ajax({
      url: '/calendar/leave-summary/'+leaveId+'/',
      success: function(response){
        $('#'+divId).html(response);
      },
      error: function(){
        $('#'+divId).text(translations.requestFailed);
      }
    });
    return '<div id="'+ divId +'">' + translations.loading + '</div>';
  }
});

$(document).ready(function() {
  var translations = (window.timeoff && window.timeoff.translations) || {};

  if (
    window.navigator.webdriver ||
    (window.timeoff && window.timeoff.disableNotifications) ||
    !$('#header-notification-dropdown').length
  ) {
    return;
  }

  const fetchNotifications = () => {
    if (typeof($.ajax) === 'function') {
      $.ajax({
        url: '/api/v1/notifications/',
        success: function(args){
          const error = args.error;
          const data = args.data;

          if (error) {
            console.log('Failed to fetch notifications');
            return;
          }

          const dropDown = $('#header-notification-dropdown ul.dropdown-menu');
          const badge = $('#header-notification-dropdown .notification-badge');
          const featureBadges = $('.notification-feature-badge');

          featureBadges.addClass('hidden').text('');
          (data || []).forEach(function(notification) {
            if (!notification.badgeId) {
              return;
            }

            $('#' + notification.badgeId)
              .removeClass('hidden')
              .text(notification.numberOfRequests);
          });

          if (!data || !data.length) {
            badge.addClass('hidden');
            dropDown.empty();
            dropDown.append('<li class="dropdown-header">' + translations.notificationsEmpty + '</li>')

            document.title = document.title.replace(/\(\d+\)\s*/, '');

            return;
          }

          const numberOfNotifications = data
            .map(function(d) {return d.numberOfRequests})
            .reduce(function(acc, it){ return acc + it}, 0)

          badge.removeClass('hidden').html(numberOfNotifications);

          if (!document.title.startsWith('(')) {
            document.title = '(' + numberOfNotifications + ') ' + document.title;
          } else {
            document.title = document.title.replace(/\(\d+\)/, '('+numberOfNotifications+')');
          }

          dropDown.empty();

          for (var i=0; i<data.length; i++) {
            const notification = data[i];
            dropDown.append(
              '<li><a href="'+notification.link+'">'+notification.label+'</a></li>'
            );
          }
        },
        error: function(){
          console.log('Failed to fetch notifications');
        }
      });
    }

    setTimeout(fetchNotifications, 30 * 1000);
  }

  fetchNotifications();
});

/**
 * Prevent for double submission.
 */
$(document).ready(function(){
  $('.single-click').on('click', function(e) {
    var form = $(e.target).closest('form');

    // Ensure "required" fields are populated
    var formIsValid = true;
    $(form).find('[required]').each(function(){
      formIsValid = formIsValid && !!$(this).val();
    });
    if (formIsValid) {
      e.stopPropagation();
    } else {
      return;
    }

    $(e.target).prop('disabled', true);

    var submitName = $(e.target).attr('name');
    if (submitName !== undefined) {
      $('<input>').attr({type: 'hidden', name: submitName, value: '1'}).appendTo(form);
    }
    form.submit();

    return false;
  });
});

/*
 * Book leave modal: move focus to the first usable form control once shown.
 *
 * Bootstrap 3.3.4 already manages aria-hidden, the focus trap (enforceFocus),
 * Escape dismissal, and focus restoration to the opener, so this only chooses
 * a meaningful initial focus inside the dialog instead of leaving focus on the
 * modal container itself. Order matches the visible form: #employee (only
 * present for supervisors), then #leave_type, then the first focusable control.
 */
$(document).ready(function(){
  $('#book_leave_modal').on('shown.bs.modal', function() {
    var $modal = $(this);
    var $preferred = $modal.find('#employee').add($modal.find('#leave_type'));
    var $target = $preferred.filter(':visible').filter(function() {
      return !this.disabled;
    }).first();

    if (!$target.length) {
      $target = $modal.find('button, a[href], input, select, textarea')
        .filter(':visible').filter(function() {
          return !this.disabled && this.type !== 'hidden';
        }).first();
    }

    if ($target.length) {
      $target.focus();
    }
  });
});

$(document).ready(function(){
  var currentPath = window.location.pathname;

  $('.primary-navigation > li > a[href]').each(function(){
    var linkPath = this.pathname;
    var isTeamView = linkPath === '/calendar/teamview/';
    var isCurrent = isTeamView
      ? currentPath.indexOf('/calendar/teamview/') === 0
      : (linkPath === '/calendar/' ? currentPath === '/calendar/' : currentPath.indexOf(linkPath) === 0);

    if (isCurrent) {
      $(this).attr('aria-current', 'page').parent().addClass('active');
    }
  });

  $('.navbar-collapse a:not(.dropdown-toggle)').on('click', function(){
    if ($('.navbar-toggle').is(':visible')) {
      $('.navbar-collapse').collapse('hide');
    }
  });
});

$(document).ready(function(){
  var themeStorageKey = 'timeoff-theme';
  var $themeMenu = $('#theme-menu');

  if (!$themeMenu.length) {
    return;
  }

  var $themeLabel = $themeMenu.find('.theme-label');
  var $themeIcon = $themeMenu.find('.theme-icon');

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function setLabel(theme) {
    var $item = $themeMenu.find('[data-theme-value="' + theme + '"]');
    if ($item.length) {
      $themeLabel.text($item.text());
    }

    $themeIcon
      .toggleClass('fa-sun-o', theme !== 'dark')
      .toggleClass('fa-moon-o', theme === 'dark');
  }

  var storedTheme;
  try {
    storedTheme = localStorage.getItem(themeStorageKey);
  } catch (e) {
    storedTheme = null;
  }

  if (storedTheme === 'dark' || storedTheme === 'light') {
    applyTheme(storedTheme);
    setLabel(storedTheme);
  } else {
    applyTheme('light');
    setLabel('light');
  }

  $themeMenu.find('[data-theme-value]').on('click', function(event){
    event.preventDefault();
    var theme = $(this).data('theme-value');

    applyTheme(theme);
    setLabel(theme);

    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch (e) {
      // Ignore storage errors (for example, privacy mode).
    }
  });
});
