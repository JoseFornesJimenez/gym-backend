# 🏋️ Gym App Backend

Backend API para la aplicación de gimnasio con React Native. Incluye gestión de usuarios, entrenamientos, ejercicios y seguimiento de progreso.

## 🚀 Características

- ✅ **Autenticación JWT** - Login y registro seguro
- ✅ **Gestión de Entrenamientos** - CRUD completo
- ✅ **Ejercicios y Máquinas** - Catálogo con imágenes
- ✅ **Registro de Pesos** - Seguimiento de progreso
- ✅ **Grupos Musculares** - Filtrado dinámico
- ✅ **Subida de Imágenes** - Multer para archivos
- ✅ **Base de Datos PostgreSQL** - Almacenamiento robusto
- ✅ **CORS habilitado** - Compatible con React Native

## 📋 Prerrequisitos

- Node.js (v14 o superior)
- PostgreSQL (v12 o superior)
- npm o yarn

## ⚡ Instalación Rápida

### 1. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/gym-backend.git
cd gym-backend
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` basado en `.env.example`:
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus configuraciones:
```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gym_app
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
JWT_SECRET=tu_jwt_secret_muy_seguro
```

### 4. Configurar la base de datos
```bash
# Crear la base de datos
psql -U postgres -c "CREATE DATABASE gym_app;"

# Ejecutar el script de configuración de la base de datos
psql -U postgres -d gym_app -f database/setup.sql
psql -U tu_usuario -d gym_app -f database/schema.sql
```

## 🏃‍♂️ Uso

### Desarrollo (con auto-reload)
```bash
npm run dev
```

### Producción
```bash
npm start
```

El servidor estará disponible en `http://localhost:3001`

## 🎛️ Panel de Administración

### Acceso al Panel
Una vez iniciado el servidor, accede al panel web en:
```
http://localhost:3001/panel
```

### Funcionalidades del Panel

#### 🏋️ Gestión de Máquinas
- **Ver todas las máquinas** con sus asociaciones de grupos musculares
- **Editar máquinas**: Cambiar nombre, tipo y asociaciones
- **Eliminar máquinas** (incluye todas sus asociaciones)
- **Búsqueda en tiempo real** por nombre o grupo muscular

#### 💪 Gestión de Grupos Musculares
- **Crear nuevos grupos** con color personalizado
- **Editar grupos existentes** (nombre, color)
- **Ver cantidad** de máquinas asociadas por grupo
- **Eliminar grupos** (incluye todas las asociaciones)

#### 🔗 Gestión de Asociaciones
- **Asociar/desasociar** máquinas con grupos musculares
- **Vista de resumen** de todas las asociaciones
- **Edición en tiempo real** desde la interfaz de máquinas

### Grupos Musculares Predeterminados
- **Pecho** (#FF6B6B) - Press, máquinas de pecho
- **Espalda** (#4ECDC4) - Remo, jalones, poleas
- **Piernas** (#45B7D1) - Prensa, extensiones, femoral
- **Bíceps** (#FFEAA7) - Curl de bíceps
- **Tríceps** (#FF9500) - Extensiones de tríceps
- **Culo** (#E74C3C) - Sentadilla multipower, ejercicios de glúteos
- **Pesas Libres** (#2ECC71) - Mancuernas, pesas

## 📁 Estructura del Proyecto

```
gym-backend/
├── database/           # Configuración y esquemas de BD
│   ├── database.js    # Conexión PostgreSQL
│   └── schema.sql     # Esquema de la base de datos
├── public/            # Archivos estáticos
│   └── images/        # Imágenes de ejercicios
├── uploads/           # Archivos subidos temporalmente
├── server.js          # Archivo principal del servidor
├── .env               # Variables de entorno (no versionado)
├── .env.example       # Ejemplo de variables de entorno
├── package.json       # Dependencias y scripts
└── README.md          # Esta documentación
```

## 🛠️ API Endpoints

### 🔐 Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener perfil del usuario

### 🏋️ Entrenamientos
- `GET /api/workouts` - Listar entrenamientos del usuario
- `POST /api/workouts` - Crear nuevo entrenamiento
- `GET /api/workouts/:id` - Obtener entrenamiento específico
- `PUT /api/workouts/:id` - Actualizar entrenamiento
- `DELETE /api/workouts/:id` - Eliminar entrenamiento

### 💪 Ejercicios
- `GET /api/exercises` - Listar todos los ejercicios
- `POST /api/exercises` - Crear nuevo ejercicio
- `PUT /api/exercises/:id` - Actualizar ejercicio
- `DELETE /api/exercises/:id` - Eliminar ejercicio

### 📊 Registro de Pesos
- `GET /api/weight-records/user/:userId` - Historial de pesos
- `POST /api/weight-records` - Registrar nuevo peso
- `PUT /api/weight-records/:id` - Actualizar registro
- `DELETE /api/weight-records/:id` - Eliminar registro

### 🎯 Grupos Musculares
- `GET /api/muscle-groups` - Listar grupos musculares
- `POST /api/muscle-groups/:groupId/exercises` - Asociar ejercicio
- `DELETE /api/muscle-groups/:groupId/exercises/:exerciseId` - Desasociar

### 📷 Imágenes
- `POST /api/upload/image` - Subir imagen de ejercicio
- `GET /images/:filename` - Obtener imagen

## 🔧 Configuración de Producción

### Con Docker
```bash
# Construir imagen
docker build -t gym-backend .

# Ejecutar contenedor
docker run -d -p 3001:3001 --env-file .env gym-backend
```

### Con PM2
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicación
pm2 start server.js --name "gym-backend"

# Ver logs
pm2 logs gym-backend

# Reiniciar
pm2 restart gym-backend
```

## 🗄️ Base de Datos

### Esquema Principal
- `users` - Usuarios del sistema
- `workouts` - Rutinas de entrenamiento
- `exercises` - Catálogo de ejercicios
- `weight_records` - Histórico de pesos
- `muscle_groups` - Grupos musculares
- `machine_muscle_groups` - Asociaciones ejercicio-grupo

### Backup
```bash
# Crear backup
pg_dump -U usuario -d gym_app > backup.sql

# Restaurar backup
psql -U usuario -d gym_app < backup.sql
```

## 🚀 Despliegue

### En tu servidor Linux:
```bash
# 1. Clonar repositorio
git clone https://github.com/TU_USUARIO/gym-backend.git
cd gym-backend

# 2. Instalar dependencias
npm install --production

# 3. Configurar variables de entorno
cp .env.example .env
nano .env

# 4. Iniciar con PM2
pm2 start server.js --name gym-backend
pm2 save
pm2 startup
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Changelog

### v1.0.0
- ✅ Sistema de autenticación JWT
- ✅ CRUD de entrenamientos y ejercicios
- ✅ Subida de imágenes
- ✅ Registro de progreso de pesos
- ✅ Grupos musculares dinámicos

## 📞 Soporte

Si tienes problemas o preguntas:
1. Revisa la [documentación de la API](./API.md)
2. Verifica los logs: `pm2 logs gym-backend`
3. Abre un issue en GitHub

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.
cd backend
npm run dev
```

## API Endpoints

- `GET /api/exercises` - Obtener todos los ejercicios
- `GET /api/exercises/:id` - Obtener ejercicio específico
- `POST /api/exercises/upload` - Subir nueva imagen de ejercicio
- `DELETE /api/exercises/:filename` - Eliminar ejercicio
- `GET /api/health` - Estado del servidor

## Cómo agregar imágenes

1. Coloca las imágenes en la carpeta `backend/uploads/`
2. Los nombres de archivo se convertirán automáticamente en nombres de ejercicio
3. Ejemplo: `press-de-banca.jpg` → "Press De Banca"

## URLs de las imágenes

Las imágenes están disponibles en: `http://localhost:3001/images/[nombre-archivo]`

## Estructura de respuesta

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Press De Banca",
      "image": "http://localhost:3001/images/press-de-banca.jpg",
      "filename": "press-de-banca.jpg"
    }
  ],
  "count": 1
}
```