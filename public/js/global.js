
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

  $('[data-toggle="tooltip"]').tooltip()
})

$(function () {
  $('[data-toggle="popover"]').popover()
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
    .load('/settings/departments/available-supervisors/'+department_id+'/');
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

  $('.user-details-summary-trigger').popover({
    title: translations.employeeSummary,
    html: true,
    trigger: 'hover',
    placement: 'auto',
    delay: {show: 1000, hide: 10},
    content: function(){
      var divId =  "tmp-id-" + $.now();
      return detailsInPopup($(this).attr('data-user-id'), divId);
    }
  });

  function detailsInPopup(userId, divId){
    $.ajax({
      url: '/users/summary/'+userId+'/',
      success: function(response){
        $('#'+divId).html(response);
      }
    });

    return '<div id="'+ divId +'">' + translations.loading + '</div>';
  }
});

$(document).ready(function(){
  var translations = (window.timeoff && window.timeoff.translations) || {};

  $('.leave-details-summary-trigger').popover({
    title: translations.leaveSummary,
    html: true,
    trigger: 'hover',
    placement: 'auto',
    delay: {show: 1000, hide: 10},
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
      }
    });
    return '<div id="'+ divId +'">' + translations.loading + '</div>';
  }
});

$(document).ready(function() {
  var translations = (window.timeoff && window.timeoff.translations) || {};

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
    $(form).find('[required]').each(function(el){formIsValid = formIsValid && !! el.val()});
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

$(document).ready(function(){
  var themeStorageKey = 'timeoff-theme';
  var $themeMenu = $('#theme-menu');

  if (!$themeMenu.length) {
    return;
  }

  var $themeLabel = $themeMenu.find('.theme-label');

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
