'use strict';

const listPlans = async (Plan) => {
  return Plan.findAll({
    order: [['name', 'ASC']],
  });
};

const getPlan = async (Plan, id) => {
  const plan = await Plan.findByPk(id);
  if (!plan) {
    throw Object.assign(new Error('Plan not found'), { code: 'NOT_FOUND' });
  }
  return plan;
};

module.exports = { listPlans, getPlan };
