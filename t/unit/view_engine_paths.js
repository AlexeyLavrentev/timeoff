'use strict';

const expect = require('chai').expect;
const expressHandlebars = require('express-handlebars');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('View engine paths', function() {
  let workspace;

  beforeEach(function() {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'timeoff-view-paths-'));
  });

  afterEach(function() {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  function writeFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  it('renders premium views with core layout and premium partials', async function() {
    const coreViewsPath = path.join(workspace, 'core', 'views');
    const premiumViewsPath = path.join(workspace, 'premium', 'views');
    const premiumPartialsPath = path.join(workspace, 'premium', 'partials');
    const handlebars = expressHandlebars.create({
      defaultLayout : 'main',
      extname       : '.hbs',
      layoutsDir    : path.join(coreViewsPath, 'layouts'),
      partialsDir   : [path.join(coreViewsPath, 'partials')],
    });
    const partials = [path.join(coreViewsPath, 'partials'), premiumPartialsPath];

    handlebars.partialsDir = partials;
    handlebars.config.partialsDir = partials;
    writeFile(path.join(coreViewsPath, 'layouts', 'main.hbs'), '<main>{{{body}}}</main>');
    writeFile(path.join(premiumViewsPath, 'premium_feature.hbs'), '<section>{{> premium_feature_table}}</section>');
    writeFile(path.join(premiumPartialsPath, 'premium_feature_table.hbs'), '<table><tr><td>Premium</td></tr></table>');

    const html = await handlebars.renderView(
      path.join(premiumViewsPath, 'premium_feature.hbs'),
      {
        settings: {
          views: [coreViewsPath, premiumViewsPath],
        },
      }
    );

    expect(html).to.contain('<main>');
    expect(html).to.contain('<table><tr><td>Premium</td></tr></table>');
  });
});
