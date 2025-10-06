-- Tabla para definir grupos musculares
CREATE TABLE muscle_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(50) NOT NULL,
    color VARCHAR(7) NOT NULL, -- Color hex
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para asociar máquinas con grupos musculares
CREATE TABLE machine_muscle_groups (
    id SERIAL PRIMARY KEY,
    exercise_id VARCHAR(255) NOT NULL, -- ID del ejercicio/máquina
    muscle_group_id INTEGER REFERENCES muscle_groups(id),
    is_primary BOOLEAN DEFAULT true, -- Si es el grupo muscular principal
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar los grupos musculares actuales
INSERT INTO muscle_groups (name, display_name, color) VALUES
('chest', 'Pecho', '#FF6B6B'),
('back', 'Espalda', '#4ECDC4'),
('legs', 'Piernas', '#45B7D1'),
('biceps', 'Bíceps', '#FFEAA7'),
('triceps', 'Tríceps', '#FF9500'),
('glutes', 'Culo', '#E74C3C'),
('free_weights', 'Pesas Libres', '#2ECC71');

-- Asociar las máquinas existentes con sus grupos musculares
-- PECHO
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id) VALUES
('55353350_machine_trono_pecho', (SELECT id FROM muscle_groups WHERE name = 'chest')),
('55437348_machine_press_inclinado', (SELECT id FROM muscle_groups WHERE name = 'chest')),
('55515947_machine_pecho_sentado', (SELECT id FROM muscle_groups WHERE name = 'chest'));

-- ESPALDA
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id) VALUES
('15515778_1000101291', (SELECT id FROM muscle_groups WHERE name = 'back')),
('44806878_machine_remo', (SELECT id FROM muscle_groups WHERE name = 'back')),
('53582707_1000100046', (SELECT id FROM muscle_groups WHERE name = 'back'));

-- PIERNAS
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id) VALUES
('44745591_machine_jaca', (SELECT id FROM muscle_groups WHERE name = 'legs')),
('53338792_1000100040', (SELECT id FROM muscle_groups WHERE name = 'legs')),
('45823499_machine_prensa', (SELECT id FROM muscle_groups WHERE name = 'legs')),
('45470982_machine_extension_de_cuadriceps', (SELECT id FROM muscle_groups WHERE name = 'legs')),
('44867129_machine_isquios', (SELECT id FROM muscle_groups WHERE name = 'legs')),
('52708213_1000100037', (SELECT id FROM muscle_groups WHERE name = 'legs')),
('44995410_machine_abductores', (SELECT id FROM muscle_groups WHERE name = 'legs'));

-- BÍCEPS
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id) VALUES
('16074017_machine_curl_de_biceps', (SELECT id FROM muscle_groups WHERE name = 'biceps'));

-- TRÍCEPS
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id) VALUES
('55616790_machine_triceps_mancuerna', (SELECT id FROM muscle_groups WHERE name = 'triceps')),
('55734815_machine_larry_triceps', (SELECT id FROM muscle_groups WHERE name = 'triceps')),
('55887675_machine_triceps_sentado', (SELECT id FROM muscle_groups WHERE name = 'triceps'));

-- CULO/GLÚTEOS
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id) VALUES
('62852278_machine_sentadilla_multipower', (SELECT id FROM muscle_groups WHERE name = 'glutes'));

-- PESAS LIBRES
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id) VALUES
('16639757_machine_mancuerna', (SELECT id FROM muscle_groups WHERE name = 'free_weights'));

-- Consultas útiles para el backend:

-- 1. Obtener todos los grupos musculares con sus colores
-- SELECT name, display_name, color FROM muscle_groups ORDER BY display_name;

-- 2. Obtener ejercicios por grupo muscular
-- SELECT e.*, mg.display_name as muscle_group_name 
-- FROM exercises e
-- JOIN machine_muscle_groups mmg ON e.id = mmg.exercise_id
-- JOIN muscle_groups mg ON mmg.muscle_group_id = mg.id
-- WHERE mg.name = 'chest';

-- 3. Obtener todos los ejercicios con sus grupos musculares
-- SELECT e.id, e.name, 
--        array_agg(mg.display_name) as muscle_groups,
--        array_agg(mg.color) as colors
-- FROM exercises e
-- LEFT JOIN machine_muscle_groups mmg ON e.id = mmg.exercise_id
-- LEFT JOIN muscle_groups mg ON mmg.muscle_group_id = mg.id
-- GROUP BY e.id, e.name;