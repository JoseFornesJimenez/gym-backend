const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

// Función para generar IDs únicos (reemplazo de uuid)
const generateId = () => crypto.randomBytes(16).toString('hex');

// Importar módulo de base de datos
const db = require('./database');

const app = express();
const PORT = process.env.SERVER_PORT || 3001;
const SERVER_IP = process.env.SERVER_IP || 'pandarack.duckdns.org';
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key_change_in_production';

// Middleware
app.use(cors({
  origin: '*', // Permitir todas las IPs para desarrollo
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));

// Headers adicionales para imágenes
app.use('/images', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Para forms HTML

// Servir archivos estáticos del panel de administración
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/admin', express.static(path.join(__dirname, 'public')));

// Servir archivos estáticos (imágenes)
app.use('/images', (req, res, next) => {
  console.log(`📷 Solicitud de imagen: ${req.url}`);
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Configuración de multer para subir archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generar un nombre más corto y limpio
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    
    // Limpiar el nombre base (quitar caracteres especiales, espacios, etc.)
    const cleanBaseName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    // Usar un timestamp más corto (solo los últimos 8 dígitos)
    const shortTimestamp = Date.now().toString().slice(-8);
    
    // Formato final: tipo_nombre_timestamp.ext (máximo ~30 caracteres)
    const finalName = `${shortTimestamp}_${cleanBaseName}${extension}`;
    
    console.log(`📁 Archivo subido: ${file.originalname} -> ${finalName}`);
    cb(null, finalName);
  }
});

const upload = multer({ storage: storage });

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Función para determinar si un archivo es una máquina principal o un tipo de agarre
const isMainMachine = (fileName) => {
  const mainMachines = ['bench_press', 'lat_pulldown', 'remo'];
  const gripTypes = ['wide_grip', 'close_grip', 'neutral_grip'];
  
  const lowerFileName = fileName.toLowerCase();
  
  // Si contiene un tipo de agarre, no es máquina principal
  if (gripTypes.some(grip => lowerFileName.includes(grip))) {
    return false;
  }
  
  // Si empieza con una máquina principal, es máquina
  return mainMachines.some(machine => lowerFileName.startsWith(machine));
};

// Archivo JSON para metadata de imágenes
const metadataPath = path.join(__dirname, 'uploads', 'metadata.json');

// Función para leer metadata
const readMetadata = () => {
  try {
    if (fs.existsSync(metadataPath)) {
      const data = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Error reading metadata:', error);
    return {};
  }
};

// Función para escribir metadata
const writeMetadata = (metadata) => {
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing metadata:', error);
    return false;
  }
};

// Función para agregar metadata de una imagen
const addImageMetadata = (filename, name, type, machineFor = null) => {
  const metadata = readMetadata();
  metadata[filename] = {
    name: name,
    type: type, // 'machine' o 'grip'
    machineFor: machineFor, // Para agarres: a qué máquina pertenece, para máquinas: null
    uploadDate: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
  return writeMetadata(metadata);
};

// Función para obtener metadata de una imagen
const getImageMetadata = (filename) => {
  const metadata = readMetadata();
  return metadata[filename] || null;
};

// Función para obtener todos los ejercicios dinámicamente
const getExercises = () => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const imageFiles = files.filter(file => 
      file.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)
    );
    
    const metadata = readMetadata();
    
    // Filtrar solo las máquinas principales usando metadata
    const mainMachineFiles = imageFiles.filter(file => {
      const fileMeta = metadata[file];
      return fileMeta && fileMeta.type === 'machine';
    });
    
    console.log('📁 Todos los archivos encontrados:', imageFiles);
    console.log('🏋️ Máquinas principales filtradas:', mainMachineFiles);
    
    return mainMachineFiles.map((file, index) => {
      const fileMeta = metadata[file] || {};
      const nameWithoutExt = path.parse(file).name;
      
      // Usar el nombre de la metadata si existe, sino usar el nombre del archivo
      let exerciseName = fileMeta.name || nameWithoutExt
        .replace(/^\d+-/, '') // Quitar timestamp si existe
        .replace(/[-_]/g, ' ') // Reemplazar guiones y guiones bajos por espacios
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      return {
        id: nameWithoutExt, // Usar nombre del archivo como ID
        name: exerciseName,
        image: `http://${SERVER_IP}:${PORT}/images/${file}`,
        filename: file,
        type: fileMeta.type || 'machine',
        uploadDate: fileMeta.uploadDate || null
      };
    });
  } catch (error) {
    console.error('Error reading exercises:', error);
    return [];
  }
};

// Función para obtener tipos de agarre para una máquina específica
const getGripTypes = (machine) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const imageFiles = files.filter(file => 
      file.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)
    );
    
    const metadata = readMetadata();
    
    // Filtrar solo los tipos de agarre usando metadata
    const gripFiles = imageFiles.filter(file => {
      const fileMeta = metadata[file];
      return fileMeta && fileMeta.type === 'grip';
    });
    
    return gripFiles.map((file, index) => {
      const fileMeta = metadata[file] || {};
      const nameWithoutExt = path.parse(file).name;
      
      // Usar el nombre de la metadata si existe, sino usar el nombre del archivo
      let gripName = fileMeta.name || nameWithoutExt
        .replace(/^\d+-/, '')
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      return {
        id: (index + 1).toString(),
        name: gripName,
        image: `http://${SERVER_IP}:${PORT}/images/${file}`,
        filename: file,
        type: fileMeta.type || 'grip',
        uploadDate: fileMeta.uploadDate || null
      };
    });
  } catch (error) {
    console.error('Error reading grip types:', error);
    return [];
  }
};

// ==========================================
// RUTAS DEL PANEL DE ADMINISTRACIÓN
// ==========================================

// Importar rutas del panel
const panelRoutes = require('./routes/panel');

// Usar las rutas del panel
app.use('/panel', panelRoutes);

// Ruta para servir el panel de administración
app.get('/panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel', 'index.html'));
});

// Rutas de autenticación
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validaciones básicas
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Todos los campos son obligatorios',
        details: { username: !username, email: !email, password: !password }
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    // Verificar si el usuario ya existe
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario o email ya está registrado' });
    }
    
    // Encriptar contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Crear usuario
    const newUser = await db.query(
      'INSERT INTO users (id, username, email, password_hash, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, username, email, created_at',
      [uuidv4(), username, email, hashedPassword]
    );
    
    // Generar JWT token
    const token = jwt.sign(
      { userId: newUser.rows[0].id, username: newUser.rows[0].username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: newUser.rows[0].id,
        username: newUser.rows[0].username,
        email: newUser.rows[0].email,
        createdAt: newUser.rows[0].created_at
      },
      token
    });
    
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
    }
    
    // Buscar usuario (puede ser username o email)
    const user = await db.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Generar JWT token
    const token = jwt.sign(
      { userId: user.rows[0].id, username: user.rows[0].username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.rows[0].id,
        username: user.rows[0].username,
        email: user.rows[0].email
      },
      token
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Middleware para verificar JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Rutas para registros de pesos
app.get('/api/weight-records', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const records = await db.query(`
      SELECT 
        wr.*,
        TO_CHAR(wr.recorded_at, 'YYYY-MM-DD HH24:MI:SS') as recorded_at_formatted
      FROM weight_records wr 
      WHERE wr.user_id = $1 
      ORDER BY wr.recorded_at DESC
    `, [userId]);
    
    res.json({
      success: true,
      records: records.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo registros de pesos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/weight-records', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { exerciseName, machineId, gripType, weight, reps, notes } = req.body;
    
    // Validaciones
    if (!exerciseName || !weight || !reps) {
      return res.status(400).json({ 
        error: 'Ejercicio, peso y repeticiones son obligatorios' 
      });
    }
    
    if (weight <= 0 || reps <= 0) {
      return res.status(400).json({ 
        error: 'Peso y repeticiones deben ser números positivos' 
      });
    }
    
    // Insertar nuevo registro
    const newRecord = await db.query(`
      INSERT INTO weight_records 
      (id, user_id, exercise_name, machine_id, grip_type, weight, reps, notes, recorded_at) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
      RETURNING *
    `, [
      uuidv4(), 
      userId, 
      exerciseName, 
      machineId || null, 
      gripType || 'standard', 
      weight, 
      reps, 
      notes || null
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Registro de peso guardado exitosamente',
      record: newRecord.rows[0]
    });
    
  } catch (error) {
    console.error('Error guardando registro de peso:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/weight-records/max/:exerciseName', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { exerciseName } = req.params;
    const { gripType } = req.query;
    
    let query = `
      SELECT * FROM weight_records 
      WHERE user_id = $1 AND exercise_name = $2
    `;
    let params = [userId, exerciseName];
    
    if (gripType) {
      query += ' AND grip_type = $3';
      params.push(gripType);
    }
    
    query += ' ORDER BY weight DESC, reps DESC LIMIT 1';
    
    const maxRecord = await db.query(query, params);
    
    res.json({
      success: true,
      maxRecord: maxRecord.rows[0] || null
    });
    
  } catch (error) {
    console.error('Error obteniendo peso máximo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas de autenticación
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validaciones básicas
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Todos los campos son obligatorios',
        details: { username: !username, email: !email, password: !password }
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    
    // Verificar si el usuario ya existe
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario o email ya está registrado' });
    }
    
    // Encriptar contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Crear usuario
    const newUser = await db.query(
      'INSERT INTO users (id, username, email, password_hash, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, username, email, created_at',
      [uuidv4(), username, email, hashedPassword]
    );
    
    // Generar JWT token
    const token = jwt.sign(
      { userId: newUser.rows[0].id, username: newUser.rows[0].username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: newUser.rows[0].id,
        username: newUser.rows[0].username,
        email: newUser.rows[0].email,
        createdAt: newUser.rows[0].created_at
      },
      token
    });
    
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
    }
    
    // Buscar usuario (puede ser username o email)
    const user = await db.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    
    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Generar JWT token
    const token = jwt.sign(
      { userId: user.rows[0].id, username: user.rows[0].username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.rows[0].id,
        username: user.rows[0].username,
        email: user.rows[0].email
      },
      token
    });
    
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas
app.get('/api/exercises', (req, res) => {
  try {
    const exercises = getExercises();
    res.json({
      success: true,
      data: exercises,
      count: exercises.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener ejercicios',
      error: error.message
    });
  }
});

// Obtener tipos de agarre disponibles
app.get('/api/grip-types', (req, res) => {
  try {
    const gripTypes = getGripTypes();
    res.json({
      success: true,
      data: gripTypes,
      count: gripTypes.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipos de agarre',
      error: error.message
    });
  }
});

// Nuevo endpoint para obtener agarres de una máquina específica usando relaciones
app.get('/api/grip-types/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    
    console.log(`🔍 Buscando agarres para máquina: "${machineId}"`);
    
    // Leer metadata para obtener información de la máquina
    const metadata = readMetadata();
    let machineName = null;
    
    // Buscar el nombre de la máquina en metadata
    for (const [filename, meta] of Object.entries(metadata)) {
      const fileId = path.parse(filename).name;
      if (fileId === machineId && meta.type === 'machine') {
        machineName = meta.name;
        console.log(`📋 Máquina encontrada en metadata: "${machineName}" (${machineId})`);
        break;
      }
    }
    
    // Primero, veamos todas las relaciones existentes para debug
    const allRelations = await db.query(`SELECT * FROM machine_grip_types`);
    console.log(`📋 Total relaciones en BD: ${allRelations.rows.length}`);
    
    // Mostrar cada relación individualmente
    allRelations.rows.forEach((rel, index) => {
      console.log(`📋 Relación ${index + 1}: machine_id="${rel.machine_id}", grip_type_id="${rel.grip_type_id}"`);
    });
    
    // Buscar relaciones para esta máquina específica (primero por ID exacto)
    let gripRelations = await db.query(`
      SELECT mgt.grip_type_id
      FROM machine_grip_types mgt
      WHERE mgt.machine_id = $1
    `, [machineId]);
    
    console.log(`📊 Relaciones encontradas por ID exacto "${machineId}": ${gripRelations.rows.length}`);
    
    // Si no encontramos por ID exacto y tenemos el nombre de la máquina, buscar por patrón de nombre
    if (gripRelations.rows.length === 0 && machineName) {
      console.log(`🔍 Búsqueda alternativa por nombre de máquina: "${machineName}"`);
      
      // Buscar todas las máquinas que podrían coincidir por nombre
      const possibleMachineIds = [];
      for (const [filename, meta] of Object.entries(metadata)) {
        if (meta.type === 'machine' && meta.name && 
            meta.name.toLowerCase() === machineName.toLowerCase()) {
          const fileId = path.parse(filename).name;
          possibleMachineIds.push(fileId);
          console.log(`🎯 Máquina candidata encontrada: "${meta.name}" con ID "${fileId}"`);
        }
      }
      
      // Buscar relaciones para cualquiera de los IDs candidatos
      if (possibleMachineIds.length > 0) {
        const placeholders = possibleMachineIds.map((_, index) => `$${index + 1}`).join(',');
        gripRelations = await db.query(`
          SELECT mgt.grip_type_id
          FROM machine_grip_types mgt
          WHERE mgt.machine_id IN (${placeholders})
        `, possibleMachineIds);
        
        console.log(`📊 Relaciones encontradas por búsqueda alternativa: ${gripRelations.rows.length}`);
      }
    }
    
    let grips = [];
    
    if (gripRelations.rows.length > 0) {
      // Si hay relaciones configuradas, usarlas
      const gripTypeIds = gripRelations.rows.map(row => row.grip_type_id);
      console.log(`🔍 Buscando archivos para grip_type_ids:`, gripTypeIds);
      
      const allFiles = fs.readdirSync(uploadsDir);
      console.log(`📁 Archivos disponibles:`, allFiles);
      
      const gripFiles = allFiles.filter(file => {
        const nameWithoutExt = path.parse(file).name;
        const isGripFile = nameWithoutExt.startsWith('grip_') || nameWithoutExt.includes('-grip_');
        
        // Buscar coincidencia exacta primero
        if (gripTypeIds.includes(nameWithoutExt)) {
          console.log(`📄 Archivo: ${file}, coincidencia exacta, nameWithoutExt: ${nameWithoutExt}`);
          return true;
        }
        
        // Si no hay coincidencia exacta, buscar por sufijo (para manejar timestamps diferentes)
        const matchesByPattern = gripTypeIds.some(gripId => {
          const gripSuffix = gripId.replace(/^\d+-/, ''); // Quitar timestamp del grip_type_id
          const fileSuffix = nameWithoutExt.replace(/^\d+-/, ''); // Quitar timestamp del archivo
          const matches = gripSuffix === fileSuffix;
          if (matches) {
            console.log(`📄 Archivo: ${file}, coincidencia por patrón: ${gripSuffix} === ${fileSuffix}`);
          }
          return matches;
        });
        
        console.log(`📄 Archivo: ${file}, isGrip: ${isGripFile}, exactMatch: false, patternMatch: ${matchesByPattern}, nameWithoutExt: ${nameWithoutExt}`);
        return isGripFile && matchesByPattern;
      });
      
      console.log(`📁 Archivos de agarre encontrados:`, gripFiles);
      
      grips = gripFiles.map((file, index) => {
        const nameWithoutExt = path.parse(file).name;
        const metadata = readMetadata();
        const fileMeta = metadata[file] || {};
        
        // Usar el nombre de la metadata si existe, sino generar uno limpio
        let displayName;
        if (fileMeta.name) {
          displayName = fileMeta.name;
        } else {
          // Generar un nombre limpio y legible
          displayName = nameWithoutExt
            .replace(/^\d+_/, '') // Quitar timestamp del inicio (nuevo formato)
            .replace(/^\d+-/, '') // Quitar timestamp del inicio (formato antiguo)
            .replace(/^grip_/, '') // Quitar prefijo 'grip_'
            .replace(/[-_]/g, ' ') // Reemplazar guiones y guiones bajos por espacios
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
        
        // Si queda vacío o muy corto, usar un nombre por defecto
        if (!displayName || displayName.length < 2) {
          displayName = 'Agarre';
        }
        
        return {
          id: nameWithoutExt, // Usar el nombre del archivo como ID
          name: displayName,
          image: `http://${SERVER_IP}:${PORT}/images/${file}`,
          filename: file,
          type: 'grip',
          gripTypeId: nameWithoutExt
        };
      });
    } else {
      console.log(`❌ No hay agarres configurados para la máquina ${machineId}`);
    }
    
    console.log(`🤲 Agarres finales para máquina ${machineId}:`, grips.map(g => g.name));
    
    res.json({
      success: true,
      data: grips,
      count: grips.length
    });
  } catch (error) {
    console.error('Error getting grip types for machine:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipos de agarre',
      error: error.message
    });
  }
});
// Subir nueva imagen de ejercicio
app.post('/api/exercises/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó ninguna imagen'
      });
    }

    const exerciseName = req.body.name || path.parse(req.file.originalname).name;
    const filename = req.file.filename;
    const nameWithoutExt = path.parse(filename).name;
    
    // Usar el tipo enviado desde el formulario, o detectar automáticamente
    let type = req.body.type;
    let machineFor = null;
    
    if (!type) {
      // Detectar tipo automáticamente basado en el nombre del archivo
      if (nameWithoutExt.startsWith('machine_')) {
        type = 'machine';
      } else if (nameWithoutExt.startsWith('grip_')) {
        type = 'grip';
      } else {
        type = isMainMachine(nameWithoutExt) ? 'machine' : 'grip';
      }
    }
    
    // Si es un agarre, obtener la máquina asociada
    if (type === 'grip' && req.body.machineFor) {
      machineFor = req.body.machineFor;
    }
    
    // Guardar metadata con la máquina asociada
    const metadataSaved = addImageMetadata(filename, exerciseName, type, machineFor);
    
    console.log(`📝 Metadata guardada para ${filename}:`, {
      name: exerciseName,
      type: type,
      machineFor: machineFor,
      metadataSaved: metadataSaved
    });
    
    res.json({
      success: true,
      message: 'Imagen subida correctamente',
      data: {
        filename: filename,
        originalName: req.file.originalname,
        exerciseName: exerciseName,
        type: type,
        machineFor: machineFor,
        url: `http://${SERVER_IP}:${PORT}/images/${filename}`,
        metadataSaved: metadataSaved
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al subir la imagen',
      error: error.message
    });
  }
});

// Eliminar ejercicio
app.delete('/api/exercises/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      
      // También eliminar de metadata
      const metadata = readMetadata();
      delete metadata[filename];
      writeMetadata(metadata);
      
      res.json({
        success: true,
        message: 'Ejercicio eliminado correctamente'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Archivo no encontrado'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el ejercicio',
      error: error.message
    });
  }
});

// Editar ejercicio/agarre
app.put('/api/exercises/edit', upload.single('image'), (req, res) => {
  try {
    const { filename, name, machineFor } = req.body;
    
    if (!filename || !name) {
      return res.status(400).json({
        success: false,
        message: 'Filename y name son requeridos'
      });
    }

    const metadata = readMetadata();
    const currentMeta = metadata[filename];
    
    if (!currentMeta) {
      return res.status(404).json({
        success: false,
        message: 'Imagen no encontrada en metadata'
      });
    }

    let newFilename = filename;
    
    // Si se subió una nueva imagen, manejar el reemplazo
    if (req.file) {
      // Eliminar imagen anterior
      const oldFilePath = path.join(uploadsDir, filename);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
      
      newFilename = req.file.filename;
      // Eliminar metadata antigua
      delete metadata[filename];
    }
    
    // Actualizar metadata con nueva información
    metadata[newFilename] = {
      ...currentMeta,
      name: name,
      machineFor: machineFor || currentMeta.machineFor,
      lastModified: new Date().toISOString()
    };
    
    const saved = writeMetadata(metadata);
    
    console.log(`📝 Imagen editada: ${filename} -> ${newFilename}`, {
      name: name,
      machineFor: machineFor,
      newImage: !!req.file
    });
    
    res.json({
      success: true,
      message: 'Imagen editada correctamente',
      data: {
        oldFilename: filename,
        newFilename: newFilename,
        name: name,
        machineFor: machineFor,
        imageChanged: !!req.file,
        url: `http://${SERVER_IP}:${PORT}/images/${newFilename}`,
        metadataSaved: saved
      }
    });
  } catch (error) {
    console.error('Error editing image:', error);
    res.status(500).json({
      success: false,
      message: 'Error al editar imagen',
      error: error.message
    });
  }
});

// Obtener ejercicio específico
app.get('/api/exercises/:id', (req, res) => {
  try {
    const exercises = getExercises();
    const exercise = exercises.find(ex => ex.id === req.params.id);
    
    if (exercise) {
      res.json({
        success: true,
        data: exercise
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Ejercicio no encontrado'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener el ejercicio',
      error: error.message
    });
  }
});

// Ruta principal - Panel de administración web
app.get('/', (req, res) => {
  // Agregar un botón para ir al panel completo
  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🏋️ Gym App - Panel de Administración</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 20px; 
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { color: #333; margin-bottom: 10px; }
        .header p { color: #666; }
        .admin-panel-link {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            margin: 20px 0;
            transition: all 0.3s ease;
        }
        .admin-panel-link:hover {
            background: #5a67d8;
            transform: translateY(-2px);
        }
        .section { 
            margin-bottom: 40px; 
            padding: 25px; 
            border: 2px dashed #e0e0e0; 
            border-radius: 15px;
            background: #fafafa;
        }
        .section h2 { 
            color: #333; 
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .upload-form { 
            display: flex; 
            flex-direction: column; 
            gap: 15px; 
            max-width: 500px;
        }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-group label { font-weight: 600; color: #555; }
        .form-group input, .form-group select { 
            padding: 12px; 
            border: 2px solid #ddd; 
            border-radius: 8px;
            font-size: 16px;
        }
        .form-group input:focus, .form-group select:focus { 
            outline: none; 
            border-color: #667eea; 
        }
        .form-group small {
            color: #666;
            font-size: 14px;
            font-style: italic;
        }
        .btn { 
            padding: 12px 24px; 
            background: #667eea; 
            color: white; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: background 0.3s;
        }
        .btn:hover { background: #5a6fd8; }
        .btn-danger { background: #e74c3c; }
        .btn-danger:hover { background: #c0392b; }
        .images-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
            gap: 20px; 
            margin-top: 20px;
        }
        .image-card { 
            background: white; 
            border-radius: 10px; 
            padding: 15px; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            text-align: center;
        }
        .image-card img { 
            width: 100%; 
            height: 120px; 
            object-fit: cover; 
            border-radius: 8px; 
            margin-bottom: 10px;
        }
        .image-card h4 { color: #333; margin-bottom: 5px; }
        .image-card p { color: #666; font-size: 14px; margin-bottom: 10px; }
        .status { 
            padding: 10px; 
            border-radius: 8px; 
            margin: 10px 0;
            display: none;
        }
        .status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .api-info {
            background: #e8f4fd;
            border: 1px solid #bee5eb;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
        }
        .api-info h3 { color: #0c5460; margin-bottom: 10px; }
        .api-info code { 
            background: #fff; 
            padding: 2px 6px; 
            border-radius: 4px; 
            color: #e83e8c;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏋️ Gym App - Panel de Administración</h1>
            <p>Gestiona las imágenes de máquinas y tipos de agarre</p>
            <a href="/panel" class="admin-panel-link">🏆 Ir al Panel Completo de Administración</a>
        </div>

        <!-- Subir Máquinas -->
        <div class="section">
            <h2>🏋️ Subir Máquina de Ejercicio</h2>
            <form class="upload-form" id="machineForm" enctype="multipart/form-data">
                <div class="form-group">
                    <label>Nombre de la Máquina:</label>
                    <input type="text" name="machineName" placeholder="Ej: Press de Banca, Jalón al Pecho, Remo..." required>
                    <small style="color: #666;">Será una máquina principal del gimnasio</small>
                </div>
                <div class="form-group">
                    <label>Imagen:</label>
                    <input type="file" name="image" accept="image/*" required>
                </div>
                <button type="submit" class="btn">Subir Máquina</button>
            </form>
        </div>

        <!-- Subir Tipos de Agarre -->
        <div class="section">
            <h2>🤲 Subir Tipo de Agarre</h2>
            <form class="upload-form" id="gripForm" enctype="multipart/form-data">
                <div class="form-group">
                    <label>Nombre del Agarre:</label>
                    <input type="text" name="gripName" placeholder="Ej: Agarre Amplio, Agarre Cerrado, Neutro..." required>
                    <small style="color: #666;">Será un tipo de agarre disponible</small>
                </div>
                <div class="form-group">
                    <label>¿Para qué máquinas es este agarre?</label>
                    <div id="machineCheckboxes" style="border: 2px solid #ddd; border-radius: 5px; padding: 10px; max-height: 200px; overflow-y: auto;">
                        <!-- Se llenarán dinámicamente con checkboxes -->
                    </div>
                    <small style="color: #666;">Selecciona una o más máquinas para este agarre</small>
                </div>
                <div class="form-group">
                    <label>Imagen:</label>
                    <input type="file" name="image" accept="image/*" required>
                </div>
                <button type="submit" class="btn">Subir Agarre</button>
            </form>
        </div>

        <!-- Estado -->
        <div id="status" class="status"></div>

        <!-- Relaciones Máquina-Agarre -->
        <div class="section">
            <h2>🔗 Gestión de Relaciones Máquina-Agarre</h2>
            <p style="color: #666; margin-bottom: 20px;">Configura qué tipos de agarre están disponibles para cada máquina</p>
            
            <div id="machineGripRelations">
                <!-- Se llenarán dinámicamente -->
            </div>
            
            <button class="btn" onclick="saveAllRelations()" style="margin-top: 20px;">
                💾 Guardar Todas las Relaciones
            </button>
        </div>

        <!-- Imágenes Actuales -->
        <div class="section">
            <h2>📁 Imágenes Actuales</h2>
            <div class="images-grid" id="imagesGrid">
                <!-- Se llenarán dinámicamente -->
            </div>
        </div>

        <!-- Info API -->
        <div class="api-info">
            <h3>📡 Información de la API</h3>
            <p><strong>Ejercicios (Máquinas):</strong> <code>GET /api/exercises</code></p>
            <p><strong>Tipos de Agarre (todos):</strong> <code>GET /api/grip-types</code></p>
            <p><strong>Tipos de Agarre (por máquina):</strong> <code>GET /api/grip-types/:machineId</code></p>
            <p><strong>Subir imagen:</strong> <code>POST /api/exercises/upload</code></p>
            <p><strong>Editar imagen:</strong> <code>PUT /api/exercises/edit</code></p>
            <p><strong>Eliminar imagen:</strong> <code>DELETE /api/exercises/:filename</code></p>
            <p><strong>Imágenes:</strong> <code>GET /images/[archivo]</code></p>
            <p><strong>Metadata:</strong> <code>GET /api/metadata</code></p>
            <p><strong>Todos los archivos:</strong> <code>GET /api/all-files</code></p>
            <p><strong>Estado:</strong> <code>GET /api/health</code></p>
            <p style="margin-top: 15px; font-style: italic; color: #666;">
                ✅ Cada máquina se clasifica automáticamente como "machine"<br>
                ✅ Cada agarre se asocia a una máquina específica o a todas<br>
                ✅ Los agarres se filtran por máquina en la app<br>
                ✅ Puedes editar nombres, cambiar imágenes y reasignar máquinas
            </p>
        </div>
    </div>

    <script>
        // Cargar imágenes al iniciar
        loadImages();
        loadMachinesForSelect();
        loadMachineGripRelations();

        // Form de máquinas
        document.getElementById('machineForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const machineName = formData.get('machineName').trim();
            
            if (!machineName) {
                showStatus('Por favor ingresa el nombre de la máquina', 'error');
                return;
            }
            
            // Convertir nombre a formato de archivo (sin espacios, lowercase)
            const fileName = machineName.toLowerCase()
                .replace(/[áéíóúñ]/g, match => ({
                    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n'
                }[match]))
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
            
            // Renombrar archivo - agregar prefijo 'machine_' para identificación automática
            const file = formData.get('image');
            const newFile = new File([file], 'machine_' + fileName + '.' + file.name.split('.').pop(), {type: file.type});
            formData.set('image', newFile);
            formData.set('name', machineName);
            formData.set('type', 'machine'); // Indicar explícitamente que es máquina

            await uploadFile(formData, 'Máquina');
            e.target.reset();
            // Recargar las máquinas en el select después de agregar una nueva
            loadMachinesForSelect();
        });

        // Form de agarres
        document.getElementById('gripForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const gripName = formData.get('gripName').trim();
            
            // Obtener máquinas seleccionadas
            const selectedMachines = Array.from(document.querySelectorAll('input[name="machinesFor"]:checked'))
                .map(checkbox => checkbox.value);
            
            if (!gripName) {
                showStatus('Por favor ingresa el nombre del agarre', 'error');
                return;
            }
            
            if (selectedMachines.length === 0) {
                showStatus('Por favor selecciona al menos una máquina para este agarre', 'error');
                return;
            }
            
            // Convertir nombre a formato de archivo (sin espacios, lowercase)
            const fileName = gripName.toLowerCase()
                .replace(/[áéíóúñ]/g, match => ({
                    'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n'
                }[match]))
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
            
            // Renombrar archivo - agregar prefijo 'grip_' para identificación automática
            const file = formData.get('image');
            const newFile = new File([file], 'grip_' + fileName + '.' + file.name.split('.').pop(), {type: file.type});
            formData.set('image', newFile);
            formData.set('name', gripName);
            formData.set('type', 'grip'); // Indicar explícitamente que es agarre
            formData.set('selectedMachines', JSON.stringify(selectedMachines)); // Enviar máquinas seleccionadas

            await uploadFileWithMachines(formData, 'Agarre', selectedMachines);
            e.target.reset();
            // Recargar relaciones después de agregar un nuevo agarre
            loadMachineGripRelations();
        });

        async function uploadFile(formData, type) {
            try {
                showStatus('Subiendo ' + type + '...', 'success');
                const response = await fetch('/api/exercises/upload', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                
                if (result.success) {
                    showStatus(type + ' subido correctamente: ' + result.data.exerciseName, 'success');
                    loadImages();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }

        async function uploadFileWithMachines(formData, type, selectedMachines) {
            try {
                showStatus('Subiendo ' + type + '...', 'success');
                const response = await fetch('/api/exercises/upload', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                
                if (result.success) {
                    // Crear las relaciones en la base de datos
                    const gripId = result.data.filename.replace(/\.[^/.]+$/, "");
                    const relations = selectedMachines.map(machineId => ({
                        machine_id: machineId,
                        grip_type_id: gripId
                    }));
                    
                    const relationsResponse = await fetch('/api/machine-grip-relations', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            relations: relations,
                            append: true // Agregar a las relaciones existentes
                        })
                    });
                    
                    const relationsResult = await relationsResponse.json();
                    
                    if (relationsResult.success) {
                        showStatus(type + ' subido y asociado a ' + selectedMachines.length + ' máquina(s)', 'success');
                    } else {
                        showStatus(type + ' subido pero error al crear relaciones: ' + relationsResult.error, 'error');
                    }
                    
                    loadImages();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }

        async function loadMachinesForSelect() {
            try {
                const response = await fetch('/api/all-files');
                const result = await response.json();
                
                if (result.success) {
                    const machines = result.data.filter(item => item.type === 'Máquina');
                    const container = document.getElementById('machineCheckboxes');
                    
                    if (machines.length === 0) {
                        container.innerHTML = '<p style="color: #666; text-align: center;">No hay máquinas disponibles</p>';
                        return;
                    }
                    
                    container.innerHTML = machines.map(machine => {
                        const machineId = machine.filename.replace(/\.[^/.]+$/, "");
                        return \`
                            <label style="display: flex; align-items: center; padding: 8px; cursor: pointer;">
                                <input type="checkbox" name="machinesFor" value="\${machineId}" style="margin-right: 8px;">
                                <span>\${machine.name}</span>
                            </label>
                        \`;
                    }).join('');
                }
            } catch (error) {
                console.error('Error loading machines for checkboxes:', error);
            }
        }

        async function loadImages() {
            try {
                const response = await fetch('/api/all-files');
                const result = await response.json();
                
                if (result.success) {
                    displayImages(result.data);
                }
            } catch (error) {
                console.error('Error loading images:', error);
            }
        }

        function displayImages(files) {
            const grid = document.getElementById('imagesGrid');
            grid.innerHTML = files.map(file => \`
                <div class="image-card">
                    <img src="/images/\${file.filename}" alt="\${file.name}">
                    <h4>\${file.name}</h4>
                    <p><strong>Tipo:</strong> \${file.type}</p>
                    <p><strong>Archivo:</strong> \${file.filename}</p>
                    \${file.metadata.machineFor ? \`<p><strong>Para máquina:</strong> \${file.metadata.machineFor === 'all' ? 'Todas las máquinas' : getMachineName(file.metadata.machineFor)}</p>\` : ''}
                    <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px;">
                        <button class="btn" onclick="editImage('\${file.filename}', '\${file.type}', '\${file.name}', '\${file.metadata.machineFor || ''}')" style="font-size: 12px; padding: 6px 10px;">
                            ✏️ Editar
                        </button>
                        <button class="btn btn-danger" onclick="deleteFile('\${file.filename}')" style="font-size: 12px; padding: 6px 10px;">
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            \`).join('');
        }

        async function deleteFile(filename) {
            if (!confirm('¿Seguro que quieres eliminar esta imagen?')) return;
            
            try {
                const response = await fetch('/api/exercises/' + filename, {
                    method: 'DELETE'
                });
                const result = await response.json();
                
                if (result.success) {
                    showStatus('Imagen eliminada correctamente', 'success');
                    loadImages();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }

        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.className = 'status ' + type;
            status.textContent = message;
            status.style.display = 'block';
            
            setTimeout(() => {
                status.style.display = 'none';
            }, 5000);
        }

        // Variable global para almacenar las máquinas
        let machines = [];
        let gripTypes = [];

        async function loadMachineGripRelations() {
            try {
                // Cargar máquinas y agarres disponibles desde all-files
                const filesResponse = await fetch('/api/all-files');
                const filesResult = await filesResponse.json();
                
                if (filesResult.success) {
                    // Separar máquinas de agarres
                    machines = filesResult.data.filter(item => item.type === 'Máquina');
                    gripTypes = filesResult.data.filter(item => item.type === 'Agarre');
                    
                    console.log('Máquinas encontradas:', machines.length);
                    console.log('Agarres encontrados:', gripTypes.length);
                    
                    // Cargar relaciones existentes
                    const relationsResponse = await fetch('/api/machine-grip-relations');
                    const relationsResult = await relationsResponse.json();
                    
                    if (relationsResult.success) {
                        displayMachineGripRelations(relationsResult.data || []);
                    } else {
                        // Si no hay relaciones, mostrar interface vacía
                        displayMachineGripRelations([]);
                    }
                }
            } catch (error) {
                console.error('Error loading machine-grip relations:', error);
                showStatus('Error cargando relaciones: ' + error.message, 'error');
            }
        }

        function displayMachineGripRelations(relations) {
            const container = document.getElementById('machineGripRelations');
            
            if (machines.length === 0) {
                container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No hay máquinas disponibles. Sube algunas máquinas primero.</p>';
                return;
            }
            
            if (gripTypes.length === 0) {
                container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No hay agarres disponibles. Sube algunos agarres primero.</p>';
                return;
            }
            
            container.innerHTML = machines.map(machine => {
                // Usar filename sin extensión como ID de máquina
                const machineId = machine.filename.replace(/\.[^/.]+$/, "");
                const machineRelations = relations.filter(rel => rel.machine_id === machineId);
                
                return \`
                    <div style="border: 2px solid #e0e0e0; border-radius: 10px; padding: 20px; margin-bottom: 20px; background: #f9f9f9;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">
                            🏋️ \${machine.name}
                            <span style="font-size: 14px; color: #666; font-weight: normal;">(ID: \${machineId})</span>
                        </h3>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
                            \${gripTypes.map(grip => {
                                // Usar filename sin extensión como ID de agarre
                                const gripId = grip.filename.replace(/\.[^/.]+$/, "");
                                const isChecked = machineRelations.some(rel => rel.grip_type_id === gripId);
                                return \`
                                    <label style="display: flex; align-items: center; padding: 8px; background: white; border-radius: 5px; cursor: pointer;">
                                        <input type="checkbox" 
                                               data-machine-id="\${machineId}" 
                                               data-grip-id="\${gripId}"
                                               \${isChecked ? 'checked' : ''} 
                                               style="margin-right: 8px; transform: scale(1.2);">
                                        <span>\${grip.name}</span>
                                    </label>
                                \`;
                            }).join('')}
                        </div>
                        
                        <div style="margin-top: 15px; font-size: 12px; color: #666;">
                            Total agarres seleccionados: <span class="grip-count">\${machineRelations.length}</span>
                        </div>
                    </div>
                \`;
            }).join('');
            
            // Agregar event listeners para actualizar contadores
            container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', updateGripCount);
            });
        }

        function updateGripCount(event) {
            const machineDiv = event.target.closest('[style*="border: 2px solid"]');
            const checkboxes = machineDiv.querySelectorAll('input[type="checkbox"]:checked');
            const counter = machineDiv.querySelector('.grip-count');
            counter.textContent = checkboxes.length;
        }

        async function saveAllRelations() {
            try {
                const relations = [];
                
                // Recopilar todas las relaciones marcadas
                document.querySelectorAll('#machineGripRelations input[type="checkbox"]:checked').forEach(checkbox => {
                    relations.push({
                        machine_id: checkbox.dataset.machineId,
                        grip_type_id: checkbox.dataset.gripId
                    });
                });
                
                showStatus('Guardando relaciones...', 'success');
                
                const response = await fetch('/api/machine-grip-relations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ relations })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showStatus(\`Relaciones guardadas correctamente: \${relations.length} asociaciones activas\`, 'success');
                    loadMachineGripRelations(); // Recargar para mostrar cambios
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }

        function getMachineName(machineId) {
            const machine = machines.find(m => m.id === machineId);
            return machine ? machine.name : machineId;
        }

        async function editImage(filename, type, currentName, currentMachineFor) {
            const modal = document.createElement('div');
            modal.style.cssText = \`
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            \`;

            const formHTML = \`
                <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; width: 90%;">
                    <h3>✏️ Editar \${type === 'Máquina' ? 'Máquina' : 'Agarre'}</h3>
                    <form id="editForm">
                        <div style="margin: 15px 0;">
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Nombre:</label>
                            <input type="text" id="editName" value="\${currentName}" required 
                                   style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px;">
                        </div>
                        
                        \${type === 'Agarre' ? \`
                        <div style="margin: 15px 0;">
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Máquina asociada:</label>
                            <select id="editMachineFor" required style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px;">
                                <option value="">Selecciona una máquina...</option>
                                <option value="all" \${currentMachineFor === 'all' ? 'selected' : ''}>Para todas las máquinas</option>
                            </select>
                        </div>
                        \` : ''}
                        
                        <div style="margin: 15px 0;">
                            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Nueva imagen (opcional):</label>
                            <input type="file" id="editImage" accept="image/*" 
                                   style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px;">
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="btn" style="flex: 1;">Guardar Cambios</button>
                            <button type="button" onclick="this.closest('[style*=\"position: fixed\"]').remove()" 
                                    class="btn btn-danger" style="flex: 1;">Cancelar</button>
                        </div>
                    </form>
                </div>
            \`;

            modal.innerHTML = formHTML;
            document.body.appendChild(modal);

            // Cargar máquinas en el select si es un agarre
            if (type === 'Agarre') {
                const select = document.getElementById('editMachineFor');
                machines.forEach(machine => {
                    const option = document.createElement('option');
                    option.value = machine.id;
                    option.textContent = machine.name;
                    option.selected = currentMachineFor === machine.id;
                    select.appendChild(option);
                });
            }

            // Manejar el submit del formulario
            document.getElementById('editForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveEdit(filename, type);
                modal.remove();
            });
        }

        async function saveEdit(filename, type) {
            try {
                const formData = new FormData();
                const newName = document.getElementById('editName').value.trim();
                const newImage = document.getElementById('editImage').files[0];
                
                formData.append('name', newName);
                formData.append('filename', filename);
                
                if (type === 'Agarre') {
                    const machineFor = document.getElementById('editMachineFor').value;
                    formData.append('machineFor', machineFor);
                }
                
                if (newImage) {
                    formData.append('image', newImage);
                }

                showStatus('Guardando cambios...', 'success');
                const response = await fetch('/api/exercises/edit', {
                    method: 'PUT',
                    body: formData
                });
                const result = await response.json();
                
                if (result.success) {
                    showStatus('Cambios guardados correctamente', 'success');
                    loadImages();
                } else {
                    throw new Error(result.message);
                }
            } catch (error) {
                showStatus('Error: ' + error.message, 'error');
            }
        }
    </script>
</body>
</html>
  `;
  
  res.send(htmlContent);
});

// Ruta para el panel de administración completo
app.get('/panel', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Endpoint temporal para crear usuario de prueba (SOLO PARA DESARROLLO)
app.get('/api/create-test-user', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash('123456', 12);
    
    // Verificar si el usuario ya existe
    const existingUser = await db.query('SELECT id FROM users WHERE username = $1 OR email = $2', ['testuser', 'test@example.com']);
    
    if (existingUser.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Usuario de prueba ya existe',
        user: { username: 'testuser', email: 'test@example.com' }
      });
    }
    
    // Crear usuario de prueba
    const result = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      ['testuser', 'test@example.com', hashedPassword]
    );
    
    res.json({
      success: true,
      message: 'Usuario de prueba creado exitosamente',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error creando usuario de prueba:', error);
    res.status(500).json({ 
      error: 'Error creando usuario de prueba', 
      details: error.message 
    });
  }
});

// Ruta para obtener todos los archivos (para la web de administración)
app.get('/api/all-files', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      })
      .map(filename => {
        const filePath = path.join(uploadsDir, filename);
        const stats = fs.statSync(filePath);
        const nameWithoutExt = path.parse(filename).name;
        const fileMeta = getImageMetadata(filename) || {};
        
        return {
          filename,
          name: fileMeta.name || nameWithoutExt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          size: stats.size,
          uploadDate: fileMeta.uploadDate || stats.birthtime,
          type: fileMeta.type === 'machine' ? 'Máquina' : 'Agarre',
          metadata: fileMeta
        };
      })
      .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

    res.json({
      success: true,
      data: files,
      total: files.length
    });
  } catch (error) {
    console.error('Error reading files:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener archivos',
      error: error.message
    });
  }
});

// Ruta para obtener metadata de todas las imágenes
app.get('/api/metadata', (req, res) => {
  try {
    const metadata = readMetadata();
    res.json({
      success: true,
      data: metadata,
      total: Object.keys(metadata).length
    });
  } catch (error) {
    console.error('Error reading metadata:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener metadata',
      error: error.message
    });
  }
});

// RUTAS ADMINISTRATIVAS

// Ruta para acceder al panel de administración
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Middleware para verificar administrador
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Token de acceso requerido' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    
    if (!user.rows[0] || !user.rows[0].is_admin) {
      return res.status(403).json({ success: false, error: 'Acceso de administrador requerido' });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Token inválido' });
  }
};

// Estadísticas para el dashboard
app.get('/api/admin/users/stats', async (req, res) => {
  try {
    const totalUsers = await db.query('SELECT COUNT(*) as count FROM users');
    const activeUsers = await db.query('SELECT COUNT(*) as count FROM users WHERE is_active = true');
    
    res.json({
      success: true,
      total: parseInt(totalUsers.rows[0].count),
      active: parseInt(activeUsers.rows[0].count)
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.get('/api/admin/weight-records/stats', async (req, res) => {
  try {
    const totalRecords = await db.query('SELECT COUNT(*) as count FROM weight_records');
    
    res.json({
      success: true,
      total: parseInt(totalRecords.rows[0].count)
    });
  } catch (error) {
    console.error('Error getting weight records stats:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Gestión de usuarios
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await db.query(`
      SELECT id, username, email, first_name, last_name, phone, date_of_birth, 
             is_active, is_admin, created_at, last_login
      FROM users 
      ORDER BY created_at DESC
    `);
    
    res.json({
      success: true,
      users: users.rows
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.post('/api/admin/users', async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, phone, date_of_birth, is_admin, is_active } = req.body;
    
    // Verificar si el usuario ya existe
    const existingUser = await db.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'El usuario o email ya existe' });
    }
    
    // Encriptar contraseña
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Crear usuario
    const newUser = await db.query(`
      INSERT INTO users (id, username, email, password_hash, first_name, last_name, phone, date_of_birth, is_admin, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id, username, email, first_name, last_name, is_admin, is_active
    `, [uuidv4(), username, email, passwordHash, first_name, last_name, phone, date_of_birth, is_admin, is_active]);
    
    res.status(201).json({
      success: true,
      message: 'Usuario creado correctamente',
      user: newUser.rows[0]
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, first_name, last_name, phone, date_of_birth, is_admin, is_active } = req.body;
    
    let query = `
      UPDATE users SET 
        username = $1, email = $2, first_name = $3, last_name = $4, 
        phone = $5, date_of_birth = $6, is_admin = $7, is_active = $8, updated_at = NOW()
    `;
    let params = [username, email, first_name, last_name, phone, date_of_birth, is_admin, is_active];
    
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      query += ', password_hash = $9 WHERE id = $10';
      params.push(passwordHash, id);
    } else {
      query += ' WHERE id = $9';
      params.push(id);
    }
    
    const result = await db.query(query, params);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    res.json({
      success: true,
      message: 'Usuario actualizado correctamente'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.post('/api/admin/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    const result = await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    res.json({
      success: true,
      message: 'Contraseña reiniciada correctamente'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.put('/api/admin/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    const result = await db.query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2',
      [is_active, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    res.json({
      success: true,
      message: `Usuario ${is_active ? 'activado' : 'desactivado'} correctamente`
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que no sea el único administrador
    const adminCount = await db.query('SELECT COUNT(*) as count FROM users WHERE is_admin = true');
    const userToDelete = await db.query('SELECT is_admin FROM users WHERE id = $1', [id]);
    
    if (userToDelete.rows[0]?.is_admin && parseInt(adminCount.rows[0].count) <= 1) {
      return res.status(400).json({ success: false, error: 'No se puede eliminar el único administrador' });
    }
    
    const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
    
    res.json({
      success: true,
      message: 'Usuario eliminado correctamente'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Gestión de imágenes
app.get('/api/admin/images', (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ success: true, images: [] });
    }
    
    const files = fs.readdirSync(uploadsDir);
    const images = files
      .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
      .map(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          url: `/images/${file}`,
          size: stats.size,
          uploadDate: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    
    res.json({
      success: true,
      images: images
    });
  } catch (error) {
    console.error('Error getting images:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

app.delete('/api/admin/images/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Imagen no encontrada' });
    }
    
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      message: 'Imagen eliminada correctamente'
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Eliminar registro de peso (usando POST como workaround)
app.post('/api/weight-records/:recordId', async (req, res) => {
  try {
    // Solo procesar si es una simulación de DELETE
    if (req.body._method !== 'DELETE') {
      return res.status(405).json({ success: false, error: 'Método no permitido' });
    }
    
    const { recordId } = req.params;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    console.log(`🗑️ Solicitud de eliminación para registro: ${recordId}`);
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
    }
    
    // Verificar token y obtener usuario
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    
    // Verificar que el registro pertenece al usuario
    const checkOwnership = await db.query(
      'SELECT user_id FROM weight_records WHERE id = $1',
      [recordId]
    );
    
    if (checkOwnership.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Registro no encontrado' 
      });
    }
    
    if (checkOwnership.rows[0].user_id !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'No tienes permiso para eliminar este registro' 
      });
    }
    
    // Eliminar el registro
    const result = await db.query(
      'DELETE FROM weight_records WHERE id = $1 AND user_id = $2',
      [recordId, userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Registro no encontrado' 
      });
    }
    
    console.log('✅ Registro eliminado correctamente');
    res.json({
      success: true,
      message: 'Registro eliminado correctamente'
    });
  } catch (error) {
    console.error('❌ Error deleting weight record:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// RUTAS PARA ENTRENAMIENTOS

// Obtener entrenamientos del usuario
app.get('/api/workouts', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    
    // Obtener rutinas del usuario con sus ejercicios
    const workouts = await db.query(`
      SELECT 
        ur.id,
        ur.routine_name,
        ur.description,
        ur.is_active,
        ur.created_at,
        ur.updated_at,
        COUNT(re.id) as exercise_count
      FROM user_routines ur
      LEFT JOIN routine_exercises re ON ur.id = re.routine_id
      WHERE ur.user_id = $1
      GROUP BY ur.id, ur.routine_name, ur.description, ur.is_active, ur.created_at, ur.updated_at
      ORDER BY ur.created_at DESC
    `, [userId]);
    
    res.json({
      success: true,
      workouts: workouts.rows
    });
  } catch (error) {
    console.error('Error getting workouts:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Obtener detalles de un entrenamiento específico
app.get('/api/workouts/:workoutId', async (req, res) => {
  try {
    const { workoutId } = req.params;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    
    // Obtener datos del entrenamiento
    const workout = await db.query(`
      SELECT * FROM user_routines 
      WHERE id = $1 AND user_id = $2
    `, [workoutId, userId]);
    
    if (workout.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Entrenamiento no encontrado' });
    }
    
    // Obtener ejercicios del entrenamiento
    const exercises = await db.query(`
      SELECT * FROM routine_exercises 
      WHERE routine_id = $1 
      ORDER BY order_in_routine ASC
    `, [workoutId]);
    
    res.json({
      success: true,
      workout: {
        ...workout.rows[0],
        exercises: exercises.rows
      }
    });
  } catch (error) {
    console.error('Error getting workout details:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Crear nuevo entrenamiento
app.post('/api/workouts', async (req, res) => {
  try {
    const { routine_name, description, exercises } = req.body;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    
    // Iniciar transacción
    await db.query('BEGIN');
    
    try {
      // Crear la rutina
      const workoutId = uuidv4();
      await db.query(`
        INSERT INTO user_routines (id, user_id, routine_name, description, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, true, NOW(), NOW())
      `, [workoutId, userId, routine_name, description || null]);
      
      // Agregar ejercicios si se proporcionaron
      if (exercises && exercises.length > 0) {
        for (let i = 0; i < exercises.length; i++) {
          const exercise = exercises[i];
          await db.query(`
            INSERT INTO routine_exercises (
              id, routine_id, exercise_name, machine_id, grip_type, 
              sets, reps, weight, rest_seconds, notes, order_in_routine, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          `, [
            uuidv4(),
            workoutId,
            exercise.exercise_name,
            exercise.machine_id || null,
            exercise.grip_type || null,
            exercise.sets || 1,
            exercise.reps || 1,
            exercise.weight || null,
            exercise.rest_seconds || 60,
            exercise.notes || null,
            i + 1
          ]);
        }
      }
      
      // Confirmar transacción
      await db.query('COMMIT');
      
      res.status(201).json({
        success: true,
        message: 'Entrenamiento creado correctamente',
        workoutId: workoutId
      });
    } catch (error) {
      // Revertir transacción en caso de error
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating workout:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Actualizar entrenamiento
app.put('/api/workouts/:workoutId', async (req, res) => {
  try {
    const { workoutId } = req.params;
    const { routine_name, description, exercises } = req.body;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    
    // Verificar que el entrenamiento pertenece al usuario
    const checkOwnership = await db.query(
      'SELECT user_id FROM user_routines WHERE id = $1',
      [workoutId]
    );
    
    if (checkOwnership.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Entrenamiento no encontrado' });
    }
    
    if (checkOwnership.rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para modificar este entrenamiento' });
    }
    
    // Iniciar transacción
    await db.query('BEGIN');
    
    try {
      // Actualizar rutina
      await db.query(`
        UPDATE user_routines 
        SET routine_name = $1, description = $2, updated_at = NOW()
        WHERE id = $3
      `, [routine_name, description, workoutId]);
      
      // Si se proporcionaron ejercicios, eliminar los existentes y agregar los nuevos
      if (exercises) {
        // Eliminar ejercicios existentes
        await db.query('DELETE FROM routine_exercises WHERE routine_id = $1', [workoutId]);
        
        // Agregar nuevos ejercicios
        for (let i = 0; i < exercises.length; i++) {
          const exercise = exercises[i];
          await db.query(`
            INSERT INTO routine_exercises (
              id, routine_id, exercise_name, machine_id, grip_type, 
              sets, reps, weight, rest_seconds, notes, order_in_routine, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          `, [
            uuidv4(),
            workoutId,
            exercise.exercise_name,
            exercise.machine_id || null,
            exercise.grip_type || null,
            exercise.sets || 1,
            exercise.reps || 1,
            exercise.weight || null,
            exercise.rest_seconds || 60,
            exercise.notes || null,
            i + 1
          ]);
        }
      }
      
      // Confirmar transacción
      await db.query('COMMIT');
      
      res.json({
        success: true,
        message: 'Entrenamiento actualizado correctamente'
      });
    } catch (error) {
      // Revertir transacción en caso de error
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating workout:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Eliminar entrenamiento
app.post('/api/workouts/:workoutId/delete', async (req, res) => {
  try {
    const { workoutId } = req.params;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    
    // Verificar que el entrenamiento pertenece al usuario
    const checkOwnership = await db.query(
      'SELECT user_id FROM user_routines WHERE id = $1',
      [workoutId]
    );
    
    if (checkOwnership.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Entrenamiento no encontrado' });
    }
    
    if (checkOwnership.rows[0].user_id !== userId) {
      return res.status(403).json({ success: false, error: 'No tienes permiso para eliminar este entrenamiento' });
    }
    
    // Eliminar entrenamiento (los ejercicios se eliminan automáticamente por CASCADE)
    const result = await db.query(
      'DELETE FROM user_routines WHERE id = $1 AND user_id = $2',
      [workoutId, userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Entrenamiento no encontrado' });
    }
    
    res.json({
      success: true,
      message: 'Entrenamiento eliminado correctamente'
    });
  } catch (error) {
    console.error('Error deleting workout:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// RUTAS PARA RELACIONES MÁQUINA-AGARRE

// Obtener todas las relaciones máquina-agarre
app.get('/api/machine-grip-relations', async (req, res) => {
  try {
    const relations = await db.query(`
      SELECT machine_id, grip_type_id, created_at
      FROM machine_grip_types
      ORDER BY machine_id, grip_type_id
    `);
    
    res.json({
      success: true,
      data: relations.rows
    });
  } catch (error) {
    console.error('Error getting machine-grip relations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Guardar relaciones máquina-agarre
app.post('/api/machine-grip-relations', async (req, res) => {
  try {
    const { relations, append } = req.body;
    
    // Iniciar transacción
    await db.query('BEGIN');
    
    if (!append) {
      // Eliminar todas las relaciones existentes solo si no es modo append
      await db.query('DELETE FROM machine_grip_types');
    }
    
    // Insertar las nuevas relaciones
    for (const relation of relations) {
      // Verificar si la relación ya existe para evitar duplicados
      const existing = await db.query(`
        SELECT id FROM machine_grip_types 
        WHERE machine_id = $1 AND grip_type_id = $2
      `, [relation.machine_id, relation.grip_type_id]);
      
      if (existing.rows.length === 0) {
        await db.query(`
          INSERT INTO machine_grip_types (id, machine_id, grip_type_id, created_at)
          VALUES ($1, $2, $3, NOW())
        `, [uuidv4(), relation.machine_id, relation.grip_type_id]);
      }
    }
    
    // Confirmar transacción
    await db.query('COMMIT');
    
    res.json({
      success: true,
      message: `${relations.length} relaciones procesadas correctamente`,
      data: relations
    });
  } catch (error) {
    // Revertir transacción en caso de error
    await db.query('ROLLBACK');
    console.error('Error saving machine-grip relations:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Servidor ejecutándose en http://${SERVER_IP}:${PORT}`);
  console.log(`📁 Imágenes disponibles en http://${SERVER_IP}:${PORT}/images`);
  console.log(`🔗 API de ejercicios en http://${SERVER_IP}:${PORT}/api/exercises`);
  
  // Probar conexión a la base de datos
  const dbConnected = await db.testConnection();
  if (dbConnected) {
    console.log('✅ Backend completamente inicializado con base de datos');
    
    // Crear tablas de entrenamientos si no existen
    try {
      // Crear tabla para rutinas de usuarios
      await db.query(`
        CREATE TABLE IF NOT EXISTS user_routines (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          routine_name VARCHAR(255) NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Crear tabla para ejercicios de rutinas
      await db.query(`
        CREATE TABLE IF NOT EXISTS routine_exercises (
          id UUID PRIMARY KEY,
          routine_id UUID NOT NULL REFERENCES user_routines(id) ON DELETE CASCADE,
          exercise_name VARCHAR(255) NOT NULL,
          machine_id VARCHAR(255),
          grip_type VARCHAR(255),
          sets INTEGER DEFAULT 1,
          reps INTEGER DEFAULT 1,
          weight DECIMAL(5,2),
          rest_seconds INTEGER DEFAULT 60,
          notes TEXT,
          order_in_routine INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Crear tabla para ejecuciones de entrenamientos
      await db.query(`
        CREATE TABLE IF NOT EXISTS workout_sessions (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          routine_id UUID REFERENCES user_routines(id) ON DELETE SET NULL,
          session_name VARCHAR(255),
          start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          end_time TIMESTAMP,
          notes TEXT,
          is_completed BOOLEAN DEFAULT false
        )
      `);

      // Crear tabla para sets ejecutados en las sesiones
      await db.query(`
        CREATE TABLE IF NOT EXISTS workout_session_sets (
          id UUID PRIMARY KEY,
          session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
          routine_exercise_id UUID REFERENCES routine_exercises(id) ON DELETE SET NULL,
          exercise_name VARCHAR(255) NOT NULL,
          machine_id VARCHAR(255),
          grip_type VARCHAR(255),
          set_number INTEGER NOT NULL,
          reps_performed INTEGER,
          weight_used DECIMAL(5,2),
          rest_seconds INTEGER,
          notes TEXT,
          completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          order_in_session INTEGER DEFAULT 1
        )
      `);

      // Crear tabla para relaciones máquina-agarre
      await db.query(`
        CREATE TABLE IF NOT EXISTS machine_grip_types (
          id UUID PRIMARY KEY,
          machine_id VARCHAR(255) NOT NULL,
          grip_type_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(machine_id, grip_type_id)
        )
      `);

      console.log('✅ Tablas de entrenamientos creadas/verificadas correctamente');
    } catch (error) {
      console.error('❌ Error creando tablas de entrenamientos:', error);
    }
  } else {
    console.log('⚠️ Backend iniciado pero sin conexión a base de datos');
  }
});