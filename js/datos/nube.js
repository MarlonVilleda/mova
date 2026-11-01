import { canonico, combinar, iguales } from './combinar.js'
import { nuevoId } from './modelos.js'

const CLAVE_SESION = 'nube-sesion'
const CLAVE_BASE = 'nube-base'
const CLAVE_DISPOSITIVO = 'nube-dispositivo'

const MENSAJES = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Primero confirma tu correo con el enlace que te enviamos.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  weak_password: 'Usa una contraseña más segura, de al menos 8 caracteres.',
  validation_failed: 'Revisa que el correo esté bien escrito.',
  over_email_send_rate_limit: 'Se enviaron demasiados correos. Espera un momento.',
  over_request_rate_limit: 'Demasiados intentos. Espera un momento.',
}

export class ErrorNube extends Error {}

/** ¿Este dispositivo todavía no tiene nada propio? Entonces se usa lo de la cuenta tal cual. */
export function estaSinUsar(d) {
  const vacio = (lista) => (lista ?? []).length === 0
  return vacio(d.movimientos) && vacio(d.deudas) && vacio(d.metas) && vacio(d.pagosFijos) && vacio(d.sobres)
    && vacio(d.categoriasPropias) && (d.cuentas ?? []).length <= 1 && (d.cuentas ?? []).every((c) => c.saldoInicial === 0)
}

/** Cuenta de Supabase y sincronización del documento de Mova. La app sigue funcionando sin cuenta y sin internet. */
export class Nube {
  constructor({ almacen, persistencia, url, clave, pedir = (...a) => fetch(...a) }) {
    Object.assign(this, { almacen, persistencia, url, clave, pedir })
    this.sesion = null
    this.base = null
    this.sincronizando = false
    this.ultimaSincronizacion = null
    this.error = null
    this.alCambiar = () => {}
    this.enCurso = null
    this.repetir = false
    this.temporizador = null
    this.dispositivoId = null
    this.dispositivoAnotado = false
    /** Datos de este dispositivo para la tabla `mova_dispositivos`. */
    this.infoDispositivo = () => ({ nombre: 'Navegador', plataforma: 'otro', metodo: '', bloqueo: false })
  }

  async iniciar() {
    const sesion = await this.persistencia.leer(CLAVE_SESION)
    const base = await this.persistencia.leer(CLAVE_BASE)
    this.sesion = sesion ? JSON.parse(sesion) : null
    this.base = base ? JSON.parse(base) : null
    this.alCambiar()
  }

  // MARK: Cuenta

  async pedirAuth(ruta, cuerpo, token, metodo = 'POST') {
    let r
    try {
      r = await this.pedir(`${this.url}/auth/v1/${ruta}`, {
        method: metodo,
        headers: { apikey: this.clave, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(cuerpo),
      })
    } catch {
      throw new ErrorNube('No hay conexión. Revisa tu internet.')
    }
    const datos = await r.json().catch(() => ({}))
    if (!r.ok) throw Object.assign(new ErrorNube(MENSAJES[datos.error_code] ?? datos.msg ?? 'No se pudo completar. Intenta de nuevo.'), { estado: r.status })
    return datos
  }

  async guardarSesion(d) {
    this.sesion = {
      access_token: d.access_token, refresh_token: d.refresh_token,
      expira: Date.now() + d.expires_in * 1000, correo: d.user.email, usuario: d.user.id,
    }
    await this.persistencia.escribir(CLAVE_SESION, JSON.stringify(this.sesion))
  }

  async entrar(correo, contrasena) {
    await this.guardarSesion(await this.pedirAuth('token?grant_type=password', { email: correo, password: contrasena }))
    this.alCambiar()
    await this.sincronizar()
  }

  /** Devuelve false si la cuenta debe confirmarse por correo antes de entrar. */
  async registrar(correo, contrasena) {
    const d = await this.pedirAuth('signup', { email: correo, password: contrasena })
    if (!d.access_token) return false
    await this.guardarSesion(d)
    this.alCambiar()
    await this.sincronizar()
    return true
  }

  recuperar(correo) {
    return this.pedirAuth('recover', { email: correo })
  }

  /** `token` es el que llega en el enlace del correo para recuperar la contraseña. */
  cambiarContrasena(token, contrasena) {
    return this.pedirAuth('user', { password: contrasena }, token, 'PUT')
  }

  /** Sube lo pendiente antes de cerrar: los datos de este dispositivo se borran y quedan solo en la cuenta. */
  async salir() {
    if (!(await this.sincronizar())) throw new ErrorNube('No se pudo sincronizar. Conéctate a internet para no perder cambios.')
    await this.pedirAuth('logout', {}, this.sesion.access_token).catch(() => {})
    await this.olvidarSesion()
    await this.almacen.reiniciar()
    this.alCambiar()
  }

  async olvidarSesion() {
    this.sesion = null
    this.base = null
    this.ultimaSincronizacion = null
    this.dispositivoAnotado = false
    await this.persistencia.escribir(CLAVE_SESION, '')
    await this.persistencia.escribir(CLAVE_BASE, '')
  }

  async token() {
    if (Date.now() < this.sesion.expira - 60_000) return this.sesion.access_token
    try {
      await this.guardarSesion(await this.pedirAuth('token?grant_type=refresh_token', { refresh_token: this.sesion.refresh_token }))
    } catch (e) {
      if (e.estado === 400 || e.estado === 401) {
        await this.olvidarSesion()
        throw new ErrorNube('Tu sesión venció. Entra de nuevo para sincronizar.')
      }
      throw e
    }
    return this.sesion.access_token
  }

  // MARK: Dispositivos

  /** Anota este dispositivo en la cuenta. Es informativo: si falla, nada más se detiene. */
  async anotarDispositivo() {
    if (!this.sesion) return
    try {
      let id = await this.persistencia.leer(CLAVE_DISPOSITIVO)
      if (!id) {
        id = nuevoId()
        await this.persistencia.escribir(CLAVE_DISPOSITIVO, id)
      }
      this.dispositivoId = id
      await this.pedirDatos('?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id, ...this.infoDispositivo(), ultimo_acceso: new Date().toISOString() }),
      }, 'mova_dispositivos')
    } catch {
      // Se vuelve a intentar la próxima vez que se abra la app.
    }
  }

  async dispositivos() {
    const r = await this.pedirDatos('?select=*&order=ultimo_acceso.desc', {}, 'mova_dispositivos')
    if (!r.ok) throw new ErrorNube('No se pudo leer la lista de dispositivos.')
    return r.json()
  }

  /** Cierra la sesión en todos los demás dispositivos desde el servidor; este sigue conectado. */
  async cerrarOtrosDispositivos() {
    await this.pedirAuth('logout?scope=others', {}, await this.token())
    await this.pedirDatos(`?id=neq.${this.dispositivoId}`, { method: 'DELETE' }, 'mova_dispositivos')
  }

  // MARK: Datos

  async pedirDatos(consulta, opciones = {}, tabla = 'mova_datos') {
    const token = await this.token()
    let r
    try {
      r = await this.pedir(`${this.url}/rest/v1/${tabla}${consulta}`, {
        ...opciones,
        headers: {
          apikey: this.clave, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
          Prefer: 'return=representation', ...opciones.headers,
        },
      })
    } catch {
      throw new ErrorNube('Sin conexión. Tus cambios se subirán al volver el internet.')
    }
    return r
  }

  async leerFila() {
    const r = await this.pedirDatos(`?select=contenido,version&user_id=eq.${this.sesion.usuario}`)
    if (!r.ok) throw new ErrorNube('No se pudieron leer tus datos de la nube.')
    return (await r.json())[0] ?? null
  }

  async recordarBase(version, contenido) {
    this.base = { version, contenido }
    await this.persistencia.escribir(CLAVE_BASE, JSON.stringify(this.base))
  }

  /** Un paso de sincronización. Devuelve false si otro dispositivo escribió mientras tanto y hay que repetir. */
  async paso() {
    const { almacen } = this
    await almacen.guardarAhora()
    const instantanea = almacen.datos
    const local = JSON.parse(almacen.exportarRespaldo())
    const fila = await this.leerFila()

    if (!fila) {
      const r = await this.pedirDatos('', { method: 'POST', body: JSON.stringify({ user_id: this.sesion.usuario, contenido: local, version: 1 }) })
      if (r.status === 409) return false
      if (!r.ok) throw new ErrorNube('No se pudieron subir tus datos.')
      await this.recordarBase(1, local)
      return true
    }

    const alDia = this.base?.version === fila.version
    if (alDia && iguales(local, this.base.contenido)) return true
    let final = local
    if (!alDia) final = estaSinUsar(local) ? fila.contenido : combinar(this.base?.contenido, local, fila.contenido)

    // Si se editó algo mientras llegaba la respuesta, se vuelve a empezar para no pisarlo.
    if (almacen.datos !== instantanea) return false
    if (!iguales(final, local)) {
      almacen.aplicarRemoto(JSON.stringify(final))
      final = JSON.parse(almacen.exportarRespaldo())
    }
    if (iguales(final, fila.contenido)) {
      await this.recordarBase(fila.version, final)
      return true
    }

    const nueva = fila.version + 1
    const r = await this.pedirDatos(`?user_id=eq.${this.sesion.usuario}&version=eq.${fila.version}`, {
      method: 'PATCH', body: JSON.stringify({ contenido: final, version: nueva, actualizado: new Date().toISOString() }),
    })
    if (!r.ok) throw new ErrorNube('No se pudieron subir tus datos.')
    if ((await r.json()).length === 0) return false
    await this.recordarBase(nueva, final)
    return true
  }

  /** Devuelve true si todo quedó igual en este dispositivo y en la nube. */
  async sincronizar() {
    if (!this.sesion || this.almacen.soloLectura) return false
    if (this.enCurso) {
      this.repetir = true
      return this.enCurso
    }
    this.enCurso = this.ciclo().finally(() => {
      this.enCurso = null
      if (this.repetir) {
        this.repetir = false
        this.sincronizar()
      }
    })
    return this.enCurso
  }

  async ciclo() {
    this.sincronizando = true
    this.alCambiar()
    let listo = false
    try {
      if (!this.dispositivoAnotado) {
        this.dispositivoAnotado = true
        await this.anotarDispositivo()
      }
      for (let i = 0; i < 4 && !listo; i++) listo = await this.paso()
      this.error = listo ? null : 'Hubo cambios al mismo tiempo. Intenta de nuevo.'
      if (listo) this.ultimaSincronizacion = Date.now()
    } catch (e) {
      this.error = e instanceof ErrorNube ? e.message : 'No se pudo sincronizar.'
    }
    this.sincronizando = false
    this.alCambiar()
    return listo
  }

  /** Después de guardar: sube los cambios cuando se termine de escribir. */
  alGuardar() {
    if (!this.sesion) return
    if (this.base && canonico(JSON.parse(this.almacen.exportarRespaldo())) === canonico(this.base.contenido)) return
    clearTimeout(this.temporizador)
    this.temporizador = setTimeout(() => this.sincronizar(), 1500)
  }
}
