
$(document).ready(function () {
    // Mirrors the server-side defaults in Company.create_default_company
    // (lib/model/db/company.js) so the pre-selected timezone matches what
    // a company registered for that country will actually get.
    var COUNTRY_DEFAULT_TIMEZONE = {
        KZ: 'Asia/Almaty',
        RU: 'Europe/Moscow',
    };

    $('#country_inp').on('change', function () {
        var timezone = COUNTRY_DEFAULT_TIMEZONE[$(this).val()];

        if (timezone) {
            $('#timezone_inp').val(timezone);
        }
    });
});
