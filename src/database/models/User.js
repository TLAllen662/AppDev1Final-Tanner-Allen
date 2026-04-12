'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('user', 'organizer'),
      allowNull: false,
      defaultValue: 'user',
    },
  });

  User.associate = (models) => {
    User.hasMany(models.Event, { foreignKey: 'organizerId', as: 'organizedEvents' });
    User.belongsToMany(models.Event, { through: models.Attendance, foreignKey: 'userId', as: 'attendedEvents' });
    User.hasMany(models.Group, { foreignKey: 'creatorId', as: 'createdGroups' });
  };

  return User;
};
