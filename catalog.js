// Módulo de catálogo: sync desde Free Exercise DB + endpoints CRUD.
// Se monta desde server.js via `require('./catalog').register(app, authenticateToken)`.

const db = require('./database');

const FREE_EXERCISE_DB_JSON =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const FREE_EXERCISE_DB_IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

function imageUrl(relPath) {
  if (!relPath) return null;
  if (relPath.startsWith('http')) return relPath;
  return FREE_EXERCISE_DB_IMAGE_BASE + relPath;
}

async function syncCatalog() {
  console.log('🔄 Iniciando sync de catálogo desde Free Exercise DB...');
  // Node 18+ tiene fetch global. Si no, descomenta:
  // const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
  const res = await fetch(FREE_EXERCISE_DB_JSON);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar catálogo`);
  const exercises = await res.json();
  console.log(`📦 ${exercises.length} ejercicios descargados`);

  const client = await db.getClient();
  let upserted = 0;
  try {
    await client.query('BEGIN');
    for (const ex of exercises) {
      const id = ex.id || ex.name.replace(/\s+/g, '_');
      const images = (ex.images || []).map(imageUrl).filter(Boolean);
      await client.query(
        `INSERT INTO catalog_exercises
          (id, name, force, level, mechanic, equipment, category,
           primary_muscles, secondary_muscles, instructions, images, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           force = EXCLUDED.force,
           level = EXCLUDED.level,
           mechanic = EXCLUDED.mechanic,
           equipment = EXCLUDED.equipment,
           category = EXCLUDED.category,
           primary_muscles = EXCLUDED.primary_muscles,
           secondary_muscles = EXCLUDED.secondary_muscles,
           instructions = EXCLUDED.instructions,
           images = EXCLUDED.images,
           synced_at = CURRENT_TIMESTAMP`,
        [
          id,
          ex.name,
          ex.force || null,
          ex.level || null,
          ex.mechanic || null,
          ex.equipment || null,
          ex.category || null,
          ex.primaryMuscles || [],
          ex.secondaryMuscles || [],
          ex.instructions || [],
          images,
        ],
      );
      upserted++;
    }
    await client.query('COMMIT');
    console.log(`✅ Sync completado: ${upserted} ejercicios upserted`);
    return { upserted, total: exercises.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function register(app, authenticateToken) {
  // POST /api/catalog/sync — re-llena el catálogo desde Free Exercise DB.
  // Solo admin. Idempotente: usa ON CONFLICT.
  app.post('/api/catalog/sync', authenticateToken, async (req, res) => {
    try {
      // Verificar admin
      const userRes = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
      if (!userRes.rows[0]?.is_admin) {
        return res.status(403).json({ error: 'Solo admin' });
      }
      const result = await syncCatalog();
      res.json({ success: true, ...result });
    } catch (err) {
      console.error('❌ Error en /api/catalog/sync:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/catalog — buscar/filtrar el catálogo.
  // Query params: q (search), equipment, muscle, limit (default 30), offset (default 0)
  app.get('/api/catalog', async (req, res) => {
    try {
      const q = (req.query.q || '').trim();
      const equipment = (req.query.equipment || '').trim();
      const muscle = (req.query.muscle || '').trim();
      const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

      const conditions = [];
      const params = [];
      if (q) {
        params.push(`%${q}%`);
        conditions.push(`name ILIKE $${params.length}`);
      }
      if (equipment) {
        params.push(equipment);
        conditions.push(`equipment = $${params.length}`);
      }
      if (muscle) {
        params.push(muscle);
        conditions.push(`$${params.length} = ANY(primary_muscles)`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      params.push(limit, offset);
      const sql = `
        SELECT id, name, force, level, mechanic, equipment, category,
               primary_muscles, secondary_muscles, images
        FROM catalog_exercises
        ${where}
        ORDER BY name ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;
      const result = await db.query(sql, params);

      // count
      const countSql = `SELECT COUNT(*)::int AS total FROM catalog_exercises ${where}`;
      const countParams = params.slice(0, params.length - 2);
      const countRes = await db.query(countSql, countParams);

      res.json({
        success: true,
        data: result.rows,
        total: countRes.rows[0]?.total || 0,
        limit,
        offset,
      });
    } catch (err) {
      console.error('❌ Error en /api/catalog:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/catalog/:id — detalle completo (incluye instructions).
  app.get('/api/catalog/:id', async (req, res) => {
    try {
      const result = await db.query(
        `SELECT * FROM catalog_exercises WHERE id = $1`,
        [req.params.id],
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'No encontrado' });
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/catalog/meta/filters — listas de filtros disponibles (equipment, muscles).
  app.get('/api/catalog/meta/filters', async (req, res) => {
    try {
      const eq = await db.query(`SELECT DISTINCT equipment FROM catalog_exercises WHERE equipment IS NOT NULL ORDER BY equipment`);
      const mus = await db.query(`SELECT DISTINCT unnest(primary_muscles) AS m FROM catalog_exercises ORDER BY m`);
      res.json({
        success: true,
        equipment: eq.rows.map((r) => r.equipment),
        muscles: mus.rows.map((r) => r.m),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/user-exercises — lista de ejercicios añadidos por el usuario.
  app.get('/api/user-exercises', authenticateToken, async (req, res) => {
    try {
      const result = await db.query(
        `SELECT
            ua.id AS user_exercise_id,
            ua.added_at,
            c.id, c.name, c.force, c.level, c.mechanic, c.equipment,
            c.category, c.primary_muscles, c.secondary_muscles, c.images
          FROM user_added_exercises ua
          JOIN catalog_exercises c ON ua.catalog_id = c.id
          WHERE ua.user_id = $1
          ORDER BY ua.added_at DESC`,
        [req.user.userId],
      );
      res.json({ success: true, data: result.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/user-exercises — añadir ejercicio del catálogo al usuario.
  app.post('/api/user-exercises', authenticateToken, async (req, res) => {
    try {
      const { catalog_id } = req.body || {};
      if (!catalog_id) return res.status(400).json({ error: 'Falta catalog_id' });

      const exists = await db.query('SELECT id FROM catalog_exercises WHERE id = $1', [catalog_id]);
      if (!exists.rows[0]) return res.status(404).json({ error: 'Ejercicio no en catálogo' });

      const result = await db.query(
        `INSERT INTO user_added_exercises (user_id, catalog_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, catalog_id) DO NOTHING
         RETURNING id, added_at`,
        [req.user.userId, catalog_id],
      );

      res.json({
        success: true,
        added: result.rows.length > 0,
        data: result.rows[0] || null,
      });
    } catch (err) {
      console.error('❌ Error en POST /api/user-exercises:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE-via-POST /api/user-exercises/:catalogId/delete — quitar (mismo patrón que el resto del backend).
  app.post('/api/user-exercises/:catalogId/delete', authenticateToken, async (req, res) => {
    try {
      const result = await db.query(
        'DELETE FROM user_added_exercises WHERE user_id = $1 AND catalog_id = $2',
        [req.user.userId, req.params.catalogId],
      );
      res.json({ success: true, removed: result.rowCount });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { register, syncCatalog };
