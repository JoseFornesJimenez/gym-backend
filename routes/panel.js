const express = require('express');
const router = express.Router();
const panelController = require('../controllers/panelController');

// Middleware de autenticación para el panel (opcional)
// const { authenticateAdmin } = require('../middleware/auth');

// Rutas para máquinas
router.get('/machines', panelController.getAllMachines);
router.get('/machines/:id', panelController.getMachine);
router.put('/machines/:id', panelController.updateMachine);
router.delete('/machines/:id', panelController.deleteMachine);

// Rutas para grupos musculares
router.get('/muscle-groups', panelController.getAllMuscleGroups);
router.post('/muscle-groups', panelController.createMuscleGroup);
router.put('/muscle-groups/:id', panelController.updateMuscleGroup);
router.delete('/muscle-groups/:id', panelController.deleteMuscleGroup);

// Rutas para asociaciones máquina-grupo muscular
router.post('/machines/:machineId/muscle-groups', panelController.associateMachineToMuscleGroup);
router.delete('/machines/:machineId/muscle-groups/:groupId', panelController.disassociateMachineFromMuscleGroup);

module.exports = router;