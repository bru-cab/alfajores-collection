# 🆓 Despliegue 100% GRATIS - Sin Backend

## ✅ **Opción 1: GitHub Pages (Más simple)**

### Paso 1: Crear repositorio en GitHub
1. Ve a https://github.com y crea una cuenta
2. Clic en "New repository"
3. Nombre: `alfajores-collection`
4. ✅ Marcar "Public"
5. Clic en "Create repository"

### Paso 2: Subir archivos
1. Clic en "uploading an existing file"
2. Arrastra estos archivos:
   - `index.html`
   - `data.js`
3. Commit changes

### Paso 3: Activar GitHub Pages
1. Settings → Pages
2. Source: "Deploy from a branch"
3. Branch: "main"
4. Folder: "/ (root)"
5. Save

### Paso 4: ¡Listo!
Tu sitio estará en: `https://tu-usuario.github.io/alfajores-collection`

---

## ✅ **Opción 2: Netlify (Más profesional)**

1. Ve a https://netlify.com
2. Arrastra la carpeta completa
3. ¡Tu sitio estará listo en 30 segundos!

---

## ✅ **Opción 3: Vercel (Muy rápido)**

1. Ve a https://vercel.com
2. Sube la carpeta
3. Deploy automático

---

## 🖼️ **Para las imágenes (opcional)**

Si quieres mostrar las imágenes:

### Opción A: GitHub (Gratis)
1. Sube la carpeta `images/` a tu repositorio
2. En `data.js` cambia:
   ```javascript
   alfajor['image_url'] = 'https://tu-usuario.github.io/alfajores-collection/images/' + alfajor['image_filename'];
   ```

### Opción B: Imgur (Gratis)
1. Sube tus imágenes a https://imgur.com
2. Actualiza las URLs en `data.js`

### Opción C: Sin imágenes
¡La página funciona perfectamente sin imágenes, solo muestra el emoji 🍪!

---

## 🎯 **Ventajas de esta solución:**

- ✅ **100% Gratis** para siempre
- ✅ **Súper rápido** (no hay backend)
- ✅ **Confiable** (no se cae nunca)
- ✅ **Fácil de actualizar** (solo cambiar data.js)
- ✅ **HTTPS automático**
- ✅ **CDN global**

## 🔄 **Para actualizar los datos:**

1. Ejecuta en tu computadora:
   ```bash
   curl 'http://localhost:3000/api/alfajores?per_page=1000' > alfajores.json
   python3 generate_data.py
   ```
2. Sube el nuevo `data.js` a GitHub
3. ¡Se actualiza automáticamente!

---

## 🌍 **URL final:**
- GitHub Pages: `https://tu-usuario.github.io/alfajores-collection`
- Netlify: `https://random-name.netlify.app`
- Vercel: `https://alfajores-collection.vercel.app`

¡Tu colección estará disponible globalmente en 5 minutos! 🍪🚀
