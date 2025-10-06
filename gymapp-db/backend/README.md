# Backend Gym App

## Instalación

1. Ejecuta `install-backend.bat` o manualmente:
```bash
cd backend
npm install
```

## Uso

### Iniciar servidor
```bash
cd backend
npm start
```

### Desarrollo (con auto-reload)
```bash
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