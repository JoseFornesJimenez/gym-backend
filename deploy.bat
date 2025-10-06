@echo off
echo 🏋️ Desplegando Gym Backend...

REM Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Node.js no está instalado
    echo Descargalo desde https://nodejs.org/
    pause
    exit /b 1
)

REM Verificar npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: npm no está instalado
    pause
    exit /b 1
)

echo ✅ Node.js y npm encontrados

REM Instalar dependencias
echo 📦 Instalando dependencias...
npm install
if %errorlevel% neq 0 (
    echo ❌ Error instalando dependencias
    pause
    exit /b 1
)
echo ✅ Dependencias instaladas

REM Verificar archivo .env
if not exist .env (
    echo ⚠️ Archivo .env no encontrado. Copiando desde .env.example...
    copy .env.example .env
    echo ⚠️ IMPORTANTE: Edita el archivo .env con tus configuraciones
    echo Abre .env en un editor de texto y configura tu base de datos
    pause
    exit /b 0
)

REM Crear directorios
if not exist "public\images" mkdir "public\images"
if not exist "uploads" mkdir "uploads"
echo ✅ Directorios creados

REM Verificar PM2
pm2 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 🚀 Iniciando con PM2...
    pm2 start server.js --name gym-backend
    pm2 save
    echo ✅ Aplicación iniciada con PM2
    echo Ver logs: pm2 logs gym-backend
    echo Reiniciar: pm2 restart gym-backend
    echo Parar: pm2 stop gym-backend
) else (
    echo 🚀 PM2 no encontrado. Iniciando con Node.js...
    echo Para producción, instala PM2: npm install -g pm2
    echo Iniciando servidor...
    npm start
)

echo 🎉 Despliegue completado!
echo Servidor disponible en: http://localhost:3001
pause