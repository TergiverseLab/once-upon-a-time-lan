# 🌐 Once Upon a Time — Jugar ONLINE (gratis)

## Opción recomendada: Render.com

Render ofrece hosting gratuito para apps Node.js. Tu juego quedará en una URL pública tipo `https://once-upon-a-time-xxxx.onrender.com` a la que cualquiera puede acceder.

### Paso 1: Crea una cuenta en GitHub
- Ve a https://github.com y crea una cuenta (o usa la que tengas)

### Paso 2: Sube el proyecto a GitHub
1. Crea un repositorio nuevo: https://github.com/new
   - Nombre: `once-upon-a-time`
   - Privado o público, da igual
   - NO marques "Add README"
   - Clic en "Create repository"

2. GitHub te mostrará instrucciones. Ignóralas y simplemente **arrastra toda la carpeta** `once-upon-a-time-lan` al navegador (a la página del repo). GitHub te dejará subir archivos.

   **O desde Terminal** (más fiable):
   ```bash
   cd ~/Escritorio/once-upon-a-time-lan
   git init
   git add -A
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/once-upon-a-time.git
   git push -u origin main
   ```

### Paso 3: Despliega en Render
1. Ve a https://render.com y crea cuenta (puedes usar tu cuenta de GitHub)
2. Dashboard → **New +** → **Web Service**
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Name**: `once-upon-a-time` (o lo que quieras)
   - **Region**: Frankfurt (el más cercano a España)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Clic en **Create Web Service**
6. Espera 3-5 minutos a que compile y arranque
7. Render te dará una URL tipo: `https://once-upon-a-time-xxxx.onrender.com`

### Paso 4: ¡A jugar!
- Comparte la URL con tus alumnos
- Todos abren esa URL en su navegador
- Funciona desde cualquier dispositivo con internet
- No hace falta estar en la misma WiFi

### ⚠️ Limitaciones del plan gratuito de Render
- El servidor se **duerme** tras 15 min sin uso → la primera conexión tarda ~30s en despertar
- Eso significa que si nadie juega durante 15 min, la siguiente persona que entre esperará medio minuto
- Una vez despierto, funciona normal
- Las partidas NO se guardan si el servidor se duerme (hay que empezar una nueva)

### Consejo para clase
- Abre tú la URL 2-3 minutos antes de que entren los alumnos → así el servidor ya está despierto
- Mientras haya actividad, no se duerme

---

## Alternativa: Railway.app

Otra opción similar:
1. Ve a https://railway.app
2. New Project → Deploy from GitHub repo
3. Se configura automáticamente (detecta Node.js)
4. Plan gratuito: 500 horas/mes, suficiente para clase

---

## Alternativa rápida: ngrok (sin subir nada)

Si prefieres ejecutar el servidor en tu propio ordenador pero que los alumnos accedan desde internet:

1. Instala ngrok: https://ngrok.com (gratis, requiere cuenta)
2. En Terminal:
   ```bash
   cd ~/Escritorio/once-upon-a-time-lan/server
   node index.js &
   ngrok http 3000
   ```
3. ngrok te da una URL tipo `https://abc123.ngrok-free.app`
4. Comparte esa URL con los alumnos
5. Funciona mientras tengas el ordenador encendido y ngrok abierto

**Ventaja**: No hay que subir nada a ningún sitio
**Desventaja**: Depende de tu ordenador y tu conexión a internet
