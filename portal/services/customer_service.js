'use strict';

const listCustomers = async (Customer) => {
  return Customer.findAll({
    order: [['name', 'ASC']],
  });
};

const createCustomer = async (Customer, data) => {
  if (!data.name || !data.name.trim()) {
    throw Object.assign(new Error('Customer name is required'), { code: 'VALIDATION_ERROR' });
  }

  const existing = await Customer.findOne({ where: { name: data.name.trim() } });
  if (existing) {
    throw Object.assign(new Error('Customer with this name already exists'), { code: 'DUPLICATE' });
  }

  return Customer.create({
    name: data.name.trim(),
    contactEmail: data.contactEmail || null,
    contactName: data.contactName || null,
    notes: data.notes || null,
  });
};

const getCustomer = async (Customer, id) => {
  const customer = await Customer.findByPk(id);
  if (!customer) {
    throw Object.assign(new Error('Customer not found'), { code: 'NOT_FOUND' });
  }
  return customer;
};

module.exports = { listCustomers, createCustomer, getCustomer };
