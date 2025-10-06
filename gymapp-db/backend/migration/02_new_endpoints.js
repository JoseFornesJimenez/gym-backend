// ========================================
// MIGRACIÓN: Nuevos endpoints para grupos musculares
// ========================================
// Agrega estos endpoints a tu server.js actual

// ============= ENDPOINTS DE GRUPOS MUSCULARES =============

// Obtener todos los grupos musculares
app.get('/api/muscle-groups', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                mg.id,
                mg.name,
                mg.description,
                COUNT(mmg.machine_id) as machine_count
            FROM muscle_groups mg
            LEFT JOIN machine_muscle_groups mmg ON mg.id = mmg.muscle_group_id
            GROUP BY mg.id, mg.name, mg.description
            ORDER BY mg.name
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching muscle groups:', error);
        res.status(500).json({ error: 'Error al obtener grupos musculares' });
    }
});

// Obtener máquinas por grupo muscular
app.get('/api/muscle-groups/:id/machines', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                m.id,
                m.name,
                m.description,
                m.image_url,
                mmg.is_primary
            FROM machines m
            JOIN machine_muscle_groups mmg ON m.id = mmg.machine_id
            WHERE mmg.muscle_group_id = $1
            ORDER BY mmg.is_primary DESC, m.name
        `, [id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching machines for muscle group:', error);
        res.status(500).json({ error: 'Error al obtener máquinas del grupo muscular' });
    }
});

// Asociar máquina con grupo muscular
app.post('/api/machines/:machineId/muscle-groups/:groupId', async (req, res) => {
    try {
        const { machineId, groupId } = req.params;
        const { is_primary = false } = req.body;
        
        const result = await pool.query(`
            INSERT INTO machine_muscle_groups (machine_id, muscle_group_id, is_primary)
            VALUES ($1, $2, $3)
            ON CONFLICT (machine_id, muscle_group_id) 
            DO UPDATE SET is_primary = $3
            RETURNING *
        `, [machineId, groupId, is_primary]);
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error associating machine with muscle group:', error);
        res.status(500).json({ error: 'Error al asociar máquina con grupo muscular' });
    }
});

// Desasociar máquina de grupo muscular
app.delete('/api/machines/:machineId/muscle-groups/:groupId', async (req, res) => {
    try {
        const { machineId, groupId } = req.params;
        
        await pool.query(`
            DELETE FROM machine_muscle_groups 
            WHERE machine_id = $1 AND muscle_group_id = $2
        `, [machineId, groupId]);
        
        res.json({ message: 'Asociación eliminada correctamente' });
    } catch (error) {
        console.error('Error removing association:', error);
        res.status(500).json({ error: 'Error al eliminar asociación' });
    }
});

// ============= ENDPOINTS MEJORADOS DE IA =============

// Análisis mejorado de datos del usuario
app.post('/api/ai/analyze-improved', async (req, res) => {
    try {
        const { userId, muscleGroupId } = req.body;
        
        // Obtener datos de entrenamientos con análisis por ejercicio
        const workoutData = await pool.query(`
            SELECT 
                w.id,
                w.date,
                e.machine_id,
                m.name as machine_name,
                e.sets,
                e.reps,
                e.weight
            FROM workouts w
            JOIN exercises e ON w.id = e.workout_id
            JOIN machines m ON e.machine_id = m.id
            LEFT JOIN machine_muscle_groups mmg ON m.id = mmg.machine_id
            WHERE w.user_id = $1 
                AND ($2 IS NULL OR mmg.muscle_group_id = $2)
            ORDER BY w.date DESC, m.name
            LIMIT 100
        `, [userId, muscleGroupId]);

        // Análisis detallado por ejercicio
        const exerciseAnalysis = {};
        
        workoutData.rows.forEach(row => {
            const key = row.machine_name;
            if (!exerciseAnalysis[key]) {
                exerciseAnalysis[key] = {
                    machine_id: row.machine_id,
                    machine_name: row.machine_name,
                    sessions: [],
                    maxWeight: 0,
                    avgWeight: 0,
                    totalVolume: 0,
                    progressTrend: 'stable'
                };
            }
            
            const volume = row.sets * row.reps * row.weight;
            exerciseAnalysis[key].sessions.push({
                date: row.date,
                sets: row.sets,
                reps: row.reps,
                weight: row.weight,
                volume: volume
            });
            
            exerciseAnalysis[key].maxWeight = Math.max(exerciseAnalysis[key].maxWeight, row.weight);
            exerciseAnalysis[key].totalVolume += volume;
        });

        // Calcular tendencias y promedios
        Object.keys(exerciseAnalysis).forEach(exercise => {
            const data = exerciseAnalysis[exercise];
            data.avgWeight = data.totalVolume / data.sessions.reduce((sum, s) => sum + (s.sets * s.reps), 0);
            
            // Análisis de progreso (últimas 5 vs anteriores 5)
            if (data.sessions.length >= 10) {
                const recent = data.sessions.slice(0, 5);
                const older = data.sessions.slice(5, 10);
                const recentAvg = recent.reduce((sum, s) => sum + s.weight, 0) / recent.length;
                const olderAvg = older.reduce((sum, s) => sum + s.weight, 0) / older.length;
                
                if (recentAvg > olderAvg * 1.05) data.progressTrend = 'improving';
                else if (recentAvg < olderAvg * 0.95) data.progressTrend = 'declining';
                else data.progressTrend = 'stable';
            }
        });

        res.json({
            analysis: exerciseAnalysis,
            summary: {
                totalExercises: Object.keys(exerciseAnalysis).length,
                totalSessions: workoutData.rows.length,
                averageProgress: Object.values(exerciseAnalysis)
                    .filter(e => e.progressTrend === 'improving').length
            }
        });
        
    } catch (error) {
        console.error('Error in improved AI analysis:', error);
        res.status(500).json({ error: 'Error en análisis mejorado de IA' });
    }
});

// Generar entrenamiento específico por grupo muscular
app.post('/api/ai/generate-workout-by-group', async (req, res) => {
    try {
        const { userId, muscleGroupId, duration = 60 } = req.body;
        
        // Obtener máquinas disponibles para el grupo muscular
        const availableMachines = await pool.query(`
            SELECT DISTINCT
                m.id,
                m.name,
                m.description,
                mmg.is_primary
            FROM machines m
            JOIN machine_muscle_groups mmg ON m.id = mmg.machine_id
            WHERE mmg.muscle_group_id = $1
            ORDER BY mmg.is_primary DESC, m.name
        `, [muscleGroupId]);

        if (availableMachines.rows.length === 0) {
            return res.status(404).json({ error: 'No hay máquinas disponibles para este grupo muscular' });
        }

        // Obtener historial del usuario para estas máquinas
        const userHistory = await pool.query(`
            SELECT 
                e.machine_id,
                AVG(e.weight) as avg_weight,
                AVG(e.sets) as avg_sets,
                AVG(e.reps) as avg_reps,
                MAX(e.weight) as max_weight
            FROM exercises e
            JOIN workouts w ON e.workout_id = w.id
            WHERE w.user_id = $1 
                AND e.machine_id = ANY($2)
                AND w.date >= NOW() - INTERVAL '30 days'
            GROUP BY e.machine_id
        `, [userId, availableMachines.rows.map(m => m.id)]);

        // Crear entrenamiento personalizado
        const workout = {
            muscle_group_id: muscleGroupId,
            estimated_duration: duration,
            exercises: []
        };

        // Seleccionar máquinas (primarias primero, luego secundarias)
        const selectedMachines = availableMachines.rows.slice(0, Math.min(6, availableMachines.rows.length));
        
        selectedMachines.forEach(machine => {
            const history = userHistory.rows.find(h => h.machine_id === machine.id);
            
            let recommendedWeight = 20; // peso base
            let recommendedSets = 3;
            let recommendedReps = 12;
            
            if (history) {
                // Usar historial para recomendar peso
                recommendedWeight = Math.round(history.avg_weight * 1.05); // 5% más que el promedio
                recommendedSets = Math.round(history.avg_sets) || 3;
                recommendedReps = Math.round(history.avg_reps) || 12;
            }
            
            workout.exercises.push({
                machine_id: machine.id,
                machine_name: machine.name,
                is_primary: machine.is_primary,
                recommended_sets: recommendedSets,
                recommended_reps: recommendedReps,
                recommended_weight: recommendedWeight,
                notes: machine.is_primary ? 'Ejercicio principal' : 'Ejercicio complementario'
            });
        });

        res.json(workout);
        
    } catch (error) {
        console.error('Error generating workout by muscle group:', error);
        res.status(500).json({ error: 'Error al generar entrenamiento por grupo muscular' });
    }
});