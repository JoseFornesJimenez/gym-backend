-- Inicialización de la base de datos del gimnasio
-- Este archivo se ejecuta automáticamente cuando se crea el contenedor

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Contraseña encriptada con bcrypt
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    date_of_birth DATE,
    phone VARCHAR(20),
    profile_picture_url TEXT,
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Tabla de rutinas de ejercicios por usuario
CREATE TABLE user_routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    routine_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de ejercicios en las rutinas
CREATE TABLE routine_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routine_id UUID NOT NULL REFERENCES user_routines(id) ON DELETE CASCADE,
    exercise_name VARCHAR(100) NOT NULL,
    machine_id VARCHAR(50), -- ID de la máquina del sistema de imágenes
    grip_type VARCHAR(50),
    sets INTEGER DEFAULT 1,
    reps INTEGER DEFAULT 1,
    weight DECIMAL(5,2), -- Peso en kg
    rest_seconds INTEGER DEFAULT 60,
    notes TEXT,
    order_in_routine INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de sesiones de entrenamiento
CREATE TABLE workout_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    routine_id UUID REFERENCES user_routines(id),
    session_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    duration_minutes INTEGER,
    notes TEXT,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de ejercicios realizados en cada sesión
CREATE TABLE session_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    routine_exercise_id UUID REFERENCES routine_exercises(id),
    exercise_name VARCHAR(100) NOT NULL,
    machine_id VARCHAR(50),
    grip_type VARCHAR(50),
    sets_completed INTEGER DEFAULT 0,
    reps_completed INTEGER DEFAULT 0,
    weight_used DECIMAL(5,2),
    rest_seconds INTEGER,
    notes TEXT,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de tokens de sesión para autenticación
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL, -- JWT token hasheado
    device_info TEXT,
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Tabla de registros de pesos para seguimiento de progreso personal
CREATE TABLE weight_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_name VARCHAR(100) NOT NULL,
    machine_id VARCHAR(50), -- ID de la máquina del sistema de imágenes
    grip_type VARCHAR(50) DEFAULT 'standard',
    weight DECIMAL(6,2) NOT NULL, -- Peso en kg con 2 decimales
    reps INTEGER NOT NULL,
    notes TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para relación many-to-many entre máquinas y tipos de agarre
CREATE TABLE machine_grip_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id VARCHAR(50) NOT NULL,
    grip_type_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(machine_id, grip_type_id)
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_user_routines_user_id ON user_routines(user_id);
CREATE INDEX idx_routine_exercises_routine_id ON routine_exercises(routine_id);
CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_date ON workout_sessions(session_date);
CREATE INDEX idx_session_exercises_session_id ON session_exercises(session_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_weight_records_user_id ON weight_records(user_id);
CREATE INDEX idx_weight_records_exercise ON weight_records(exercise_name);
CREATE INDEX idx_weight_records_date ON weight_records(recorded_at);
CREATE INDEX idx_weight_records_weight ON weight_records(weight DESC);
CREATE INDEX idx_machine_grip_types_machine ON machine_grip_types(machine_id);
CREATE INDEX idx_machine_grip_types_grip ON machine_grip_types(grip_type_id);

-- Función para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_routines_updated_at
    BEFORE UPDATE ON user_routines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weight_records_updated_at
    BEFORE UPDATE ON weight_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insertar usuario administrador por defecto (contraseña: admin123)
-- La contraseña se encriptará en el backend con bcrypt
INSERT INTO users (username, email, password_hash, first_name, last_name, is_admin, is_active)
VALUES (
    'admin',
    'admin@gym.local',
    '$2b$10$placeholder.hash.will.be.replaced.by.backend',
    'Administrador',
    'Sistema',
    true,
    true
);

-- Comentarios en las tablas
COMMENT ON TABLE users IS 'Tabla de usuarios del gimnasio con contraseñas encriptadas';
COMMENT ON TABLE user_routines IS 'Rutinas de ejercicios personalizadas por usuario';
COMMENT ON TABLE routine_exercises IS 'Ejercicios específicos dentro de cada rutina';
COMMENT ON TABLE workout_sessions IS 'Sesiones de entrenamiento realizadas';
COMMENT ON TABLE session_exercises IS 'Ejercicios realizados en cada sesión';
COMMENT ON TABLE user_sessions IS 'Tokens de autenticación y sesiones activas';
COMMENT ON TABLE weight_records IS 'Registros de pesos para seguimiento de progreso personal';

COMMENT ON COLUMN users.password_hash IS 'Contraseña encriptada con bcrypt (nunca almacenar en texto plano)';
COMMENT ON COLUMN user_sessions.token_hash IS 'JWT token hasheado para seguridad adicional';
COMMENT ON COLUMN weight_records.weight IS 'Peso levantado en kilogramos';
COMMENT ON COLUMN weight_records.grip_type IS 'Tipo de agarre utilizado (standard, wide, narrow, etc.)';

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '🏋️ Base de datos del gimnasio inicializada correctamente';
    RAISE NOTICE '📊 Tablas creadas: users, user_routines, routine_exercises, workout_sessions, session_exercises, user_sessions, weight_records';
    RAISE NOTICE '🔐 Sistema de encriptación configurado para contraseñas';
    RAISE NOTICE '📈 Sistema de seguimiento de pesos configurado';
    RAISE NOTICE '👤 Usuario admin creado (contraseña temporal: admin123)';
END $$;
