/**
 * Entrega un archivo al usuario. En el teléfono usa la hoja de compartir (desde ahí se elige
 * «Guardar en Archivos» o Drive), porque una PWA instalada en iPhone no descarga enlaces bien.
 * Devuelve false si el usuario canceló.
 */
export async function entregarArchivo(nombre, contenido, tipo) {
  const archivo = new File([contenido], nombre, { type: tipo })
  if (navigator.maxTouchPoints > 0 && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo] })
      return true
    } catch (e) {
      if (e.name === 'AbortError') return false
      // Si compartir falla, se intenta la descarga normal.
    }
  }
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}

/** Abre el selector de archivos; termina con el archivo elegido, o null si se canceló. */
export function elegirArchivo() {
  return new Promise((resolver) => {
    const entrada = document.createElement('input')
    entrada.type = 'file'
    entrada.onchange = () => resolver(entrada.files[0] ?? null)
    entrada.oncancel = () => resolver(null)
    entrada.click()
  })
}

export const estaInstalada = () =>
  globalThis.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
