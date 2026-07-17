'use strict';

const path = require('path');
const {expect} = require('chai');
const puppeteer = require('puppeteer');

describe('Responsive application header', function() {
  this.timeout(15000);

  let browser;

  before(async function() {
    browser = await puppeteer.launch({
      headless : true,
      args     : ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  after(async function() {
    if (browser) await browser.close();
  });

  it('keeps utility navigation clear of primary navigation at intermediate widths', async function() {
    const page = await browser.newPage();
    await page.setContent(`
      <div class="app-container">
        <header class="header">
          <nav class="navbar navbar-default app-navbar">
            <div class="container-fluid">
              <div class="navbar-header">
                <a class="navbar-brand" href="#">LeavePilot</a>
              </div>
              <div class="collapse navbar-collapse" style="display: block">
                <ul class="nav navbar-nav navbar-left primary-navigation">
                  <li><a href="#">Календарь</a></li>
                  <li><a href="#">Команда</a></li>
                  <li><a href="#">Обзор команды</a></li>
                  <li><a href="#">Баланс времени</a></li>
                  <li><a href="#">План отпусков</a></li>
                  <li class="hidden-xs"><a href="#">Сотрудники</a></li>
                  <li class="navbar-form navbar-left">
                    <button class="btn btn-info navbar-primary-action">Новое отсутствие</button>
                  </li>
                </ul>
                <ul class="nav navbar-nav navbar-right">
                  <li><a class="nav-icon-link" href="#"><span class="fa fa-sun-o"></span><span class="caret"></span></a></li>
                  <li><a class="nav-icon-link" href="#"><span class="fa fa-language"></span><span class="caret"></span></a></li>
                  <li><a class="nav-icon-link" href="#"><span class="fa fa-bell-o"></span></a></li>
                  <li><a class="nav-icon-link" href="#"><span class="fa fa-cog"></span><span class="caret"></span></a></li>
                  <li><a class="nav-icon-link" href="#"><span class="fa fa-user"></span><span class="caret"></span></a></li>
                </ul>
              </div>
            </div>
          </nav>
        </header>
      </div>
    `);
    await page.addStyleTag({
      path: path.join(__dirname, '..', '..', 'public', 'css', 'style.css'),
    });

    for (const width of [769, 900, 1050, 1199, 1200, 1360]) {
      await page.setViewport({width, height: 800});

      const layout = await page.evaluate(() => {
        const primaryItems = Array.from(document.querySelectorAll('.primary-navigation > li'));
        const utility = document.querySelector('.navbar-right').getBoundingClientRect();
        const primaryRight = Math.max(...primaryItems.map(item => item.getBoundingClientRect().right));
        const sameRow = primaryItems.some(item => {
          const rect = item.getBoundingClientRect();
          return rect.top < utility.bottom && rect.bottom > utility.top;
        });

        return {
          primaryRight,
          utilityLeft : utility.left,
          sameRow,
        };
      });

      if (layout.sameRow) {
        expect(layout.primaryRight, `navigation overlaps at ${width}px`)
          .to.be.at.most(layout.utilityLeft);
      }
    }

    await page.close();
  });
});
