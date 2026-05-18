// Módulo de catálogo: sync desde Free Exercise DB + endpoints CRUD + traducción.
// Se monta desde server.js via `require('./catalog').register(app, authenticateToken)`.

const db = require('./database');

const FREE_EXERCISE_DB_JSON =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const FREE_EXERCISE_DB_IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// =====================================================================
// Diccionarios fijos para las categorías de Free Exercise DB (enums cerrados).
// Se aplican al vuelo en cada GET — no van a BD.
// =====================================================================
const TRANSLATIONS = {
  equipment: {
    'barbell': 'barra',
    'dumbbell': 'mancuerna',
    'kettlebells': 'kettlebell',
    'machine': 'máquina',
    'cable': 'cable',
    'bands': 'bandas',
    'e-z curl bar': 'barra Z',
    'exercise ball': 'fitball',
    'foam roll': 'foam roller',
    'medicine ball': 'balón medicinal',
    'other': 'otros',
    'body only': 'peso corporal',
    'none': 'ninguno',
  },
  muscle: {
    'abdominals': 'abdominales',
    'abductors': 'abductores',
    'adductors': 'aductores',
    'biceps': 'bíceps',
    'calves': 'gemelos',
    'chest': 'pecho',
    'forearms': 'antebrazos',
    'glutes': 'glúteos',
    'hamstrings': 'isquiotibiales',
    'lats': 'dorsales',
    'lower back': 'lumbares',
    'middle back': 'espalda media',
    'neck': 'cuello',
    'quadriceps': 'cuádriceps',
    'shoulders': 'hombros',
    'traps': 'trapecios',
    'triceps': 'tríceps',
  },
  category: {
    'strength': 'fuerza',
    'stretching': 'estiramientos',
    'plyometrics': 'pliométricos',
    'powerlifting': 'powerlifting',
    'strongman': 'strongman',
    'cardio': 'cardio',
    'olympic weightlifting': 'halterofilia olímpica',
  },
  force: {
    'push': 'empujar',
    'pull': 'tirar',
    'static': 'estático',
  },
  level: {
    'beginner': 'principiante',
    'intermediate': 'intermedio',
    'expert': 'avanzado',
  },
  mechanic: {
    'compound': 'compuesto',
    'isolation': 'aislamiento',
  },
};

function tr(category, value) {
  if (!value) return value;
  return TRANSLATIONS[category]?.[value] || value;
}

function trArr(category, values) {
  if (!Array.isArray(values)) return values;
  return values.map((v) => tr(category, v));
}

// Mete los campos traducidos al vuelo (categorías) + arrastra name_es/instructions_es.
function decorate(row) {
  if (!row) return row;
  return {
    ...row,
    equipment_es: tr('equipment', row.equipment),
    category_es: tr('category', row.category),
    force_es: tr('force', row.force),
    level_es: tr('level', row.level),
    mechanic_es: tr('mechanic', row.mechanic),
    primary_muscles_es: trArr('muscle', row.primary_muscles),
    secondary_muscles_es: trArr('muscle', row.secondary_muscles),
  };
}

function imageUrl(relPath) {
  if (!relPath) return null;
  if (relPath.startsWith('http')) return relPath;
  return FREE_EXERCISE_DB_IMAGE_BASE + relPath;
}

// =====================================================================
// Sync inicial desde Free Exercise DB
// =====================================================================
async function syncCatalog() {
  console.log('🔄 Iniciando sync de catálogo desde Free Exercise DB...');
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

// =====================================================================
// Traducción de nombres + instrucciones con Gemini (en lotes).
// =====================================================================
let _genAI = null;
function getGemini() {
  if (_genAI) return _genAI;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY en .env');
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  _genAI = new GoogleGenerativeAI(key);
  return _genAI;
}

async function translateBatch(rows) {
  const model = getGemini().getGenerativeModel({ model: 'gemini-2.0-flash' });

  const payload = rows.map((r) => ({
    id: r.id,
    name: r.name,
    instructions: r.instructions || [],
  }));

  const prompt = `Eres un traductor especializado en fitness y entrenamiento.
Traduce al ESPAÑOL DE ESPAÑA los siguientes ejercicios de gimnasio.
Usa la terminología deportiva correcta (ej: "Bench Press" -> "Press de banca",
"Squat" -> "Sentadilla", "Deadlift" -> "Peso muerto", "Curl" -> "Curl").
Mantén nombres propios y siglas (EZ, BOSU, TRX). Las instrucciones deben sonar
naturales en español y conservar el mismo número de pasos.

Devuelve EXCLUSIVAMENTE un JSON válido con esta forma exacta, sin markdown ni comentarios:
[
  {"id":"<id>","name_es":"<nombre traducido>","instructions_es":["<paso1>","<paso2>",...]},
  ...
]

Entrada:
${JSON.stringify(payload, null, 2)}`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();

  // Quita fences ```json ... ``` si Gemini decide ponerlos.
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error('⚠️ Respuesta no parseable de Gemini:', text.slice(0, 200));
    throw new Error('Gemini devolvió JSON inválido');
  }
  if (!Array.isArray(parsed)) throw new Error('Gemini no devolvió array');
  return parsed;
}

async function translatePending({ batchSize = 25, maxBatches = 4 } = {}) {
  let totalTranslated = 0;
  let batches = 0;
  let remainingAfter = 0;

  for (let i = 0; i < maxBatches; i++) {
    const { rows } = await db.query(
      `SELECT id, name, instructions
       FROM catalog_exercises
       WHERE name_es IS NULL
       ORDER BY id
       LIMIT $1`,
      [batchSize],
    );
    if (rows.length === 0) break;

    console.log(`🌐 Traduciendo lote ${i + 1} (${rows.length} ejercicios)...`);
    const translations = await translateBatch(rows);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      for (const t of translations) {
        if (!t.id || !t.name_es) continue;
        await client.query(
          `UPDATE catalog_exercises
             SET name_es = $2,
                 instructions_es = $3,
                 translated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [t.id, t.name_es, Array.isArray(t.instructions_es) ? t.instructions_es : []],
        );
        totalTranslated++;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    batches++;

    // Pequeño respiro para no saturar Gemini
    await new Promise((r) => setTimeout(r, 1500));
  }

  const left = await db.query(`SELECT COUNT(*)::int AS n FROM catalog_exercises WHERE name_es IS NULL`);
  remainingAfter = left.rows[0]?.n || 0;

  return { batches, totalTranslated, remaining: remainingAfter };
}

// =====================================================================
// Registro de rutas
// =====================================================================
function register(app, authenticateToken) {
  // POST /api/catalog/sync — re-llena el catálogo desde Free Exercise DB.
  app.post('/api/catalog/sync', authenticateToken, async (req, res) => {
    try {
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

  // POST /api/catalog/translate — traduce ejercicios pendientes con Gemini.
  // Body opcional: { batchSize, maxBatches }
  // Idempotente: solo procesa filas con name_es IS NULL. Re-llamar varias veces hasta vaciar.
  app.post('/api/catalog/translate', authenticateToken, async (req, res) => {
    try {
      const userRes = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
      if (!userRes.rows[0]?.is_admin) {
        return res.status(403).json({ error: 'Solo admin' });
      }
      const batchSize = Math.min(parseInt(req.body?.batchSize, 10) || 25, 40);
      const maxBatches = Math.min(parseInt(req.body?.maxBatches, 10) || 4, 40);
      const result = await translatePending({ batchSize, maxBatches });
      res.json({ success: true, ...result });
    } catch (err) {
      console.error('❌ Error en /api/catalog/translate:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/catalog — buscar/filtrar el catálogo.
  // Busca en name y name_es.
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
        const i = params.length;
        conditions.push(`(name ILIKE $${i} OR coalesce(name_es,'') ILIKE $${i})`);
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
        SELECT id, name, name_es, force, level, mechanic, equipment, category,
               primary_muscles, secondary_muscles, images, translated_at
        FROM catalog_exercises
        ${where}
        ORDER BY coalesce(name_es, name) ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;
      const result = await db.query(sql, params);

      const countSql = `SELECT COUNT(*)::int AS total FROM catalog_exercises ${where}`;
      const countParams = params.slice(0, params.length - 2);
      const countRes = await db.query(countSql, countParams);

      res.json({
        success: true,
        data: result.rows.map(decorate),
        total: countRes.rows[0]?.total || 0,
        limit,
        offset,
      });
    } catch (err) {
      console.error('❌ Error en /api/catalog:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/catalog/:id — detalle completo
  app.get('/api/catalog/:id', async (req, res) => {
    try {
      const result = await db.query(`SELECT * FROM catalog_exercises WHERE id = $1`, [req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'No encontrado' });
      res.json({ success: true, data: decorate(result.rows[0]) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/catalog/meta/filters — listas para selects de filtros (con traducción)
  app.get('/api/catalog/meta/filters', async (req, res) => {
    try {
      const eq = await db.query(`SELECT DISTINCT equipment FROM catalog_exercises WHERE equipment IS NOT NULL ORDER BY equipment`);
      const mus = await db.query(`SELECT DISTINCT unnest(primary_muscles) AS m FROM catalog_exercises ORDER BY m`);
      res.json({
        success: true,
        equipment: eq.rows.map((r) => ({ value: r.equipment, label: tr('equipment', r.equipment) })),
        muscles: mus.rows.map((r) => ({ value: r.m, label: tr('muscle', r.m) })),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/catalog/meta/progress — cuántos quedan por traducir
  app.get('/api/catalog/meta/progress', async (req, res) => {
    try {
      const total = await db.query(`SELECT COUNT(*)::int AS n FROM catalog_exercises`);
      const done = await db.query(`SELECT COUNT(*)::int AS n FROM catalog_exercises WHERE name_es IS NOT NULL`);
      res.json({
        success: true,
        total: total.rows[0]?.n || 0,
        translated: done.rows[0]?.n || 0,
        pending: (total.rows[0]?.n || 0) - (done.rows[0]?.n || 0),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/user-exercises — ejercicios añadidos por el usuario
  app.get('/api/user-exercises', authenticateToken, async (req, res) => {
    try {
      const result = await db.query(
        `SELECT
            ua.id AS user_exercise_id,
            ua.added_at,
            c.id, c.name, c.name_es, c.force, c.level, c.mechanic, c.equipment,
            c.category, c.primary_muscles, c.secondary_muscles, c.images
          FROM user_added_exercises ua
          JOIN catalog_exercises c ON ua.catalog_id = c.id
          WHERE ua.user_id = $1
          ORDER BY ua.added_at DESC`,
        [req.user.userId],
      );
      res.json({ success: true, data: result.rows.map(decorate) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

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

module.exports = { register, syncCatalog, translatePending };
