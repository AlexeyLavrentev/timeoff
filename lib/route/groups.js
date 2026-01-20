"use strict";

const express = require('express'),
  router = express.Router(),
  validator = require('validator'),
  Promise = require('bluebird');

const { sorter } = require('../util');

// Make sure that current user is authorized to deal with settings
router.all(/.*/, require('../middleware/ensure_user_is_admin'));

router.get('/groups/', function(req, res){
  const model = req.app.get('db_model');

  req.user.getCompany({
    scope : ['with_active_users'],
  })
  .then(company => Promise.join(
    company.getGroups({
      include : [{ model : model.User, as : 'users', through: { attributes: [] } }],
      order : [ model.Group.default_order_field() ],
    }),
    Promise.resolve(company),
    (groups, company) => ({ groups, company })
  ))
  .then(({groups, company}) => {
    res.render('groups_overview', {
      title   : 'Groups',
      groups  : groups.sort((a, b) => sorter(a.name, b.name)),
      company : company,
    });
  });
});

router.post('/groups/', function(req, res){
  const model = req.app.get('db_model');

  const name = validator.trim(req.body['name'] || '');

  if (!name.length) {
    req.session.flash_error('Group name is required');
    return res.redirect_with_session('/settings/groups/');
  }

  req.user.getCompany()
    .then(company => model.Group.findOne({
      where : { name : name, companyId : company.id },
    })
    .then(existing => {
      if (existing) {
        req.session.flash_error('Group with the same name already exists');
        return res.redirect_with_session('/settings/groups/');
      }
      return req.user.getCompany();
    })
    .then(company => model.Group.create({
      name : name,
      companyId : company.id,
    }))
    .then(() => {
      req.session.flash_message('Group was created');
      res.redirect_with_session('/settings/groups/');
    })
    .catch(error => {
      console.error('Failed to create group: ' + error);
      req.session.flash_error('Failed to create group');
      res.redirect_with_session('/settings/groups/');
    });
});

router.get('/groups/edit/:group_id/', function(req, res){
  const group_id = req.params['group_id'];
  const model = req.app.get('db_model');

  if (!validator.isInt(group_id)) {
    req.session.flash_error('Invalid group id');
    return res.redirect_with_session('/settings/groups/');
  }

  req.user.getCompany({
    scope : ['with_active_users'],
  })
  .then(company => Promise.join(
    model.Group.findOne({
      where : { id : group_id, companyId : company.id },
      include : [{ model : model.User, as : 'users', through: { attributes: [] } }],
    }),
    Promise.resolve(company),
    (group, company) => ({ group, company })
  ))
  .then(({group, company}) => {
    if (!group) {
      req.session.flash_error('Group not found');
      return res.redirect_with_session('/settings/groups/');
    }

    const group_user_ids = group.users.map(user => user.id);
    const group_user_map = group_user_ids.reduce((acc, id) => {
      acc[id] = true;
      return acc;
    }, {});

    res.render('group_details', {
      title : 'Group details',
      group : group,
      company : company,
      group_user_ids : group_user_ids,
      group_user_map : group_user_map,
    });
  })
  .catch(error => {
    console.error('Failed to load group details: ' + error);
    req.session.flash_error('Failed to load group details');
    res.redirect_with_session('/settings/groups/');
  });
});

router.post('/groups/edit/:group_id/', function(req, res){
  const group_id = req.params['group_id'];
  const model = req.app.get('db_model');

  if (!validator.isInt(group_id)) {
    req.session.flash_error('Invalid group id');
    return res.redirect_with_session('/settings/groups/');
  }

  const name = validator.trim(req.body['name'] || '');

  if (!name.length) {
    req.session.flash_error('Group name is required');
    return res.redirect_with_session('/settings/groups/edit/' + group_id + '/');
  }

  const member_ids_raw = req.body['group_user_ids'];
  const member_ids = Array.isArray(member_ids_raw)
    ? member_ids_raw
    : member_ids_raw
      ? [member_ids_raw]
      : [];

  req.user.getCompany({
    scope : ['with_active_users'],
  })
  .then(company => model.Group.findOne({
    where : { id : group_id, companyId : company.id },
    include : [{ model : model.User, as : 'users', through: { attributes: [] } }],
  }))
  .then(group => {
    if (!group) {
      req.session.flash_error('Group not found');
      return res.redirect_with_session('/settings/groups/');
    }

    return req.user.getCompany({ scope : ['with_active_users'] })
      .then(company => {
        const allowed_user_ids = company.users.map(user => String(user.id));
        const normalized_member_ids = member_ids
          .map(id => String(id))
          .filter(id => allowed_user_ids.indexOf(id) !== -1);

        return group.updateAttributes({ name : name })
          .then(() => group.setUsers(normalized_member_ids))
          .then(() => group);
      });
  })
  .then(group => {
    if (group) {
      req.session.flash_message('Group was updated');
    }
    res.redirect_with_session('/settings/groups/edit/' + group_id + '/');
  })
  .catch(error => {
    console.error('Failed to update group: ' + error);
    req.session.flash_error('Failed to update group');
    res.redirect_with_session('/settings/groups/edit/' + group_id + '/');
  });
});

router.post('/groups/delete/:group_id/', function(req, res){
  const group_id = req.params['group_id'];
  const model = req.app.get('db_model');

  if (!validator.isInt(group_id)) {
    req.session.flash_error('Invalid group id');
    return res.redirect_with_session('/settings/groups/');
  }

  req.user.getCompany()
    .then(company => model.Group.findOne({
      where : { id : group_id, companyId : company.id },
    }))
    .then(group => {
      if (!group) {
        req.session.flash_error('Group not found');
        return res.redirect_with_session('/settings/groups/');
      }
      return group.setUsers([]).then(() => group.destroy());
    })
    .then(() => {
      req.session.flash_message('Group was removed');
      res.redirect_with_session('/settings/groups/');
    })
    .catch(error => {
      console.error('Failed to delete group: ' + error);
      req.session.flash_error('Failed to delete group');
      res.redirect_with_session('/settings/groups/');
    });
});

module.exports = router;
