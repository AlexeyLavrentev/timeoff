'use strict';

const fs = require('fs');
const path = require('path');
const {expect} = require('chai');

const viewSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'views', 'users.hbs'),
  'utf8'
);

describe('Employees page filter semantics', function() {
  it('marks the active department/group filter with aria-current="true"', function() {
    // "All departments" is current when no department_id is selected.
    expect(viewSource).to.match(
      /href="\/users\/" class="list-group-item\{\{#unless department_id \}\} selected-item\{\{\/unless\}}"\{\{#unless department_id \}\} aria-current="true"\{\{\/unless\}}/
    );

    // Each department is current when its id matches department_id.
    expect(viewSource).to.match(
      /\{\{#if_equal \.\.\/department_id this\.id\}\} selected-item\{\{\/if_equal\}}"\{\{#if_equal \.\.\/department_id this\.id\}\} aria-current="true"\{\{\/if_equal\}} href="\/users\/\?department=\{\{this\.id\}}"/
    );

    // "All groups" is current when no group_id is selected.
    expect(viewSource).to.match(
      /href="\/users\/" class="list-group-item\{\{#unless group_id \}\} selected-item\{\{\/unless\}}"\{\{#unless group_id \}\} aria-current="true"\{\{\/unless\}}/
    );

    // Each group is current when its id matches group_id.
    expect(viewSource).to.match(
      /\{\{#if_equal \.\.\/group_id this\.id\}\} selected-item\{\{\/if_equal\}}"\{\{#if_equal \.\.\/group_id this\.id\}\} aria-current="true"\{\{\/if_equal\}} href="\/users\/\?group=\{\{this\.id\}}"/
    );
  });

  it('preserves the existing selected-item class alongside aria-current', function() {
    // aria-current must not replace the styling hook; both must coexist.
    const matches = viewSource.match(/aria-current="true"/g);
    expect(matches, 'expected four aria-current usages').to.have.lengthOf(4);
    expect(viewSource).to.include('selected-item');
  });
});
