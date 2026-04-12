'use strict';
require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/database');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize database connection:', error.message);
    process.exitCode = 1;
  }
})();
