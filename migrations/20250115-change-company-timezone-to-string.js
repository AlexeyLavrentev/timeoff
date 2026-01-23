module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.changeColumn(
    'Companies',
    'timezone',
    {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'Europe/London',
      comment: 'Timezone current company is located in',
    }
  ),

  down: (queryInterface, Sequelize) => queryInterface.changeColumn(
    'Companies',
    'timezone',
    {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'Timezone current company is located in',
    }
  ),
};
