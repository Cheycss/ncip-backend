import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../database.js';

const users = [
  {
    username: 'admin',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@ncip.gov',
    password: 'admin123',
    role: 'admin',
    isActive: true,
    isApproved: true,
    phoneNumber: '09171234567',
    address: 'General Santos City'
  },
  {
    username: 'user1',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'juan@example.com',
    password: 'User123',
    role: 'user',
    isActive: true,
    isApproved: true,
    phoneNumber: '09171231234',
    address: 'Koronadal City'
  }
];

async function seedUsers() {
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [user.email]);

    if (existing.length > 0) {
      await pool.query(
        `UPDATE users
         SET username = ?, first_name = ?, last_name = ?, password_hash = ?, role = ?, is_active = ?, is_approved = ?, phone_number = ?, address = ?
         WHERE user_id = ?`,
        [
          user.username,
          user.firstName,
          user.lastName,
          passwordHash,
          user.role,
          user.isActive ? 1 : 0,
          user.isApproved ? 1 : 0,
          user.phoneNumber,
          user.address,
          existing[0].user_id
        ]
      );
      console.log(`Updated ${user.email}`);
    } else {
      await pool.query(
        `INSERT INTO users (username, first_name, last_name, email, password_hash, role, is_active, is_approved, phone_number, address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.username,
          user.firstName,
          user.lastName,
          user.email,
          passwordHash,
          user.role,
          user.isActive ? 1 : 0,
          user.isApproved ? 1 : 0,
          user.phoneNumber,
          user.address
        ]
      );
      console.log(`Inserted ${user.email}`);
    }
  }
}

async function main() {
  try {
    await seedUsers();
    console.log('User seeding completed.');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
