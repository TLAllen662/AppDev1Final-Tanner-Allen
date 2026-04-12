'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Attendance = sequelize.define('Attendance', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
    },
    eventId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Events',
        key: 'id',
      },
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ['userId', 'eventId'],
      },
    ],
  });

  Attendance.associate = (models) => {
    Attendance.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Attendance.belongsTo(models.Event, { foreignKey: 'eventId', as: 'event' });
  };

  return Attendance;
};
