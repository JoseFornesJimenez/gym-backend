-- Catálogo cacheado desde Free Exercise DB (yuhonas/free-exercise-db).
-- Una fila por ejercicio del catálogo. Se llena con POST /api/catalog/sync.

CREATE TABLE IF NOT EXISTS catalog_exercises (
    id VARCHAR(120) PRIMARY KEY,             -- slug del catálogo, ej "Barbell_Bench_Press"
    name VARCHAR(200) NOT NULL,
    force VARCHAR(20),                       -- push / pull / static
    level VARCHAR(20),                       -- beginner / intermediate / expert
    mechanic VARCHAR(20),                    -- compound / isolation
    equipment VARCHAR(50),                   -- barbell, dumbbell, machine, cable, etc
    category VARCHAR(50),                    -- strength, cardio, stretching, etc
    primary_muscles TEXT[] DEFAULT '{}',
    secondary_muscles TEXT[] DEFAULT '{}',
    instructions TEXT[] DEFAULT '{}',
    images TEXT[] DEFAULT '{}',              -- URLs absolutas a GitHub raw
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_name ON catalog_exercises USING GIN (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_catalog_equipment ON catalog_exercises(equipment);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON catalog_exercises(category);
CREATE INDEX IF NOT EXISTS idx_catalog_primary_muscles ON catalog_exercises USING GIN (primary_muscles);

-- Ejercicios que cada usuario ha añadido a su colección desde el catálogo.
CREATE TABLE IF NOT EXISTS user_added_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    catalog_id VARCHAR(120) NOT NULL REFERENCES catalog_exercises(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, catalog_id)
);

CREATE INDEX IF NOT EXISTS idx_user_added_user ON user_added_exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_user_added_catalog ON user_added_exercises(catalog_id);

COMMENT ON TABLE catalog_exercises IS 'Catálogo de ejercicios cacheado desde Free Exercise DB';
COMMENT ON TABLE user_added_exercises IS 'Ejercicios del catálogo añadidos por cada usuario';
