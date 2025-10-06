// Ejemplo de endpoint para tu backend Node.js/Express
// Agrega esto a tu archivo de rutas del backend

// GET /api/muscle-groups - Obtener todos los grupos musculares
app.get('/api/muscle-groups', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        mg.name as id,
        mg.display_name as name,
        mg.color,
        array_agg(mmg.exercise_id) as machine_ids
      FROM muscle_groups mg
      LEFT JOIN machine_muscle_groups mmg ON mg.id = mmg.muscle_group_id
      GROUP BY mg.id, mg.name, mg.display_name, mg.color
      ORDER BY mg.display_name
    `);

    const muscleGroups = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
      machineIds: row.machine_ids.filter(id => id !== null) // Remover nulls
    }));

    res.json({
      success: true,
      data: muscleGroups
    });
  } catch (error) {
    console.error('Error fetching muscle groups:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener grupos musculares'
    });
  }
});

// POST /api/muscle-groups/:groupId/exercises - Asociar ejercicio a grupo
app.post('/api/muscle-groups/:groupId/exercises', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { exerciseId, isPrimary = true } = req.body;

    // Verificar que el grupo muscular existe
    const groupCheck = await db.query(
      'SELECT id FROM muscle_groups WHERE name = $1',
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Grupo muscular no encontrado'
      });
    }

    // Insertar la asociación
    await db.query(`
      INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id, is_primary)
      VALUES ($1, $2, $3)
      ON CONFLICT (exercise_id, muscle_group_id) DO NOTHING
    `, [exerciseId, groupCheck.rows[0].id, isPrimary]);

    res.json({
      success: true,
      message: 'Ejercicio asociado correctamente'
    });
  } catch (error) {
    console.error('Error associating exercise:', error);
    res.status(500).json({
      success: false,
      error: 'Error al asociar ejercicio'
    });
  }
});

// DELETE /api/muscle-groups/:groupId/exercises/:exerciseId - Desasociar ejercicio
app.delete('/api/muscle-groups/:groupId/exercises/:exerciseId', async (req, res) => {
  try {
    const { groupId, exerciseId } = req.params;

    await db.query(`
      DELETE FROM machine_muscle_groups mmg
      USING muscle_groups mg
      WHERE mmg.muscle_group_id = mg.id
      AND mg.name = $1
      AND mmg.exercise_id = $2
    `, [groupId, exerciseId]);

    res.json({
      success: true,
      message: 'Asociación eliminada correctamente'
    });
  } catch (error) {
    console.error('Error removing association:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar asociación'
    });
  }
});

// GET /api/exercises/by-muscle-group/:groupId - Obtener ejercicios por grupo
app.get('/api/exercises/by-muscle-group/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;

    const result = await db.query(`
      SELECT DISTINCT e.*
      FROM exercises e
      JOIN machine_muscle_groups mmg ON e.id = mmg.exercise_id
      JOIN muscle_groups mg ON mmg.muscle_group_id = mg.id
      WHERE mg.name = $1
      ORDER BY e.name
    `, [groupId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching exercises by muscle group:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener ejercicios'
    });
  }
});