$(document).ready(function () {
  var providerSelector = $('#sso_auth_provider');
  var providerSections = $('[data-sso-provider-section]');

  function updateVisibleSections() {
    var provider = providerSelector.val() || 'oidc';

    providerSections.each(function () {
      var section = $(this);
      section.toggle(section.data('sso-provider-section') === provider);
    });
  }

  providerSelector.on('change', updateVisibleSections);
  updateVisibleSections();
});
