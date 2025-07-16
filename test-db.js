const mysql = require('mysql2/promise');

async function testDB() {
  const DB_CONFIG = {
    host: '127.0.0.1',
    user: 'actuauser',
    password: 'bEphuq$dr5m@',
    database: 'actinvent'
  };

  try {
    console.log('Testing database connection...');
    const connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Database connected successfully');
    
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM item');
    console.log('📊 Found', rows[0].count, 'items in database');
    
    await connection.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
}

testDB();