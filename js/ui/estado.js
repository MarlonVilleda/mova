import { Almacen } from '../datos/almacen.js'
import { Bloqueo, detectarDispositivo } from '../datos/biometria.js'
import { SUPABASE_CLAVE, SUPABASE_URL } from '../datos/config.js'
import { textoFecha } from '../datos/formato.js'
import { Nube } from '../datos/nube.js'
import { persistencia } from '../datos/persistencia.js'

export const almacen = new Almacen(persistencia)
export const nube = new Nube({ almacen, persistencia, url: SUPABASE_URL, clave: SUPABASE_CLAVE })
export const bloqueo = new Bloqueo({ persistencia })
export const dispositivo = detectarDispositivo()
nube.infoDispositivo = () => ({ ...dispositivo, bloqueo: bloqueo.activo })

const oyentes = new Set()

export function suscribirInterfaz(oyente) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

export const refrescar = () => oyentes.forEach((o) => o())
nube.alCambiar = refrescar

/** Pantallas encima de las pestañas (formularios y detalles); usa el historial para que funcione «atrás». */
export const nav = {
  pila: [],
  pestana: 'inicio',
  dialogo: null,

  abrir(pantalla) {
    this.pila = [...this.pila, pantalla]
    history.pushState({ pantallas: this.pila.length }, '')
    refrescar()
  },

  /** Cierra de una vez: el historial retrocede con retraso y no debe demorar la pantalla. */
  cerrar() {
    if (this.pila.length === 0) return
    this.pila = this.pila.slice(0, -1)
    refrescar()
    history.back()
  },

  elegir(pestana) {
    this.pestana = pestana
    refrescar()
  },

  irA(pestana) {
    this.pestana = pestana
    const abiertas = this.pila.length
    this.pila = []
    refrescar()
    if (abiertas > 0) history.go(-abiertas)
  },

  alVolver(estado) {
    const n = Math.min(estado?.pantallas ?? 0, this.pila.length)
    this.pila = this.pila.slice(0, n)
    this.dialogo = null
    refrescar()
  },

  mostrar(dialogo) {
    this.dialogo = dialogo
    refrescar()
  },

  cerrarDialogo() {
    this.dialogo = null
    refrescar()
  },
}

export const avisar = (mensaje) => nav.mostrar({ tipo: 'aviso', mensaje })

export const confirmar = (titulo, mensaje, accion, alConfirmar) =>
  nav.mostrar({ tipo: 'confirmar', titulo, mensaje, accion, alConfirmar })

/** Marca un pago como hecho y dice cuándo toca el siguiente. */
export function marcarPagado(pago) {
  const siguiente = almacen.pagar(pago)
  if (siguiente) avisar(`Listo. El próximo pago de ${pago.nombre} es el ${textoFecha(siguiente)}.`)
}

/** Menú de acciones: lista de { texto, icono, peligro, accion }. */
export const mostrarMenu = (titulo, opciones) => nav.mostrar({ tipo: 'menu', titulo, opciones })
