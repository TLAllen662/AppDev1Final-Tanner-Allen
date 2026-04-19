'use strict';
const { Sequelize } = require('sequelize');
const path = require('path');

const isDevelopmentLogging = process.env.NODE_ENV === 'development' ? console.log : false;

function createSequelizeInstance() {
  if (process.env.DATABASE_URL) {
    const useSsl = process.env.DB_SSL === 'true';
    return new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: isDevelopmentLogging,
      dialectOptions: useSsl
        ? {
            ssl: {
              require: true,
              rejectUnauthorized: false,
            },
          }
        : {},
    });
  }

  const storagePath = process.env.DB_STORAGE
    ? path.resolve(process.env.DB_STORAGE)
    : path.join(__dirname, '../../database.sqlite');

  return new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: isDevelopmentLogging,
  });
}

const sequelize = createSequelizeInstance();

const User = require('./models/User')(sequelize);
const Event = require('./models/Event')(sequelize);
const Attendance = require('./models/Attendance')(sequelize);
const Group = require('./models/Group')(sequelize);

const models = { User, Event, Attendance, Group };

// Run associations
Object.values(models).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(models);
  }
});

module.exports = { sequelize, ...models };
