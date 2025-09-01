# 🚀 Guía de Despliegue - Buscador de Alfajores

## Opción 1: Netlify (Recomendado - Gratis)

### Paso 1: Preparar el backend
1. Tu backend debe estar funcionando y accesible desde internet
2. Opciones para el backend:
   - **Railway.app** (gratis): https://railway.app
   - **Render.com** (gratis): https://render.com
   - **Heroku** (gratis limitado): https://heroku.com

### Paso 2: Actualizar la URL del API
En `search.html`, cambia esta línea:
```javascript
const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api'
    : 'https://TU-BACKEND-URL.com/api'; // ← Cambia esto por tu URL real
```

### Paso 3: Desplegar en Netlify
1. Ve a https://netlify.com
2. Arrastra la carpeta completa a Netlify Drop
3. O conecta tu repositorio de GitHub
4. ¡Listo! Tu sitio estará en https://tu-sitio.netlify.app

## Opción 2: Vercel (Gratis)

### Paso 1: Instalar Vercel CLI
```bash
npm i -g vercel
```

### Paso 2: Desplegar
```bash
cd /Users/bruno/Documents/alfajores
vercel --prod
```

## Opción 3: GitHub Pages

### Paso 1: Crear repositorio
1. Crea un repo en GitHub
2. Sube solo estos archivos:
   - `search.html`
   - `netlify.toml` (opcional)

### Paso 2: Activar GitHub Pages
1. Settings → Pages
2. Source: Deploy from branch
3. Branch: main
4. Folder: / (root)

## ⚙️ Backend en Railway (Gratis)

### Para desplegar tu backend Flask:

1. **Crear cuenta en Railway**: https://railway.app
2. **Conectar GitHub** o subir archivos
3. **Configurar variables**:
   ```
   PORT=3000
   FLASK_ENV=production
   ```
4. **Railway detectará Flask automáticamente**
5. **Tu API estará en**: https://tu-app.railway.app

### Archivos necesarios para Railway:
- `requirements.txt` ✅ (ya lo tienes)
- `runtime.txt` (opcional):
  ```
  python-3.10.13
  ```

## 🎯 URLs Finales

Una vez desplegado tendrás:
- **Frontend**: https://tu-buscador.netlify.app
- **Backend**: https://tu-api.railway.app
- **Búsqueda inteligente**: ✅ Funciona
- **Grid infinito**: ✅ 4 columnas
- **Contador**: ✅ Alfajores únicos

## 🔧 Configuración Final

Recuerda actualizar en `search.html`:
```javascript
const API_BASE = 'https://tu-api-real.railway.app/api';
```

¡Y listo! Tendrás tu buscador de alfajores público y gratis 🍪
