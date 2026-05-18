-- Traducciones al español del catálogo (rellenadas por POST /api/catalog/translate).
-- Las categorías (músculo, equipo, nivel, etc.) NO se guardan aquí: se traducen
-- al vuelo con un diccionario fijo en catalog.js porque son enums cerrados.

ALTER TABLE catalog_exercises
  ADD COLUMN IF NOT EXISTS name_es TEXT,
  ADD COLUMN IF NOT EXISTS instructions_es TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS translated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_catalog_name_es
  ON catalog_exercises USING GIN (to_tsvector('simple', coalesce(name_es, '')));

COMMENT ON COLUMN catalog_exercises.name_es IS 'Nombre traducido al español por Gemini';
COMMENT ON COLUMN catalog_exercises.instructions_es IS 'Instrucciones traducidas al español por Gemini';
