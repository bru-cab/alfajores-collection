# 🚀 Despliegue del Buscador de Alfajores

## Paso 1: Desplegar Backend en Railway

1. **Ve a** https://railway.app y crea una cuenta
2. **Haz clic en** "New Project" → "Deploy from GitHub repo"
3. **Sube la carpeta `backend/`** con estos archivos:
   - `app.py`
   - `requirements.txt`
   - `runtime.txt`
   - `Procfile`
   - `alfajores.db` (tu base de datos)
   - `images/` (carpeta con las imágenes)

4. **Railway detectará Flask automáticamente**
5. **Espera el despliegue** (~2-3 minutos)
6. **Copia la URL** que te da Railway (ejemplo: `https://tu-app.up.railway.app`)

## Paso 2: Configurar Frontend

1. **Edita `index.html`** en la línea 218:
   ```javascript
   // Cambia esto:
   const API_BASE = 'https://YOUR-RAILWAY-APP.up.railway.app/api';
   
   // Por tu URL real:
   const API_BASE = 'https://tu-app-real.up.railway.app/api';
   ```

## Paso 3: Desplegar Frontend en Netlify

1. **Ve a** https://netlify.com
2. **Arrastra la carpeta `deploy/`** completa al área de "Deploy"
3. **¡Listo!** Tu sitio estará en `https://tu-sitio.netlify.app`

## 🎯 URLs Finales

- **Frontend (Buscador)**: https://tu-sitio.netlify.app
- **Backend (API)**: https://tu-app.railway.app

## ✅ Verificación

1. Visita tu sitio en Netlify
2. Deberías ver el contador de alfajores
3. La búsqueda debería funcionar
4. Las imágenes deberían cargar

## 🔧 Si algo no funciona

- Verifica que la URL del API esté correcta
- Revisa la consola del navegador (F12)
- Asegúrate de que Railway esté funcionando visitando `tu-url.railway.app/api/health`

¡Tu buscador de alfajores estará disponible globalmente! 🍪🌍
