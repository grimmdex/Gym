# Mi Entreno

App web instalable (PWA) en español para registrar mi entrenamiento en el gimnasio y mis reportes de bioimpedancia.

- **Sin servidor y sin cuentas.** Todos los datos se guardan solo en el teléfono (IndexedDB).
- **Funciona sin internet** después de abrirla una vez.
- **Solo registra y muestra datos.** No da consejos médicos ni nutricionales.

## Qué incluye

| Pantalla | Para qué sirve |
|---|---|
| **Hoy** | Qué toca según el calendario (Día A, Día B, caminar o libre), próximos 7 días y botón para iniciar la sesión. |
| **Sesión** | Registrar kg y repeticiones (o segundos) de cada serie. Muestra lo que hiciste la última vez y avisa cuándo toca subir peso según tu regla. |
| **Mi plan** | Ver y editar los ejercicios de los días A y B: cambiar, sustituir, agregar, quitar, reordenar o restaurar el plan original. |
| **Progreso** | Gráfica por ejercicio (peso máximo o volumen) e historial de sesiones. |
| **Cuerpo** | Reportes de bioimpedancia con la diferencia contra el anterior, gráficas de peso, % de grasa, grasa visceral y masa muscular, y peso semanal opcional. |
| **Ajustes** | Tema claro u oscuro, fecha de inicio del plan, estatura, y exportar o importar el respaldo JSON. |

**Calendario:**
- Semana 1: Lun A, Mié B, Vie A.
- Semana 2: Lun B, Mié A, Vie B.
- Sábado y domingo: caminar.
- La Semana 1 empieza por defecto el lunes 12/10/2026. Se cambia en Ajustes.

**Regla de progresión:** si la última vez completaste *todas* las series en el máximo del rango, la app muestra "toca subir el peso y volver al mínimo". No sugiere cuántos kg subir.

## Archivos

```
index.html            Estructura de la página y barra de navegación
styles.css            Diseño (modo claro y oscuro)
app.js                Pantallas, calendario, regla de progresión, respaldo
db.js                 Guardar y leer datos en IndexedDB
graficas.js           Gráficas SVG hechas a mano (sin librerías)
sw.js                 Service worker: copia la app para usarla sin internet
manifest.webmanifest  Nombre e íconos para instalar la app
icons/                Íconos de la app
```

No hay que instalar nada ni compilar nada: son archivos estáticos.

---

## Paso a paso

### 1. Probarla en tu computadora (opcional)

Necesitas Python. Ya viene en Mac y Linux; en Windows se descarga de python.org.

1. Abre una terminal dentro de la carpeta del proyecto.
2. Ejecuta:
   ```
   python3 -m http.server 8000
   ```
   En Windows puede ser `python -m http.server 8000`.
3. Abre en el navegador: <http://localhost:8000>
4. Para detenerla, presiona `Ctrl + C` en la terminal.

> Abrir `index.html` con doble clic **no funciona bien**: el modo sin internet necesita que la página se sirva desde un servidor (aunque sea local).

### 2. Publicarla gratis con GitHub Pages (necesario para instalarla en el teléfono)

Para instalar una PWA en el teléfono, la página debe abrirse con **https**. GitHub Pages lo da gratis y solo entrega los archivos: tus datos nunca se suben.

1. Asegúrate de que los archivos estén en la rama `main` del repositorio (cuando aceptes el pull request ya estarán).
2. En GitHub, entra a tu repositorio → **Settings** → **Pages**.
3. En **Build and deployment** → **Source**, elige **Deploy from a branch**.
4. En **Branch**, elige `main` y la carpeta `/ (root)`. Pulsa **Save**.
5. Espera 1–2 minutos y recarga esa página. Arriba aparecerá la dirección, algo como:
   `https://TU-USUARIO.github.io/Gym/`

> Si tu repositorio es privado, GitHub Pages puede requerir un plan de pago. Si no aparece la opción, la alternativa es hacer el repositorio público. El código quedará visible, pero tus datos no, porque viven solo en tu teléfono.

### 3. Instalarla en el teléfono

Abre la dirección de GitHub Pages **con internet** la primera vez.

**iPhone (Safari):**
1. Abre la dirección en **Safari**. Otros navegadores en iPhone pueden no ofrecer la opción.
2. Toca el botón **Compartir** (el cuadro con la flecha hacia arriba).
3. Elige **Agregar a pantalla de inicio** → **Agregar**.
4. Abre la app desde el ícono nuevo.

**Android (Chrome):**
1. Abre la dirección en **Chrome**.
2. Toca el menú **⋮** (arriba a la derecha).
3. Elige **Instalar app** o **Agregar a pantalla principal**.
4. Abre la app desde el ícono nuevo.

Después de esto la app abre sin internet.

### 4. Respaldar tus datos

Los datos viven **solo en el teléfono**. Si borras la app o los datos del navegador, se pierden.

- En **Ajustes → Exportar JSON** se genera un archivo con todo. Guárdalo en Drive, en tu correo o en Archivos.
- La app te recuerda hacer un respaldo si pasan 14 días sin hacerlo.
- Para recuperar los datos (por ejemplo, en un teléfono nuevo): **Ajustes → Importar JSON**. Esto **reemplaza** todos los datos actuales.

### 5. Hacer cambios al código

1. Edita los archivos y súbelos a `main`.
2. Abre `sw.js` y sube el número de versión (por ejemplo `mi-entreno-v1` → `mi-entreno-v2`). Si no lo haces, el teléfono seguirá mostrando la copia vieja.
3. Abre la app con internet y luego ciérrala y vuelve a abrirla para ver la versión nueva.

Tus datos no se borran al actualizar la app.

## Datos guardados (IndexedDB)

| Almacén | Contenido |
|---|---|
| `ajustes` | `fechaInicio`, `estaturaCm`, `tema`, `ultimoRespaldo`, y la sesión en curso (`borrador`) |
| `plan` | `{ dia: "A" o "B", ejercicios: [{ id, nombre, series, repMin, repMax, unidad }] }` |
| `sesiones` | `{ id, fecha, dia, calentamiento, cardioMin, notas, series: [{ ejercicioId, nombre, unidad, serie, kg, reps }] }` |
| `reportes` | `{ id, fecha, peso, masaGrasa, pctGrasa, masaLibreGrasa, masaMuscular, agua, imc, visceral, tmb }` |
| `pesajes` | `{ id, fecha, kg }` |

El primer reporte (10/10/2026) viene precargado la primera vez que abres la app.
