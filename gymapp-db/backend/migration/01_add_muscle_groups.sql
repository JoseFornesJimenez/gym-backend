-- ========================================
-- MIGRACIÓN: Agregar grupos musculares específicos
-- ========================================
-- Este script agrega las tablas necesarias para los grupos musculares
-- SIN AFECTAR los datos existentes

-- 1. Crear tabla de grupos musculares
CREATE TABLE IF NOT EXISTS muscle_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear tabla de relación máquina-grupo muscular
CREATE TABLE IF NOT EXISTS machine_muscle_groups (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    muscle_group_id INTEGER REFERENCES muscle_groups(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(machine_id, muscle_group_id)
);

-- 3. Insertar los grupos musculares específicos que solicitaste
INSERT INTO muscle_groups (name, description) VALUES 
('Bíceps', 'Músculos del brazo anterior - flexores del codo'),
('Tríceps', 'Músculos del brazo posterior - extensores del codo'),
('Culo', 'Músculos glúteos - extensores de cadera'),
('Pecho', 'Músculos pectorales'),
('Espalda', 'Músculos dorsales y romboides'),
('Hombros', 'Músculos deltoides'),
('Piernas', 'Músculos del tren inferior'),
('Core', 'Músculos abdominales y estabilizadores')
ON CONFLICT (name) DO NOTHING;

-- 4. Asociaciones específicas que mencionaste
-- Asegurándonos de que la sentadilla multipower esté en "Culo"
DO $$
DECLARE
    biceps_id INTEGER;
    triceps_id INTEGER;
    culo_id INTEGER;
    pecho_id INTEGER;
    espalda_id INTEGER;
    hombros_id INTEGER;
    piernas_id INTEGER;
    core_id INTEGER;
BEGIN
    -- Obtener IDs de grupos musculares
    SELECT id INTO biceps_id FROM muscle_groups WHERE name = 'Bíceps';
    SELECT id INTO triceps_id FROM muscle_groups WHERE name = 'Tríceps';
    SELECT id INTO culo_id FROM muscle_groups WHERE name = 'Culo';
    SELECT id INTO pecho_id FROM muscle_groups WHERE name = 'Pecho';
    SELECT id INTO espalda_id FROM muscle_groups WHERE name = 'Espalda';
    SELECT id INTO hombros_id FROM muscle_groups WHERE name = 'Hombros';
    SELECT id INTO piernas_id FROM muscle_groups WHERE name = 'Piernas';
    SELECT id INTO core_id FROM muscle_groups WHERE name = 'Core';

    -- Asociaciones específicas para máquinas comunes
    -- (Adaptaremos esto según las máquinas que tengas en tu BD)
    
    -- Bíceps
    INSERT INTO machine_muscle_groups (machine_id, muscle_group_id, is_primary) 
    SELECT id, biceps_id, true FROM machines WHERE LOWER(name) LIKE '%curl%' OR LOWER(name) LIKE '%bicep%'
    ON CONFLICT DO NOTHING;
    
    -- Tríceps  
    INSERT INTO machine_muscle_groups (machine_id, muscle_group_id, is_primary)
    SELECT id, triceps_id, true FROM machines WHERE LOWER(name) LIKE '%tricep%' OR LOWER(name) LIKE '%dips%'
    ON CONFLICT DO NOTHING;
    
    -- Culo (incluyendo sentadilla multipower)
    INSERT INTO machine_muscle_groups (machine_id, muscle_group_id, is_primary)
    SELECT id, culo_id, true FROM machines WHERE 
        LOWER(name) LIKE '%sentadilla%' OR 
        LOWER(name) LIKE '%multipower%' OR 
        LOWER(name) LIKE '%squat%' OR
        LOWER(name) LIKE '%gluteo%'
    ON CONFLICT DO NOTHING;
    
    -- Pecho
    INSERT INTO machine_muscle_groups (machine_id, muscle_group_id, is_primary)
    SELECT id, pecho_id, true FROM machines WHERE 
        LOWER(name) LIKE '%press%' OR 
        LOWER(name) LIKE '%pecho%' OR 
        LOWER(name) LIKE '%chest%'
    ON CONFLICT DO NOTHING;
    
    -- Espalda
    INSERT INTO machine_muscle_groups (machine_id, muscle_group_id, is_primary)
    SELECT id, espalda_id, true FROM machines WHERE 
        LOWER(name) LIKE '%lat%' OR 
        LOWER(name) LIKE '%pulldown%' OR 
        LOWER(name) LIKE '%row%' OR
        LOWER(name) LIKE '%espalda%'
    ON CONFLICT DO NOTHING;

END $$;

-- 5. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_machine_muscle_groups_machine_id ON machine_muscle_groups(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_muscle_groups_muscle_group_id ON machine_muscle_groups(muscle_group_id);

-- 6. Verificar la migración
SELECT 'Grupos musculares creados:' as info;
SELECT name, description FROM muscle_groups ORDER BY name;

SELECT 'Asociaciones creadas:' as info;
SELECT 
    m.name as machine_name,
    mg.name as muscle_group,
    mmg.is_primary
FROM machine_muscle_groups mmg
JOIN machines m ON mmg.machine_id = m.id
JOIN muscle_groups mg ON mmg.muscle_group_id = mg.id
ORDER BY mg.name, m.name;