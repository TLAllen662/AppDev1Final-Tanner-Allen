'use strict';
require('dotenv').config();

const { sequelize } = require('./index');

(async () => {
  try {
    // Synchronize all Sequelize models and their relationships to the database.
    // Note: This setup script should only be run in development. Use migrations for production.
    await sequelize.sync({ alter: true, logging: console.log });
    console.log('Database setup complete: tables and relationships are initialized.');
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
