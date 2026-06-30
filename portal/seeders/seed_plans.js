'use strict';

const fs = require('fs');
const path = require('path');

const PRESETS_PATH = path.join(__dirname, '..', '..', 'config', 'plan_presets.json');

const seedPlans = async Plan => {
  let presets;

  try {
    presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
  } catch (error) {
    throw new Error('Cannot load plan presets from ' + PRESETS_PATH + ': ' + error.message);
  }

  const results = [];

  for (const [name, preset] of Object.entries(presets)) {
    const [record, created] = await Plan.findOrCreate({
      where: { name },
      defaults: {
        description: preset.description || '',
        features: preset.features || [],
      },
    });

    if (!created) {
      await record.update({
        description: preset.description || record.description,
        features: preset.features || record.features,
      });
    }

    results.push({ name, created });
  }

  return results;
};

module.exports = { seedPlans };
