# 🚀 Guía para Subir el Backend a GitHub

## ✅ Paso 1: Crear repositorio en GitHub
1. Ve a https://github.com
2. Haz clic en "New repository" (botón verde)
3. Nombre del repositorio: `gym-backend`
4. Descripción: `Backend API para aplicación de gimnasio - Node.js + PostgreSQL`
5. Deja marcado "Public" (o "Private" si prefieres)
6. ❌ NO marques "Add a README file" (ya tenemos uno)
7. ❌ NO agregues .gitignore (ya tenemos uno)
8. Haz clic en "Create repository"

## ✅ Paso 2: Conectar repositorio local con GitHub
Ejecuta estos comandos en PowerShell (ya estás en la carpeta backend):

```powershell
# Agregar el repositorio remoto (cambiar TU_USUARIO por tu usuario de GitHub)
git remote add origin https://github.com/TU_USUARIO/gym-backend.git

# Cambiar a la rama main (GitHub usa main por defecto)
git branch -M main

# Subir todo a GitHub
git push -u origin main
```

## ✅ Paso 3: Verificar que se subió correctamente
Ve a tu repositorio en GitHub y deberías ver:
- ✅ README.md con toda la documentación
- ✅ package.json con las dependencias
- ✅ server.js con el código del servidor
- ✅ database/ con los archivos SQL
- ✅ .env.example para configuración
- ✅ Dockerfile para despliegue
- ✅ .gitignore protegiendo archivos sensibles

## 🎯 Comandos completos (copia y pega):

```powershell
# 1. Ver el estado actual
git status

# 2. Agregar repositorio remoto (CAMBIAR TU_USUARIO)
git remote add origin https://github.com/TU_USUARIO/gym-backend.git

# 3. Cambiar a rama main
git branch -M main

# 4. Subir a GitHub
git push -u origin main
```

## 🔧 Para futuras actualizaciones:
Cuando hagas cambios al backend:

```powershell
# 1. Agregar cambios
git add .

# 2. Hacer commit
git commit -m "Descripción de los cambios"

# 3. Subir a GitHub
git push
```

## 🚀 Desplegar en tu servidor:
Una vez en GitHub, en tu servidor Linux ejecuta:

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/gym-backend.git
cd gym-backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
nano .env

# Iniciar con PM2
pm2 start server.js --name gym-backend
```

## 📝 Notas importantes:
- ✅ El archivo `.env` NO se sube a GitHub (está en .gitignore)
- ✅ Las imágenes en `uploads/` NO se suben (están en .gitignore)
- ✅ `node_modules/` NO se sube (está en .gitignore)
- ✅ El README.md tiene toda la documentación necesaria