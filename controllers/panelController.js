const db = require('../database/connection');

class PanelController {
  
  // GET /panel/machines - Obtener todas las máquinas con sus asociaciones
  async getAllMachines(req, res) {
    try {
      const result = await db.query(`
        SELECT 
          e.id,
          e.name,
          e.image,
          e.filename,
          e.type,
          e.upload_date,
          COALESCE(
            json_agg(
              json_build_object(
                'muscle_group_id', mg.id,
                'muscle_group_name', mg.name,
                'muscle_group_display', mg.display_name,
                'muscle_group_color', mg.color,
                'is_primary', mmg.is_primary
              )
            ) FILTER (WHERE mg.id IS NOT NULL), 
            '[]'
          ) as muscle_groups
        FROM exercises e
        LEFT JOIN machine_muscle_groups mmg ON e.id = mmg.exercise_id
        LEFT JOIN muscle_groups mg ON mmg.muscle_group_id = mg.id
        GROUP BY e.id, e.name, e.image, e.filename, e.type, e.upload_date
        ORDER BY e.name
      `);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching machines:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener las máquinas'
      });
    }
  }

  // GET /panel/machines/:id - Obtener una máquina específica
  async getMachine(req, res) {
    try {
      const { id } = req.params;
      
      const result = await db.query(`
        SELECT 
          e.id,
          e.name,
          e.image,
          e.filename,
          e.type,
          e.upload_date,
          COALESCE(
            json_agg(
              json_build_object(
                'muscle_group_id', mg.id,
                'muscle_group_name', mg.name,
                'muscle_group_display', mg.display_name,
                'muscle_group_color', mg.color,
                'is_primary', mmg.is_primary
              )
            ) FILTER (WHERE mg.id IS NOT NULL), 
            '[]'
          ) as muscle_groups
        FROM exercises e
        LEFT JOIN machine_muscle_groups mmg ON e.id = mmg.exercise_id
        LEFT JOIN muscle_groups mg ON mmg.muscle_group_id = mg.id
        WHERE e.id = $1
        GROUP BY e.id, e.name, e.image, e.filename, e.type, e.upload_date
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Máquina no encontrada'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching machine:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener la máquina'
      });
    }
  }

  // PUT /panel/machines/:id - Actualizar máquina
  async updateMachine(req, res) {
    try {
      const { id } = req.params;
      const { name, type } = req.body;

      await db.query(
        'UPDATE exercises SET name = $1, type = $2 WHERE id = $3',
        [name, type, id]
      );

      res.json({
        success: true,
        message: 'Máquina actualizada correctamente'
      });
    } catch (error) {
      console.error('Error updating machine:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar la máquina'
      });
    }
  }

  // DELETE /panel/machines/:id - Eliminar máquina
  async deleteMachine(req, res) {
    try {
      const { id } = req.params;

      // Primero eliminar asociaciones
      await db.query('DELETE FROM machine_muscle_groups WHERE exercise_id = $1', [id]);
      
      // Luego eliminar la máquina
      await db.query('DELETE FROM exercises WHERE id = $1', [id]);

      res.json({
        success: true,
        message: 'Máquina eliminada correctamente'
      });
    } catch (error) {
      console.error('Error deleting machine:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar la máquina'
      });
    }
  }

  // GET /panel/muscle-groups - Obtener todos los grupos musculares
  async getAllMuscleGroups(req, res) {
    try {
      const result = await db.query(`
        SELECT 
          mg.id,
          mg.name,
          mg.display_name,
          mg.color,
          COUNT(mmg.exercise_id) as machine_count
        FROM muscle_groups mg
        LEFT JOIN machine_muscle_groups mmg ON mg.id = mmg.muscle_group_id
        GROUP BY mg.id, mg.name, mg.display_name, mg.color
        ORDER BY mg.display_name
      `);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching muscle groups:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener grupos musculares'
      });
    }
  }

  // POST /panel/machines/:machineId/muscle-groups - Asociar máquina con grupo muscular
  async associateMachineToMuscleGroup(req, res) {
    try {
      const { machineId } = req.params;
      const { muscleGroupId, isPrimary = true } = req.body;

      // Verificar que la máquina y el grupo existen
      const machineCheck = await db.query('SELECT id FROM exercises WHERE id = $1', [machineId]);
      const groupCheck = await db.query('SELECT id FROM muscle_groups WHERE id = $1', [muscleGroupId]);

      if (machineCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Máquina no encontrada'
        });
      }

      if (groupCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Grupo muscular no encontrado'
        });
      }

      // Insertar la asociación (ON CONFLICT para evitar duplicados)
      await db.query(`
        INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id, is_primary)
        VALUES ($1, $2, $3)
        ON CONFLICT (exercise_id, muscle_group_id) 
        DO UPDATE SET is_primary = $3
      `, [machineId, muscleGroupId, isPrimary]);

      res.json({
        success: true,
        message: 'Asociación creada/actualizada correctamente'
      });
    } catch (error) {
      console.error('Error associating machine:', error);
      res.status(500).json({
        success: false,
        error: 'Error al asociar la máquina'
      });
    }
  }

  // DELETE /panel/machines/:machineId/muscle-groups/:groupId - Desasociar máquina de grupo
  async disassociateMachineFromMuscleGroup(req, res) {
    try {
      const { machineId, groupId } = req.params;

      await db.query(
        'DELETE FROM machine_muscle_groups WHERE exercise_id = $1 AND muscle_group_id = $2',
        [machineId, groupId]
      );

      res.json({
        success: true,
        message: 'Asociación eliminada correctamente'
      });
    } catch (error) {
      console.error('Error disassociating machine:', error);
      res.status(500).json({
        success: false,
        error: 'Error al desasociar la máquina'
      });
    }
  }

  // POST /panel/muscle-groups - Crear nuevo grupo muscular
  async createMuscleGroup(req, res) {
    try {
      const { name, displayName, color } = req.body;

      const result = await db.query(`
        INSERT INTO muscle_groups (name, display_name, color)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [name, displayName, color]);

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Grupo muscular creado correctamente'
      });
    } catch (error) {
      console.error('Error creating muscle group:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear el grupo muscular'
      });
    }
  }

  // PUT /panel/muscle-groups/:id - Actualizar grupo muscular
  async updateMuscleGroup(req, res) {
    try {
      const { id } = req.params;
      const { name, displayName, color } = req.body;

      await db.query(
        'UPDATE muscle_groups SET name = $1, display_name = $2, color = $3 WHERE id = $4',
        [name, displayName, color, id]
      );

      res.json({
        success: true,
        message: 'Grupo muscular actualizado correctamente'
      });
    } catch (error) {
      console.error('Error updating muscle group:', error);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar el grupo muscular'
      });
    }
  }

  // DELETE /panel/muscle-groups/:id - Eliminar grupo muscular
  async deleteMuscleGroup(req, res) {
    try {
      const { id } = req.params;

      // Primero eliminar asociaciones
      await db.query('DELETE FROM machine_muscle_groups WHERE muscle_group_id = $1', [id]);
      
      // Luego eliminar el grupo
      await db.query('DELETE FROM muscle_groups WHERE id = $1', [id]);

      res.json({
        success: true,
        message: 'Grupo muscular eliminado correctamente'
      });
    } catch (error) {
      console.error('Error deleting muscle group:', error);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar el grupo muscular'
      });
    }
  }
}

module.exports = new PanelController();