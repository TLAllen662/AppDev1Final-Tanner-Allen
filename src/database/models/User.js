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
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [60, 255],
      },
    },
    role: {
      type: DataTypes.ENUM('user', 'organizer'),
      allowNull: false,
      defaultValue: 'user',
      validate: {
        isIn: [['user', 'organizer']],
      },
    },
  });

  User.associate = (models) => {
    User.hasMany(models.Event, { foreignKey: 'organizerId', as: 'organizedEvents' });
    User.hasMany(models.Attendance, { foreignKey: 'userId', as: 'attendanceRecords' });
    User.belongsToMany(models.Event, { through: models.Attendance, foreignKey: 'userId', as: 'attendedEvents' });
    User.hasMany(models.Group, { foreignKey: 'creatorId', as: 'createdGroups' });
  };

  return User;
};
