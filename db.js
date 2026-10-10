// db.js — Acceso a IndexedDB (la base de datos que vive dentro del navegador del teléfono).
// Todas las funciones devuelven promesas para poder usarlas con async/await.

const DB_NOMBRE = 'mi-entreno';
const DB_VERSION = 1;

// Nombres de los "almacenes" (equivalentes a tablas).
const ALMACENES = {
  ajustes: 'clave',   // pares clave/valor: fechaInicio, estaturaCm, tema...
  plan: 'dia',        // un registro por día de rutina: "A" y "B"
  sesiones: 'id',     // cada entrenamiento guardado
  reportes: 'id',     // reportes de bioimpedancia
  pesajes: 'id',      // pesos semanales opcionales
};

let conexion = null;

// Abre (o crea) la base de datos. Solo se abre una vez.
function abrirDB() {
  if (conexion) return Promise.resolve(conexion);
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(DB_NOMBRE, DB_VERSION);
    // Se ejecuta la primera vez (o al subir DB_VERSION): crea los almacenes.
    peticion.onupgradeneeded = () => {
      const db = peticion.result;
      for (const [nombre, clave] of Object.entries(ALMACENES)) {
        if (!db.objectStoreNames.contains(nombre)) {
          db.createObjectStore(nombre, { keyPath: clave });
        }
      }
    };
    peticion.onsuccess = () => { conexion = peticion.result; resolver(conexion); };
    peticion.onerror = () => rechazar(peticion.error);
  });
}

// Ayudante: ejecuta una operación sobre un almacén y espera a que termine.
async function operar(almacen, modo, accion) {
  const db = await abrirDB();
  return new Promise((resolver, rechazar) => {
    const tx = db.transaction(almacen, modo);
    const store = tx.objectStore(almacen);
    const peticion = accion(store);
    tx.oncomplete = () => resolver(peticion ? peticion.result : undefined);
    tx.onerror = () => rechazar(tx.error);
    tx.onabort = () => rechazar(tx.error);
  });
}

const DB = {
  // Lee todos los registros de un almacén.
  todos: (almacen) => operar(almacen, 'readonly', (s) => s.getAll()),
  // Lee un registro por su clave.
  obtener: (almacen, clave) => operar(almacen, 'readonly', (s) => s.get(clave)),
  // Guarda (crea o reemplaza) un registro.
  guardar: (almacen, valor) => operar(almacen, 'readwrite', (s) => s.put(valor)),
  // Borra un registro por su clave.
  borrar: (almacen, clave) => operar(almacen, 'readwrite', (s) => s.delete(clave)),

  // Atajos para la tabla de ajustes (clave/valor).
  async leerAjuste(clave, porDefecto = null) {
    const fila = await DB.obtener('ajustes', clave);
    return fila ? fila.valor : porDefecto;
  },
  guardarAjuste: (clave, valor) => DB.guardar('ajustes', { clave, valor }),

  // Devuelve un objeto con TODOS los datos (para el respaldo JSON).
  async exportar() {
    const datos = { app: 'mi-entreno', version: DB_VERSION, exportadoEl: new Date().toISOString() };
    for (const nombre of Object.keys(ALMACENES)) datos[nombre] = await DB.todos(nombre);
    return datos;
  },

  // Reemplaza TODOS los datos por los del respaldo. Se hace en una sola
  // transacción: si algo falla, no se borra nada.
  async importar(datos) {
    if (!datos || datos.app !== 'mi-entreno') throw new Error('El archivo no es un respaldo de Mi Entreno.');
    const db = await abrirDB();
    const nombres = Object.keys(ALMACENES);
    return new Promise((resolver, rechazar) => {
      const tx = db.transaction(nombres, 'readwrite');
      for (const nombre of nombres) {
        const store = tx.objectStore(nombre);
        store.clear();
        for (const fila of datos[nombre] || []) store.put(fila);
      }
      tx.oncomplete = () => resolver();
      tx.onerror = () => rechazar(tx.error);
      tx.onabort = () => rechazar(tx.error || new Error('Importación cancelada.'));
    });
  },
};
