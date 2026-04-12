'use strict';
require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/database');

const PORT = process.env.PORT || 3000;

(async () => {
  await sequelize.sync({ alter: true });
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
