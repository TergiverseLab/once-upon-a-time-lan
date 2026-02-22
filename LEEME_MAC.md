# 📖 Once Upon a Time — Guía Mac

## Primera vez (en casa)

### 1. Instala Node.js
- Ve a https://nodejs.org
- Descarga la versión **LTS** para Mac
- Instálalo (siguiente, siguiente, siguiente...)

### 2. Descomprime el ZIP
- Doble clic en el ZIP descargado
- Mueve la carpeta `once-upon-a-time-lan` al Escritorio

### 3. Habilita los scripts
La primera vez, macOS puede bloquear los archivos .command.
Abre Terminal (Cmd+Espacio → escribe "Terminal") y ejecuta:

```
chmod +x ~/Escritorio/once-upon-a-time-lan/INSTALAR.command
chmod +x ~/Escritorio/once-upon-a-time-lan/JUGAR.command
```

### 4. Instala el juego
- Haz doble clic en `INSTALAR.command`
- Si macOS dice "no se puede abrir": clic derecho → Abrir → Abrir
- Espera a que termine (1-2 minutos)

### 5. Comprueba que funciona
- Haz doble clic en `JUGAR.command`
- Se abrirá el navegador en http://localhost:3000
- Deberías ver la pantalla de inicio del juego

---

## En clase

1. Conecta el Mac a la **misma WiFi** que los alumnos
2. Haz doble clic en `JUGAR.command`
3. El script muestra la dirección para los alumnos, algo como:
   ```
   ALUMNOS: http://192.168.1.45:3000
   ```
4. Escribe esa dirección en la pizarra
5. Los alumnos la abren en el navegador de su móvil/portátil

### Si no se conectan:
- **Firewall**: Ajustes del Sistema → Red → Firewall → desactivar temporalmente
- **Red diferente**: Asegúrate de que TODOS estáis en la misma WiFi
- **Puerto bloqueado**: Algunos routers escolares bloquean puertos. Prueba a crear un hotspot desde el Mac o un móvil

### Consejo: hotspot del móvil
Si la WiFi del cole da problemas, puedes:
1. Crear un punto de acceso WiFi desde tu móvil
2. Conectar el Mac y todos los alumnos a ese hotspot
3. Funciona igual (la IP será diferente, el script la detecta)

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| "command not found: node" | Instala Node.js desde nodejs.org |
| "no se puede abrir" al hacer doble clic | Clic derecho → Abrir → Abrir |
| Los alumnos no se conectan | Comprueba firewall y misma WiFi |
| Se desconecta un alumno | Que vuelva a entrar con el mismo nombre |
| Se cierra el Terminal | Se para el servidor, hay que volver a abrir JUGAR.command |
