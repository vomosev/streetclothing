'use strict';

require('dotenv').config();

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'streetclothing',
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  multipleStatements: false,
});

async function checkDatabaseConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.ping();
    return true;
  } catch (error) {
    console.error('[db] connection check failed:', error && error.message ? error.message : error);
    return false;
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('[db] failed to release connection:', releaseError && releaseError.message);
      }
    }
  }
}

module.exports = { pool, checkDatabaseConnection };