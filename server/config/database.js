const mysql = require('mysql2/promise');
const { DB } = require('./constants');

// Validate required environment variables
const requiredEnvVars = ['DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required database environment variables:', missingVars.join(', '));
  console.error('💡 Please check your .env file');
  process.exit(1);
}

const pool = mysql.createPool({
  host: DB.host,
  user: DB.user,
  password: DB.password,
  database: DB.database,
  connectionLimit: DB.connectionLimit,
  acquireTimeout: DB.acquireTimeout,
  timeout: DB.timeout
});

console.log(`🗄️ Database pool created for ${DB.database}@${DB.host}`);

module.exports = pool;