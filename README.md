# Mova Web

Versión web de Mova, instalable en el teléfono (PWA). Funciona sin internet y sin cuenta: los datos se guardan
en el navegador. Con una cuenta se sincronizan por Supabase entre dispositivos; las tablas se crean con
`supabase/esquema.sql` y la conexión está en `js/datos/config.js`. Si dos dispositivos cambian lo mismo sin
conexión, `js/datos/combinar.js` junta los cambios registro por registro. Los respaldos JSON son compatibles con
iPhone y Android.

No necesita compilar: la carpeta completa se publica tal cual en cualquier alojamiento con HTTPS.

## Probar en esta PC

```bash
npx serve .
```

## Pruebas

```bash
node --test "pruebas/*.test.mjs"
```

## Instalar en iPhone

1. Abre la dirección publicada en Safari.
2. Toca Compartir y elige «Agregar a pantalla de inicio».
3. Abre Mova desde el nuevo icono y restaura tu respaldo desde Ajustes.

La app instalada guarda sus datos aparte de Safari, por eso el respaldo se restaura después de instalarla.

## Diferencias con Android

No tiene recordatorios ni widgets, porque en una página sin servidor no se pueden hacer igual. Esos ajustes se
conservan en los respaldos. En su lugar, Inicio recuerda guardar un respaldo cada semana si no hay cuenta.

El bloqueo con Face ID, huella o PIN (WebAuthn) se activa por dispositivo en Ajustes y necesita HTTPS. La tabla
`mova_dispositivos` se crea con `supabase/dispositivos.sql`.

Las suscripciones y los pagos fijos son recordatorios: marcarlos como pagados solo avanza la fecha, no descuenta
dinero ni crea un movimiento.

Las categorías propias y los cambios a las categorías de Mova solo existen en la web. Para que el respaldo siga
abriendo en iPhone y Android, cada registro guarda también una categoría normal («Otros») y aparte
`categoriaPropia`, que esas versiones ignoran.

Las cuentas no se suman: Inicio muestra cada una por separado. Una deuda puede asociarse a una cuenta y una
tarjeta puede tener límite; con eso `disponibleEn` calcula lo libre sin cambiar el saldo. Esos campos (`cuentaID`,
`limite`) solo existen en la web.

## Seguridad

- Reglas por usuario en Supabase (`supabase/*.sql`) y clave publicable en el cliente.
- Política de contenido en `index.html`, sin scripts externos ni de terceros.
- Bloqueo por dispositivo al salir un minuto o tras cinco sin usarla; exportar, restaurar y borrar piden confirmar.

Los datos del navegador no van cifrados. Si se agrega una dirección de Supabase distinta, actualizar `connect-src`.

## Al agregar un archivo

Agrégalo también a la lista `ARCHIVOS` de `sw.js`, para que funcione sin internet.

## Librerías incluidas

- `js/vendor/preact-htm.js`: htm 3.1.1 con Preact (licencia Apache 2.0 / MIT).
- `js/ui/trazos.js`: iconos de Lucide 0.460.0 (licencia ISC).
