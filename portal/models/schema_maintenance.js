'use strict';

const ensureLicenseMetadataColumn = async (sequelize) => {
  const qi = sequelize.getQueryInterface();

  try {
    const desc = await qi.describeTable('licenses');
    if (desc.metadata) return false;
  } catch (_e) {
    return false;
  }

  await qi.addColumn('licenses', 'metadata', {
    type: 'JSON',
    allowNull: true,
  });

  return true;
};

const runSchemaMaintenance = async (sequelize) => {
  const added = await ensureLicenseMetadataColumn(sequelize);
  return { metadataColumnAdded: added };
};

module.exports = { runSchemaMaintenance, ensureLicenseMetadataColumn };
