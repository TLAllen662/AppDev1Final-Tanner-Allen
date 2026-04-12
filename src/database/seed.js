'use strict';
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { sequelize, User, Group, Event, Attendance } = require('./index');

(async () => {
  let transaction;

  try {
    await sequelize.sync({ force: true });

    transaction = await sequelize.transaction();

    const passwordHash = await bcrypt.hash('password123', 12);

    const users = await User.bulkCreate([
      {
        name: 'Maya Rodriguez',
        email: 'maya.organizer@example.com',
        passwordHash,
        role: 'organizer',
      },
      {
        name: 'Daniel Cho',
        email: 'daniel.organizer@example.com',
        passwordHash,
        role: 'organizer',
      },
      {
        name: 'Ava Patel',
        email: 'ava.user@example.com',
        passwordHash,
        role: 'user',
      },
      {
        name: 'Ethan Brooks',
        email: 'ethan.user@example.com',
        passwordHash,
        role: 'user',
      },
      {
        name: 'Liam Nguyen',
        email: 'liam.user@example.com',
        passwordHash,
        role: 'user',
      },
    ], { transaction });

    const [maya, daniel, ava, ethan, liam] = users;

    const groups = await Group.bulkCreate([
      {
        name: 'Downtown Running Club',
        creatorId: maya.id,
      },
      {
        name: 'Tech Study Circle',
        creatorId: daniel.id,
      },
      {
        name: 'Weekend Community Volunteers',
        creatorId: maya.id,
      },
    ], { transaction });

    const [runningClub, studyCircle, volunteers] = groups;

    const events = await Event.bulkCreate([
      {
        organizerId: maya.id,
        groupId: runningClub.id,
        name: 'Sunrise 5K Training',
        location: 'Riverfront Park',
        date: '2026-05-02',
        time: '07:00:00',
        description: 'Beginner-friendly interval training for all paces.',
      },
      {
        organizerId: daniel.id,
        groupId: studyCircle.id,
        name: 'JavaScript Interview Prep Session',
        location: 'Main Library Room B',
        date: '2026-05-05',
        time: '18:30:00',
        description: 'Practice coding prompts and discuss common interview patterns.',
      },
      {
        organizerId: maya.id,
        groupId: volunteers.id,
        name: 'Neighborhood Cleanup Drive',
        location: 'Oak Street Community Center',
        date: '2026-05-10',
        time: '09:00:00',
        description: 'Bring gloves and reusable water bottles. Supplies provided.',
      },
      {
        organizerId: daniel.id,
        groupId: null,
        name: 'Open Networking Mixer',
        location: 'City CoWork Loft',
        date: '2026-05-12',
        time: '19:00:00',
        description: 'Meet local developers, founders, and students.',
      },
    ], { transaction });

    const [trainingRun, interviewPrep, cleanupDrive, mixer] = events;

    await Attendance.bulkCreate([
      { userId: ava.id, eventId: trainingRun.id },
      { userId: ethan.id, eventId: trainingRun.id },
      { userId: liam.id, eventId: interviewPrep.id },
      { userId: ava.id, eventId: interviewPrep.id },
      { userId: ethan.id, eventId: cleanupDrive.id },
      { userId: liam.id, eventId: cleanupDrive.id },
      { userId: ava.id, eventId: mixer.id },
      { userId: ethan.id, eventId: mixer.id },
      { userId: liam.id, eventId: mixer.id },
    ], { transaction });

    await transaction.commit();

    console.log('Database seeded successfully.');
    console.log('Users: 5');
    console.log('Groups: 3');
    console.log('Events: 4');
    console.log('Attendance records: 9');
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
