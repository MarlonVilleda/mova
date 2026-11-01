// Textos guardados por clave en IndexedDB, dentro del navegador.

let conexion = null

function abrir() {
  conexion ??= new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open('mova', 1)
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('archivos')
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => {
      conexion = null
      rechazar(pedido.error)
    }
  })
  return conexion
}

export const persistencia = {
  async leer(clave) {
    const db = await abrir()
    return new Promise((resolver, rechazar) => {
      const pedido = db.transaction('archivos').objectStore('archivos').get(clave)
      pedido.onsuccess = () => resolver(pedido.result)
      pedido.onerror = () => rechazar(pedido.error)
    })
  },

  /** Termina cuando el navegador confirmó la escritura. */
  async escribir(clave, contenido) {
    const db = await abrir()
    return new Promise((resolver, rechazar) => {
      const tx = db.transaction('archivos', 'readwrite')
      tx.objectStore('archivos').put(contenido, clave)
      tx.oncomplete = () => resolver()
      tx.onerror = () => rechazar(tx.error)
      tx.onabort = () => rechazar(tx.error)
    })
  },
}

/** Pide al navegador que no borre los datos cuando le falte espacio. */
export async function pedirAlmacenamientoPersistente() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Si no se concede, la app funciona igual; por eso existe el recordatorio de respaldo.
  }
}
