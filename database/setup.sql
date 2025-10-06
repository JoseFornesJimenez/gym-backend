-- ==========================================
-- SCRIPT DE INSTALACIÓN COMPLETO
-- ==========================================

-- Crear tablas si no existen
CREATE TABLE IF NOT EXISTS muscle_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(50) NOT NULL,
    color VARCHAR(7) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS machine_muscle_groups (
    id SERIAL PRIMARY KEY,
    exercise_id VARCHAR(255) NOT NULL,
    muscle_group_id INTEGER REFERENCES muscle_groups(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exercise_id, muscle_group_id)
);

-- Insertar grupos musculares (solo si no existen)
INSERT INTO muscle_groups (name, display_name, color) 
SELECT * FROM (
    VALUES 
    ('chest', 'Pecho', '#FF6B6B'),
    ('back', 'Espalda', '#4ECDC4'),
    ('legs', 'Piernas', '#45B7D1'),
    ('biceps', 'Bíceps', '#FFEAA7'),
    ('triceps', 'Tríceps', '#FF9500'),
    ('glutes', 'Culo', '#E74C3C'),
    ('free_weights', 'Pesas Libres', '#2ECC71')
) AS t(name, display_name, color)
WHERE NOT EXISTS (
    SELECT 1 FROM muscle_groups WHERE muscle_groups.name = t.name
);

-- Insertar asociaciones (solo si no existen)
-- PECHO
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id, is_primary)
SELECT * FROM (
    VALUES 
    ('55353350_machine_trono_pecho', (SELECT id FROM muscle_groups WHERE name = 'chest'), true),
    ('55437348_machine_press_inclinado', (SELECT id FROM muscle_groups WHERE name = 'chest'), true),
    ('55515947_machine_pecho_sentado', (SELECT id FROM muscle_groups WHERE name = 'chest'), true)
) AS t(exercise_id, muscle_group_id, is_primary)
WHERE NOT EXISTS (
    SELECT 1 FROM machine_muscle_groups 
    WHERE machine_muscle_groups.exercise_id = t.exercise_id 
    AND machine_muscle_groups.muscle_group_id = t.muscle_group_id
);

-- ESPALDA
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id, is_primary)
SELECT * FROM (
    VALUES 
    ('15515778_1000101291', (SELECT id FROM muscle_groups WHERE name = 'back'), true),
    ('44806878_machine_remo', (SELECT id FROM muscle_groups WHERE name = 'back'), true),
    ('53582707_1000100046', (SELECT id FROM muscle_groups WHERE name = 'back'), true)
) AS t(exercise_id, muscle_group_id, is_primary)
WHERE NOT EXISTS (
    SELECT 1 FROM machine_muscle_groups 
    WHERE machine_muscle_groups.exercise_id = t.exercise_id 
    AND machine_muscle_groups.muscle_group_id = t.muscle_group_id
);

-- PIERNAS
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id, is_primary)
SELECT * FROM (
    VALUES 
    ('44745591_machine_jaca', (SELECT id FROM muscle_groups WHERE name = 'legs'), true),
    ('53338792_1000100040', (SELECT id FROM muscle_groups WHERE name = 'legs'), true),
    ('45823499_machine_prensa', (SELECT id FROM muscle_groups WHERE name = 'legs'), true),
    ('45470982_machine_extension_de_cuadriceps', (SELECT id FROM muscle_groups WHERE name = 'legs'), true),
    ('44867129_machine_isquios', (SELECT id FROM muscle_groups WHERE name = 'legs'), true),
    ('52708213_1000100037', (SELECT id FROM muscle_groups WHERE name = 'legs'), true),
    ('44995410_machine_abductores', (SELECT id FROM muscle_groups WHERE name = 'legs'), true)
) AS t(exercise_id, muscle_group_id, is_primary)
WHERE NOT EXISTS (
    SELECT 1 FROM machine_muscle_groups 
    WHERE machine_muscle_groups.exercise_id = t.exercise_id 
    AND machine_muscle_groups.muscle_group_id = t.muscle_group_id
);

-- BÍCEPS
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id, is_primary)
SELECT * FROM (
    VALUES 
    ('16074017_machine_curl_de_biceps', (SELECT id FROM muscle_groups WHERE name = 'biceps'), true)
) AS t(exercise_id, muscle_group_id, is_primary)
WHERE NOT EXISTS (
    SELECT 1 FROM machine_muscle_groups 
    WHERE machine_muscle_groups.exercise_id = t.exercise_id 
    AND machine_muscle_groups.muscle_group_id = t.muscle_group_id
);

-- TRÍCEPS
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id, is_primary)
SELECT * FROM (
    VALUES 
    ('55616790_machine_triceps_mancuerna', (SELECT id FROM muscle_groups WHERE name = 'triceps'), true),
    ('55734815_machine_larry_triceps', (SELECT id FROM muscle_groups WHERE name = 'triceps'), true),
    ('55887675_machine_triceps_sentado', (SELECT id FROM muscle_groups WHERE name = 'triceps'), true)
) AS t(exercise_id, muscle_group_id, is_primary)
WHERE NOT EXISTS (
    SELECT 1 FROM machine_muscle_groups 
    WHERE machine_muscle_groups.exercise_id = t.exercise_id 
    AND machine_muscle_groups.muscle_group_id = t.muscle_group_id
);

-- CULO/GLÚTEOS
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id, is_primary)
SELECT * FROM (
    VALUES 
    ('62852278_machine_sentadilla_multipower', (SELECT id FROM muscle_groups WHERE name = 'glutes'), true)
) AS t(exercise_id, muscle_group_id, is_primary)
WHERE NOT EXISTS (
    SELECT 1 FROM machine_muscle_groups 
    WHERE machine_muscle_groups.exercise_id = t.exercise_id 
    AND machine_muscle_groups.muscle_group_id = t.muscle_group_id
);

-- PESAS LIBRES
INSERT INTO machine_muscle_groups (exercise_id, muscle_group_id, is_primary)
SELECT * FROM (
    VALUES 
    ('16639757_machine_mancuerna', (SELECT id FROM muscle_groups WHERE name = 'free_weights'), true)
) AS t(exercise_id, muscle_group_id, is_primary)
WHERE NOT EXISTS (
    SELECT 1 FROM machine_muscle_groups 
    WHERE machine_muscle_groups.exercise_id = t.exercise_id 
    AND machine_muscle_groups.muscle_group_id = t.muscle_group_id
);

-- Verificar instalación
SELECT 'Grupos musculares creados:' as tipo, COUNT(*) as cantidad FROM muscle_groups
UNION ALL
SELECT 'Asociaciones creadas:' as tipo, COUNT(*) as cantidad FROM machine_muscle_groups;

-- Mostrar resumen por grupo
SELECT 
    mg.display_name as "Grupo Muscular",
    mg.color as "Color",
    COUNT(mmg.exercise_id) as "Máquinas Asociadas"
FROM muscle_groups mg
LEFT JOIN machine_muscle_groups mmg ON mg.id = mmg.muscle_group_id
GROUP BY mg.id, mg.display_name, mg.color
ORDER BY mg.display_name;