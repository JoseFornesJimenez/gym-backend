#!/bin/bash

# 🚀 Script de despliegue automático para Gym Backend
# Ejecutar como: ./deploy.sh

echo "🏋️ Desplegando Gym Backend..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para mostrar errores
error() {
    echo -e "${RED}❌ Error: $1${NC}"
    exit 1
}

# Función para mostrar éxito
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Función para mostrar advertencias
warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# 1. Verificar que Node.js está instalado
if ! command -v node &> /dev/null; then
    error "Node.js no está instalado. Instálalo desde https://nodejs.org/"
fi

# 2. Verificar que npm está instalado
if ! command -v npm &> /dev/null; then
    error "npm no está instalado"
fi

# 3. Verificar que PostgreSQL está disponible
if ! command -v psql &> /dev/null; then
    warning "psql no encontrado. Asegúrate de que PostgreSQL esté instalado"
fi

# 4. Instalar dependencias
echo "📦 Instalando dependencias..."
npm install || error "Failed to install dependencies"
success "Dependencias instaladas"

# 5. Verificar archivo .env
if [ ! -f .env ]; then
    warning "Archivo .env no encontrado. Copiando desde .env.example..."
    cp .env.example .env
    warning "IMPORTANTE: Edita el archivo .env con tus configuraciones antes de continuar"
    echo "Ejecuta: nano .env"
    exit 0
fi

# 6. Verificar configuración de base de datos
echo "🗄️ Verificando conexión a la base de datos..."
source .env
if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    error "Variables de base de datos no configuradas en .env"
fi

# 7. Crear directorio de imágenes si no existe
mkdir -p public/images
mkdir -p uploads
success "Directorios creados"

# 8. Iniciar aplicación con PM2 si está disponible
if command -v pm2 &> /dev/null; then
    echo "🚀 Iniciando con PM2..."
    pm2 start server.js --name gym-backend
    pm2 save
    success "Aplicación iniciada con PM2"
    echo "Ver logs: pm2 logs gym-backend"
    echo "Reiniciar: pm2 restart gym-backend"
    echo "Parar: pm2 stop gym-backend"
else
    echo "🚀 PM2 no encontrado. Iniciando con Node.js..."
    warning "Para producción, se recomienda instalar PM2: npm install -g pm2"
    echo "Iniciando servidor..."
    npm start
fi

success "🎉 Despliegue completado!"
echo "Servidor disponible en: http://localhost:${PORT:-3001}"