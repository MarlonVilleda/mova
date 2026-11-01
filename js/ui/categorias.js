import { html, useState } from '../vendor/preact-htm.js'
import { Tonos, categoriasFijas, deIndice, iconosCategoria } from '../datos/modelos.js'
import { Limites, limpio, primerError } from '../datos/validacion.js'
import { C, Icono, MensajeError, Nota, Segmentos, SelectorColor, Simbolo, tono } from './componentes.js'
import { almacen, confirmar, nav } from './estado.js'
import { FilaBoton, FilaTexto, Hoja, SeccionForm, SelectorIcono, Separador } from './formularios.js'

const TIPOS = { gasto: 'Gastos', ingreso: 'Ingresos' }

export function Categorias({ alCerrar }) {
  const [tipo, setTipo] = useState('gasto')
  const claves = almacen.categoriasDe(tipo)
  const ocultas = almacen.categoriasOcultas(tipo)
  return html`<${Hoja} titulo="Categorías" alCerrar=${alCerrar} textoCerrar="Atrás">
    <${Segmentos} opciones=${Object.keys(TIPOS)} seleccion=${tipo} alCambiar=${setTipo} titulo=${(t) => TIPOS[t]} />
    <${SeccionForm}>
      ${claves.map((clave) => html`<${FilaCategoria} key=${clave} clave=${clave} />`)}
      <${FilaBoton} texto="Nueva categoría" alTocar=${() => nav.abrir({ tipo: 'FormCategoria', tipoCategoria: tipo })} simbolo="plus" />
    <//>
    ${ocultas.length > 0 && html`
      <${SeccionForm} titulo="Eliminadas" pie="Vuelve a mostrar una categoría de Mova cuando quieras.">
        ${ocultas.map((clave, i) => html`
          ${i > 0 && html`<${Separador} />`}
          <div class="fila" key=${clave}>
            <${Icono} s=${almacen.categoria(clave).icono} color=${C.secundario} lado=${36} />
            <span class="crece">${almacen.categoria(clave).nombre}</span>
            <button class="enlace" onClick=${() => almacen.restablecerCategoria(clave)}>Restaurar</button>
          </div>`)}
      <//>`}
  <//>`
}

function FilaCategoria({ clave }) {
  const categoria = almacen.categoria(clave)
  return html`
    <button class="fila" onClick=${() => nav.abrir({ tipo: 'FormCategoria', clave })}>
      <${Icono} s=${categoria.icono} color=${tono(categoria.tono)} lado=${36} />
      <span class="crece">${categoria.nombre}</span>
      <${Simbolo} s="chevron.right" tam=${18} color=${C.terciario} />
    </button>
    <${Separador} />`
}

export function FormCategoria({ clave, tipoCategoria, alCrear, alCerrar }) {
  const original = clave == null ? null : almacen.categoria(clave)
  const tipo = original?.tipo ?? tipoCategoria
  const [nombre, setNombre] = useState(original?.nombre ?? '')
  const [simbolo, setSimbolo] = useState(original?.icono ?? 'star')
  // Las categorías de Mova pueden tener un color fuera de los elegibles; -1 significa «dejarlo como está».
  const [color, setColor] = useState(() => original?.color ?? (original ? Tonos.elegibles.indexOf(original.tono) : 0))
  const colorVista = tono(color >= 0 ? deIndice(color) : original.tono)

  const nombreLimpio = limpio(nombre, Limites.nombreCategoria)
  const repetida = almacen.categoriasDe(tipo).some((c) => c !== clave && almacen.categoria(c).nombre.toLowerCase() === nombreLimpio.toLowerCase())
  const error = primerError(
    [!nombreLimpio, 'Ponle un nombre a la categoría.'],
    [repetida, 'Ya tienes una categoría con ese nombre.'],
  )

  const guardar = () => {
    const nueva = almacen.guardarCategoria({ clave, tipo, nombre, icono: simbolo, color: color >= 0 ? color : null })
    if (clave == null && nueva) alCrear?.(nueva)
  }
  const eliminar = () => {
    const mensaje = original.propia
      ? 'Lo que esté registrado en ella pasará a «Otros».'
      : 'Dejará de aparecer al elegir, pero tus movimientos la conservan. Puedes restaurarla después.'
    confirmar(`¿Eliminar ${original.nombre}?`, mensaje, 'Eliminar', () => {
      almacen.eliminarCategoria(clave)
      alCerrar()
    })
  }
  const restablecer = () => {
    almacen.restablecerCategoria(clave)
    alCerrar()
  }

  return html`<${Hoja} titulo=${original ? 'Editar categoría' : 'Nueva categoría'} alCerrar=${alCerrar} puedeGuardar=${error == null} alGuardar=${guardar}>
    <${SeccionForm} pie=${html`<${MensajeError} texto=${nombre ? error : null} />`}>
      <div class="fila-centro">
        <${Icono} s=${simbolo} color=${colorVista} lado=${48} />
        <div class="crece"><${FilaTexto} valor=${nombre} alCambiar=${setNombre} placeholder="Nombre de la categoría" maximo=${Limites.nombreCategoria} grande /></div>
      </div>
    <//>
    <${SeccionForm} titulo="Icono"><${SelectorIcono} iconos=${iconosCategoria} elegido=${simbolo} color=${colorVista} alCambiar=${setSimbolo} /><//>
    <${SeccionForm} titulo="Color"><${SelectorColor} indice=${color} alCambiar=${setColor} /><//>
    ${original && html`
      <${SeccionForm}>
        ${original.cambiada && html`
          <${FilaBoton} texto="Volver al original" alTocar=${restablecer} simbolo="arrow.counterclockwise" />
          <${Separador} />`}
        ${categoriasFijas.includes(clave)
          ? html`<div class="fila"><${Nota}>Esta categoría no se puede eliminar porque recibe lo que queda sin categoría.<//></div>`
          : html`<${FilaBoton} texto="Eliminar categoría" alTocar=${eliminar} color=${C.gasto} simbolo="trash" />`}
      <//>`}
  <//>`
}
