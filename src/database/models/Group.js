'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Group = sequelize.define('Group', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });

  Group.associate = (models) => {
    Group.belongsTo(models.User, { foreignKey: 'creatorId', as: 'creator' });
    Group.hasMany(models.Event, { foreignKey: 'groupId', as: 'events' });
  };

  return Group;
};
