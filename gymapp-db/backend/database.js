const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Función para probar la conexión
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('🗄️ Conexión a PostgreSQL exitosa');
    console.log('⏰ Hora del servidor DB:', result.rows[0].current_time);
    console.log('📋 Versión PostgreSQL:', result.rows[0].postgres_version.split(' ')[0]);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    return false;
  }
};

// Función para ejecutar queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Query ejecutado', { text: text.substring(0, 50) + '...', duration, rows: result.rowCount });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ Error en query', { text: text.substring(0, 50) + '...', duration, error: error.message });
    throw error;
  }
};

// Función para obtener un cliente de la pool (para transacciones)
const getClient = async () => {
  return await pool.connect();
};

module.exports = {
  query,
  getClient,
  testConnection,
  pool
};