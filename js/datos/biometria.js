// Bloqueo con el desbloqueo del propio dispositivo (Face ID, huella, PIN, Windows Hello) usando WebAuthn.
// Es una llave por dispositivo: la primera entrada usa correo y contraseña; después basta el desbloqueo.

const CLAVE = 'bloqueo-credencial'
/** Tiempo fuera de la app antes de volver a pedir el desbloqueo. */
const GRACIA_MS = 60_000
/** Tiempo con la app abierta sin tocarla antes de bloquearla. */
const INACTIVIDAD_MS = 5 * 60_000

export class ErrorBloqueo extends Error {}

export function detectarDispositivo({ userAgent = '', maxTouchPoints = 0 } = globalThis.navigator ?? {}) {
  if (/iPhone|iPod/.test(userAgent)) return { plataforma: 'iphone', nombre: 'iPhone', metodo: 'Face ID o Touch ID' }
  // Safari en iPad se presenta como Mac; se distingue porque tiene pantalla táctil.
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) {
    return { plataforma: 'ipad', nombre: 'iPad', metodo: 'Face ID o Touch ID' }
  }
  if (/Android/.test(userAgent)) return { plataforma: 'android', nombre: 'Android', metodo: 'huella o PIN' }
  if (/Macintosh/.test(userAgent)) return { plataforma: 'mac', nombre: 'Mac', metodo: 'Touch ID' }
  if (/Windows/.test(userAgent)) return { plataforma: 'windows', nombre: 'Windows', metodo: 'Windows Hello' }
  return { plataforma: 'otro', nombre: 'Navegador', metodo: 'el desbloqueo del dispositivo' }
}

const aTexto = (bufer) => btoa(String.fromCharCode(...new Uint8Array(bufer)))
const aBytes = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0))
const azar = () => crypto.getRandomValues(new Uint8Array(32))

/** El bit 2 de las banderas indica que el dispositivo verificó a la persona, no solo su presencia. */
const verificoPersona = (datosAutenticador) => (new Uint8Array(datosAutenticador)[32] & 0x04) !== 0

export class Bloqueo {
  constructor({ persistencia, credenciales = globalThis.navigator?.credentials, ahora = () => Date.now() }) {
    Object.assign(this, { persistencia, credenciales, ahora })
    this.credencial = null
    this.disponible = false
    this.bloqueado = false
    this.ocultoDesde = null
    this.ultimaActividad = ahora()
  }

  get activo() {
    return this.credencial != null
  }

  async iniciar() {
    this.credencial = (await this.persistencia.leer(CLAVE)) || null
    this.bloqueado = this.activo
    try {
      this.disponible = await globalThis.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable() ?? false
    } catch {
      this.disponible = false
    }
  }

  async activar({ usuario, correo }) {
    const credencial = await this.pedir(() => this.credenciales.create({
      publicKey: {
        challenge: azar(),
        rp: { name: 'Mova' },
        user: { id: new TextEncoder().encode(usuario), name: correo, displayName: correo },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
        attestation: 'none',
        timeout: 60_000,
      },
    }))
    this.credencial = aTexto(credencial.rawId)
    await this.persistencia.escribir(CLAVE, this.credencial)
  }

  async verificar() {
    const respuesta = await this.pedir(() => this.credenciales.get({
      publicKey: {
        challenge: azar(),
        allowCredentials: [{ type: 'public-key', id: aBytes(this.credencial) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    }))
    if (!verificoPersona(respuesta.response.authenticatorData)) throw new ErrorBloqueo('No se pudo verificar que seas tú.')
  }

  async pedir(accion) {
    try {
      const resultado = await accion()
      if (!resultado) throw new Error('vacío')
      return resultado
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'AbortError') throw new ErrorBloqueo('Se canceló o no se reconoció. Intenta de nuevo.')
      throw new ErrorBloqueo('Este dispositivo no pudo usar el desbloqueo. Prueba con tu contraseña.')
    }
  }

  async desbloquear() {
    await this.verificar()
    this.bloqueado = false
    this.marcarActividad()
  }

  /** Quitar el bloqueo también exige confirmar. */
  async desactivar() {
    await this.verificar()
    await this.olvidar()
  }

  /** Quita la llave sin verificar: al cerrar sesión o después de entrar con la contraseña. */
  async olvidar() {
    this.credencial = null
    this.bloqueado = false
    await this.persistencia.escribir(CLAVE, '')
  }

  alOcultar() {
    this.ocultoDesde = this.ahora()
  }

  marcarActividad() {
    this.ultimaActividad = this.ahora()
  }

  /** Devuelve true si se acaba de bloquear por llevar tiempo abierta sin usarse. */
  revisarInactividad() {
    if (!this.activo || this.bloqueado || this.ahora() - this.ultimaActividad < INACTIVIDAD_MS) return false
    this.bloqueado = true
    return true
  }

  /** Devuelve true si la app debe bloquearse al volver. */
  alMostrar() {
    const vencio = this.activo && this.ocultoDesde != null && this.ahora() - this.ocultoDesde >= GRACIA_MS
    this.ocultoDesde = null
    if (vencio) this.bloqueado = true
    return vencio
  }
}
