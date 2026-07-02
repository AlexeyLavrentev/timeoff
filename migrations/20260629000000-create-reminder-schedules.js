"use strict";

/**
 * Migration: Create ReminderSchedules table
 *
 * Adds flexible reminder scheduling with:
 * - Multiple reminder timing (T-14, T-7, T-3, etc.)
 * - Per-leave-type schedules
 * - Custom email templates
 * - Flexible recipient selection
 *
 * Guarded with a table-existence check: installations that ran this
 * migration from the premium module already have the table, and the
 * file moved to core under the same name.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = (tables || []).map(table =>
      typeof table === 'string' ? table : table && (table.tableName || table.name)
    );

    if (normalizedTables.indexOf('ReminderSchedules') !== -1) {
      return;
    }

    await queryInterface.createTable('ReminderSchedules', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      // Company association
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // Leave type filter (NULL = all leave types)
      leave_type_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'LeaveTypes',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      // Reminder configuration
      days_before: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Days before leave start to send reminder',
      },

      // Who receives the reminder
      recipient_supervisor: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Send to department supervisor',
      },

      recipient_employee: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Send to employee going on leave',
      },

      // Custom email templates (optional)
      email_subject_custom: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Custom email subject (overrides default)',
      },

      email_body_custom: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Custom email body (overrides default)',
      },

      // Active/inactive toggle
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    }, {
      tableName: 'ReminderSchedules',
      underscored: true,
      timestamps: true,

      indexes: [
        {
          name: 'reminder_schedules_company_active',
          fields: ['company_id', 'is_active'],
        },
        {
          name: 'reminder_schedules_leave_type',
          fields: ['leave_type_id'],
        },
        {
          name: 'reminder_schedules_unique_per_company',
          unique: true,
          fields: ['company_id', 'leave_type_id', 'days_before'],
          where: {
            is_active: true,
          },
        },
      ],

      comment: 'Flexible reminder schedules for leave start notifications',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ReminderSchedules');
  },
};
