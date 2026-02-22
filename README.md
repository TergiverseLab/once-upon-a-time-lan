# 🏰 Once Upon a Time — Multijugador LAN

Juego narrativo en tiempo real. Cada jugador juega desde su propio dispositivo.

---

## Instalación rápida

### Requisito: Node.js
Descárgalo de **https://nodejs.org** (botón LTS verde). Instálalo como cualquier programa.

### Windows
1. Haz doble clic en **`INSTALAR.bat`** — espera a que termine
2. Haz doble clic en **`JUGAR.bat`** — se abre el navegador automáticamente

### Mac / Linux
```bash
chmod +x instalar.sh jugar.sh
./instalar.sh
./jugar.sh
```

¡Eso es todo! El navegador se abrirá solo con el juego.

---

## Cómo jugar con otros

1. Ejecuta **JUGAR.bat** (Windows) o **./jugar.sh** (Mac)
2. La terminal muestra una dirección IP como `http://192.168.1.42:3000`
3. Los demás jugadores abren esa URL en su móvil/portátil (misma red Wi-Fi)
4. Crea una sala, comparte el código, y a jugar

---

## Mecánicas del juego

- **5 conceptos secretos** + **1 final secreto** por jugador
- **Solo el narrador escribe** — los demás ven en tiempo real
- **Arrastra concepto → palabra** del texto para integrar (votación 15s)
- **Selecciona frase → suelta concepto** para vincular fragmentos largos
- **Interrumpir**: si el narrador menciona tu concepto, reclámalo (votación)
- **Interrupción fallida**: pierdes concepto + robas 2
- **Pasar turno**: descartas 1 concepto, robas 1 nuevo
- **Veto colectivo**: si el narrador desvaría, los demás pueden vetarlo
- **10 segundos de inactividad** = pierdes turno (barra visible)
- **Final**: integra todos tus conceptos → escribe cierre → ejecuta final → votación

---

## Modo proyector

Para mostrar en pantalla grande sin revelar manos:
1. Abre la URL del servidor
2. Selecciona **Proyector** e introduce el código de sala

---

## Para volver a jugar otro día

Solo necesitas ejecutar **JUGAR.bat** o **./jugar.sh**. No hace falta reinstalar.
