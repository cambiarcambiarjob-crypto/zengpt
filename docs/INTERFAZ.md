# Interfaz de ZenGPT · guía para construir pantallas

Todo lo necesario para hacer una pantalla nueva sin leer el código base. Dirección visual: **«tinta y jade»** — oscuro, sobrio,
un solo acento de marca (jade), números protagonistas. Español de México en todos los textos.

- Tokens y estilos base: `resources/css/app.css`
- Piezas base: `resources/js/components/ui/*`
- React Bits (y cuáles van con `lazy()`): `resources/js/components/reactbits/LEEME.md`
- Fondos animados listos: `resources/js/components/fondos/*`
- Utilidades: `resources/js/lib/*`
- Estructura con sesión: `resources/js/layouts/AppLayout.tsx`
- Ejemplos reales: `resources/js/pages/Auth/Login.tsx` (formulario) y `resources/js/pages/Dashboard.tsx` (provisional: layout + cifras + tabla)

## 1. Plantilla de una pantalla

```tsx
// resources/js/pages/Cuentas/Index.tsx
import { Plus } from 'lucide-react';
import { Boton } from '@/components/ui/Boton';
import { Tarjeta } from '@/components/ui/Tarjeta';
import AppLayout from '@/layouts/AppLayout';
import { plural } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { CuentasProps } from '@/types';

export default function CuentasIndex() {
    const { cuentas, filtros, vendedores, negocio, auth } = usePagina<CuentasProps>(); // props de la pantalla + compartidas, tipadas

    return (
        <AppLayout titulo="Cuentas" descripcion={plural(cuentas.length, 'cuenta')} acciones={<Boton variante="primario" icono={<Plus className="size-4" />}>Nueva cuenta</Boton>}>
            <Tarjeta titulo="…">…</Tarjeta>
        </AppLayout>
    );
}
```

### Firma de `AppLayout` (export default)

```ts
interface AppLayoutProps {
    titulo: string;                           // <h1> + título de la pestaña («Cuentas · ZenGPT»); no pongas <Head> aparte
    descripcion?: ReactNode;                  // línea de apoyo bajo el título
    acciones?: ReactNode;                     // botones/filtros a la derecha del título (en celular bajan a su propia fila)
    ancho?: 'estrecho' | 'normal' | 'ancho';  // 42rem (formularios, perfil) · 72rem (por defecto) · 96rem (tablas grandes)
    children: ReactNode;
}
```

Lo que el layout ya hace (no lo repitas en la pantalla): barra lateral en escritorio (≥ 1024 px) con Panel `/`, Cuentas `/cuentas`,
Día `/dia`, Reportes `/reportes`, Vendedores `/vendedores` (solo `auth.user.is_admin`), Perfil `/perfil` y Cerrar sesión (POST `/logout`);
en celular/tableta, barra superior con marca y usuario + barra inferior (Panel, Cuentas, Día, Reportes, Más); usuario y rol visibles
(«Administrador» / «Socio»); **avisos flash** (`<Avisos />`); enlace «Saltar al contenido»; chispas de `ClickSpark`; deja libre el espacio
de la barra inferior. El contenido vive en su propio contexto de apilamiento: un `z-10` de tu pantalla nunca tapa las barras.
Si fijas algo con `sticky`, en celular hay una barra superior de 56 px: usa `top-14 lg:top-0`.

## 2. Tokens (Tailwind 4, `@theme` en `resources/css/app.css`)

Usa **solo** estas utilidades de color (no `zinc-*`, `slate-*`, `purple-*`…). Admiten opacidad: `bg-acento/10`, `border-peligro/40`.

| Token | Utilidades | Valor | Uso |
| --- | --- | --- | --- |
| fondo | `bg-fondo` | `#090c0b` | Fondo de la página |
| superficie | `bg-superficie` | `#0f1413` | Tarjetas, modales, barras |
| superficie-2 | `bg-superficie-2` | `#151b19` | Campos, hover de filas, botón secundario |
| superficie-3 | `bg-superficie-3` | `#1c2422` | Elemento activo/presionado, pistas vacías |
| borde | `border-borde` | `#222b28` | Borde por defecto y divisores (`divide-borde`) |
| borde-fuerte | `border-borde-fuerte` | `#33403b` | Bordes de controles |
| texto | `text-texto` | `#e8eeeb` | Texto principal (16.7:1) |
| suave | `text-suave` | `#a4b1ac` | Texto secundario, etiquetas (8.8:1) |
| tenue | `text-tenue` | `#7f8d88` | Texto terciario, ayudas, iconos apagados (≥ 4.5:1 en todas las superficies) |
| acento | `bg-acento` `text-acento` | `#34d8a6` | Marca: acción principal, activo, espacios ocupados |
| acento-fuerte | `bg-acento-fuerte` | `#6ee9c2` | Hover del acento |
| acento-hondo | `bg-acento-hondo` | `#0f6f55` | Jade profundo (degradados) |
| sobre-acento | `text-sobre-acento` | `#03140e` | Texto encima de `bg-acento` |
| exito / alerta / peligro / info | `text-exito`… | `#5fd47a` `#f2b84b` `#f26d6d` `#70b7f2` | Activa · por vencer · vencida/borrar/negativo · informativo |

- **Radios:** `rounded-campo` (10 px: botones, campos), `rounded-tarjeta` (16 px), `rounded-panel` (22 px: modales), `rounded-full` (insignias).
- **Sombras:** `shadow-tarjeta`, `shadow-flotante` (modales, avisos), `shadow-brillo` (resplandor jade).
- **Tipografía** (servida por npm, nada de CDN): `font-sans` = Geist (interfaz y números), `font-titulo` = Sora (los `h1`–`h3` ya la usan; aplícala a cifras grandes y marca), `font-mono`.
  Tamaño base 15 px. Jerarquía habitual: título de pantalla `text-2xl sm:text-[1.75rem]` (lo pone el layout) · título de tarjeta `text-base font-semibold` · cuerpo `text-sm` · apoyo `text-[13px] text-suave` · rótulos de tabla `text-[11px] uppercase tracking-wider text-tenue`.
- **Números:** toda cifra (dinero, conteos, fechas en columnas) lleva la utilidad **`cifras`** (tabulares). `Cifra`, `Tabla` con `numerica` y `BarraEspacios` ya la aplican.
- **Movimiento:** `animate-entrada` (sube + aparece, 0.5 s), `animate-aparecer` (opacidad), `animate-emerger` (modales), `animate-enfocar` (desenfoque, titulares), `ease-suave`.
  Solo `opacity`/`transform`/`filter`: cero saltos de layout. Con `prefers-reduced-motion` todo se apaga solo (regla global en `app.css`).
- **Otras utilidades:** `fondo-rejilla` (rejilla tenue decorativa), `pb-seguro` (área segura inferior del celular).
- **Foco:** contorno jade de 2 px global con `:focus-visible`; no lo quites (`outline-none` solo en controles que ya pintan su propio foco, como `Campo`).
- **Puntos de corte:** celular < 640 (`sm`) · tableta < 1024 (`lg`) · escritorio ≥ 1024 (aparece la barra lateral). Diseña primero 1440×900 y comprueba 390×844.
- **Iconos:** `lucide-react` (`import { Plus } from 'lucide-react'`), tamaño `size-4` en botones y `size-5` en estados vacíos; decorativos con `aria-hidden="true"`.

## 3. Utilidades (`resources/js/lib`)

### `formato.ts` — dinero y fechas

El dinero llega en **centavos** y se muestra con `dinero()`; los formularios mandan **pesos**.

| Función | Ejemplo |
| --- | --- |
| `dinero(centavos, { mxn?, signo?, decimales? })` | `dinero(125000)` → `$1,250` · `dinero(125050)` → `$1,250.50` · `dinero(-35000)` → `−$350` · `{ mxn: true }` → `$1,250 MXN` (solo en totales/encabezados) |
| `pesos(centavos)` | `pesos(20000)` → `'200'` · `pesos(20050)` → `'200.50'` · `pesos(0)` → `''` (valor inicial de un campo al editar) |
| `numero(n)` · `porcentaje(n)` · `plural(n, 'venta')` | `1,234` · `10%` · `3 ventas` / `1 venta` (`plural(2, 'vendedor', 'vendedores')`) |
| `fechaLarga(iso, { anio? })` | `fechaLarga('2026-11-16')` → `lunes 16 de noviembre` |
| `fechaCorta(iso, { anio? })` | `16 nov` (añade el año solo si no es el actual: `16 nov 2025`) |
| `fechaMedia(iso)` · `mesLargo(iso)` | `16 de noviembre de 2026` · `noviembre de 2026` |
| `rangoFechas(desde, hasta)` | `1 – 16 nov` · `28 oct – 16 nov` |
| `fechaRelativa(iso, negocio.hoy)` | `hoy` · `ayer` · `mañana` · `12 nov` |
| `diasRestantes(cuenta.dias_restantes)` | `vence en 12 días` · `vence mañana` · `vence hoy` · `venció ayer` · `venció hace 4 días` |
| `diasEnPalabras(n)` · `diasRestantesCorto(n)` | `en 5 días` / `hace 3 días` · `12 días` / `hoy` / `vencida` |
| `sumarDias(iso, n)` · `diasEntre(a, b)` · `aFecha(iso)` · `aIso(date)` | aritmética de fechas sin corrimientos de zona horaria |
| `iniciales(nombre)` · `aNumeroPesos(texto)` | `JP` · `'1,250.50'` → `1250.5` |

Las fechas del servidor son texto `AAAA-MM-DD`: **nunca** `new Date('2026-11-16')` (se recorre un día); usa `aFecha()`. «Hoy» es `negocio.hoy`, no el reloj del navegador.

### Otras

- `cn(...clases)` (`lib/cn.ts`): une clases condicionales. No resuelve conflictos: para pisar una clase de un componente usa `!` (`p-0!`).
- `usePagina<T>()` y `useUsuario()` (`lib/pagina.ts`): props tipadas (`auth`, `flash`, `negocio` + las de la pantalla).
- `useMovimientoReducido()`, `usePestanaVisible()`, `useCuandoLibre()` (`lib/movimiento.ts`): para animaciones propias (versión fija, pausa, montar lo decorativo después).

## 4. Componentes (`resources/js/components/ui`)

Todos son exportaciones con nombre: `import { Boton } from '@/components/ui/Boton'`. Todos aceptan `className`.

### `Boton` · `EnlaceBoton` · `Cargador` · `estilosBoton()`

```ts
<Boton variante="primario|secundario|peligro|fantasma" tamano="sm|md|lg" cargando icono={…} iconoFinal={…} anchoCompleto soloIcono {...button} />
```

`secundario` y `md` por defecto; `type="button"` por defecto (en formularios: `type="submit"`). `cargando` (= `form.processing`) deshabilita y muestra el
indicador **sin cambiar el ancho**. Un solo `primario` por vista. `soloIcono` exige `aria-label`. `EnlaceBoton` = mismo aspecto con `<Link>` de Inertia (`href`, `method`…).

### `Campo` · `CampoArea` · `EnvolturaCampo`

```ts
<Campo etiqueta="Gmail del cliente" type="email" value={form.data.client_email} onChange={(e) => form.setData('client_email', e.target.value)}
       error={form.errors.client_email} ayuda="…" opcional prefijo="$" sufijo={…} ocultarEtiqueta claseContenedor="sm:col-span-2" ref={…} {...input} />
```

Etiqueta real (`<label for>`), error con `role="alert"` **junto al campo**, `aria-invalid` y `aria-describedby` automáticos. `className` va al `<input>`;
`claseContenedor` al bloque completo. `CampoArea` = textarea con las mismas props. `EnvolturaCampo` (`id`, `etiqueta`, `error`, `ayuda`) sirve para controles propios.
Fechas: `<Campo type="date" max={negocio.hoy} />` (el servidor acepta hasta mañana).

### `Selector`

```ts
<Selector etiqueta="Vendedor" value={form.data.seller_id} onChange={(e) => form.setData('seller_id', e.target.value)}
          opciones={vendedores.map((v) => ({ valor: v.id, etiqueta: v.name }))} marcador="Elige un vendedor…" error={form.errors.seller_id} />
```

`<select>` nativo con el aspecto del sistema. `opciones: { valor, etiqueta, deshabilitada? }[]` o `<option>` como children.

### `SelectorPrecio`

```ts
<SelectorPrecio valor={form.data.price} alCambiar={(pesos) => form.setData('price', pesos)} precios={negocio.precios} error={form.errors.price} etiqueta="Precio" />
```

Botones `$200 / $400 / $500` + «Otro» (abre un campo numérico). `valor` y `alCambiar` trabajan en **pesos como texto** (`'400'`, `'350.50'`, `''`): justo lo que espera el
campo `price`. Al editar un espacio: `price: pesos(espacio.price_cents)`.

### `Modal`

```ts
<Modal abierto={abierto} alCerrar={() => setAbierto(false)} titulo="Nueva cuenta" descripcion="…" tamano="sm|md|lg|xl"
       alEnviar={enviar} bloqueado={form.processing} pie={<>…botones…</>}>…campos…</Modal>
```

Accesible: `role="dialog"`, foco atrapado, **Esc** y clic fuera cierran, devuelve el foco al botón que lo abrió, bloquea el desplazamiento del fondo; hoja inferior en celular.
Con `alEnviar` el modal es un `<form>` y un `<Boton type="submit">` en `pie` lo envía. `bloqueado` impide cerrarlo mientras guarda. Foco inicial: el elemento con
`data-autofocus` o el primer campo. Se pueden apilar (`Confirmar` encima de un `Modal`).

### `Confirmar`

```ts
<Confirmar abierto={porBorrar !== null} titulo="¿Eliminar la cuenta?" textoConfirmar="Eliminar" variante="peligro|primario" cargando={borrando}
           alCancelar={() => setPorBorrar(null)} alConfirmar={() => router.delete(`/cuentas/${porBorrar!.id}`, { preserveScroll: true, onStart…, onFinish… })}>
    Se eliminará {porBorrar?.email} con todos sus clientes.
</Confirmar>
```

Obligatorio antes de cualquier borrado. El foco inicial queda en «Cancelar».

### `Tarjeta` · `TarjetaFoco`

```ts
<Tarjeta titulo="Ventas de hoy" descripcion="…" acciones={…} relleno="normal|compacto|ninguno" como="section|div|article|aside" interactiva>…</Tarjeta>
<TarjetaFoco titulo? relleno? color="#34d8a6" intensidad={0.1}>…</TarjetaFoco>   // SpotlightCard de React Bits: luz que sigue al cursor
```

`relleno="ninguno"` para meter una `<Tabla sinMarco>` a sangre (el encabezado conserva su relleno). `TarjetaFoco` solo para lo destacado (2–4 por pantalla).

### `Cifra`

```ts
<Cifra etiqueta="Ventas de hoy" valor={hoy.ventas} formato="dinero|numero|porcentaje" detalle={plural(hoy.ventas_count, 'venta')}
       tono="normal|acento|exito|alerta|peligro|suave" tamano="sm|md|lg|xl" icono={…} negativoEnRojo animar />
```

Número grande con conteo animado (`CountUp` de React Bits). Con `formato="dinero"` (por defecto) `valor` va en **centavos**. El lector de pantalla lee el valor final; con «reducir movimiento» no cuenta.

### `Insignia` · `InsigniaCuenta` · `estadoDeCuenta()`

```ts
<Insignia estado="activa|por_vencer|vencida|libre|ocupado|neutral|acento|info" tamano="sm|md" sinPunto>Texto opcional</Insignia>
<InsigniaCuenta cuenta={cuenta} detalle />   // «Activa» · «Vence en 5 días» · «Vence hoy» · «Venció hace 3 días»
```

Sin children muestra el texto del estado («Activa», «Por vencer», «Vencida», «Libre», «Ocupado»). El significado nunca depende solo del color.

### `BarraEspacios`

```ts
<BarraEspacios ocupados={cuenta.ocupados} capacidad={cuenta.capacidad} tamano="sm|md|lg" conTexto />   // ●●●○○ 3/5
```

### `Tabla`

```ts
<Tabla titulo="Ventas del día" filas={ventas} clave={(v) => v.id} densa sinMarco claseFila={(v) => …} vacio={<EstadoVacio compacto titulo="Sin ventas todavía" />}
       columnas={[
           { clave: 'cliente', titulo: 'Cliente', celda: (v) => v.client_email },
           { clave: 'vendedor', titulo: 'Vendedor', celda: (v) => v.seller_name, ocultar: 'movil' },          // 'movil' < 640 px · 'tableta' < 1024 px
           { clave: 'precio', titulo: 'Precio', numerica: true, celda: (v) => dinero(v.price_cents), pie: dinero(total) },
       ]} />
```

`<th scope="col">` reales, `<caption>` oculto (`titulo`), `<tfoot>` si alguna columna trae `pie`, desplazamiento horizontal propio en celular. `Columna<T>`: `clave`, `titulo`, `celda`, `pie?`, `alinear?`, `numerica?`, `ocultar?`, `clase?`.
En celular, si la tabla tiene muchas columnas, considera una lista de tarjetas (`sm:hidden`) + tabla (`hidden sm:block`).

### `Pestanas`

```ts
<Pestanas etiqueta="Estado de las cuentas" activa={filtros.estado} tamano="sm|md" opciones={[
    { valor: 'activas', etiqueta: 'Activas', href: '/cuentas?estado=activas' }, …   // con href navega (Inertia, conserva estado y desplazamiento)
]} />
<Pestanas etiqueta="Vista" activa={vista} alCambiar={setVista} opciones={[{ valor: 'dia', etiqueta: 'Día' }, …]} />   // sin href: estado local
```

Filtros y vistas con la píldora deslizante de `PillNav` (React Bits).

### `EstadoVacio`

```ts
<EstadoVacio icono={<Inbox className="size-5" />} titulo="Aún no hay cuentas" descripcion="Agrega la primera para empezar a vender." accion={<Boton variante="primario">Agregar cuenta</Boton>} compacto />
```

### `Avisos` · `avisar`

`AppLayout` ya monta `<Avisos />`: muestra `props.flash.success` / `props.flash.error` y los retira solos (éxito 4.5 s, error 8 s). **No pintes el flash en tu pantalla.**
Para avisos del cliente: `avisar.exito('Correo copiado')` / `avisar.error('…')`.

### `Aparecer`

```ts
<Aparecer indice={i} efecto="entrada|aparecer|enfocar" retraso={ms} como="div|li|section|span">…</Aparecer>
```

Entrada con CSS puro. En listas, `indice` escalona 40 ms por elemento (tope 8): los datos nunca esperan a la animación.

### `Marca` · `Emblema`

Emblema = anillo de 5 segmentos (los 5 espacios de una cuenta). `<Emblema className="size-8" />`, `<Marca tamano="md|lg" />`.

### Fondos (`resources/js/components/fondos`)

```ts
<FondoAurora colores={['#0f6f55', '#34d8a6', '#1f8fb8']} alto={0.44} opacidad={0.8} className="-z-10" />   // dentro de un contenedor `relative isolate`
<FondoHilos color="#34d8a6" opacidad={0.55} hilos={22} />                                                  // dentro de `relative overflow-hidden`
```

Ambos cargan su WebGL con `lazy()` cuando el navegador está libre, tienen versión fija con «reducir movimiento» y se pausan con la pestaña oculta.

## 5. Convenciones

### Navegación y rutas

`Link`, `router` y `useForm` de `@inertiajs/react`, con **URLs literales**: `/cuentas`, `/cuentas?estado=vencidas&q=ana`, `/dia/2026-11-16`, `/reportes?desde=2026-11-01&hasta=2026-11-16`.
Para filtros: `router.get('/cuentas', { estado, q }, { preserveState: true, preserveScroll: true, replace: true })`.

### Formularios

```tsx
const form = useForm({ client_email: '', client_phone: '', price: '', seller_id: '', sold_on: negocio.hoy });

const enviar = (e: FormEvent) => {
    e.preventDefault();
    form.post(`/cuentas/${cuenta.id}/espacios`, {
        preserveScroll: true,
        onSuccess: () => { form.reset(); setAbierto(false); },   // el aviso «Cliente agregado al espacio.» sale solo
    });
};
```

- Cada error de validación va **junto a su campo** (`error={form.errors.campo}`); nunca en una lista arriba.
- Los errores que el servidor manda como flash (`props.flash.error`, p. ej. «La cuenta ya tiene sus 5 espacios ocupados.») los muestra `Avisos`.
- El botón de enviar lleva `cargando={form.processing}`; el modal, `bloqueado={form.processing}`.
- Dinero en formularios: **pesos** (`price`; `gastos[seller_id]` en la publicidad). Para precargar: `pesos(centavos)`.
- Al abrir un modal para editar, carga los datos con `form.setData({...})` y limpia con `form.clearErrors()`.

### Modales

Estado local (`const [abierto, setAbierto] = useState(false)`) o el registro a editar (`useState<Cuenta | null>(null)` → `abierto={cuenta !== null}`).
Un modal por tarea (crear/editar). Borrar siempre pasa por `Confirmar`.

### Permisos en pantalla

`auth.user.is_admin` decide lo que solo ve/edita el administrador (Vendedores, publicidad, fecha de vencimiento manual, borrar cuentas con clientes).
En el Día usa `puedeEditarPublicidad`. El servidor valida de todos modos: la interfaz solo evita ofrecer lo que no se puede.

### Rendimiento y accesibilidad (obligatorio)

- Lo pesado (fondos WebGL/canvas a pantalla completa, cualquier `three`/`gsap`/`ogl`) entra con `React.lazy()`; ver `reactbits/LEEME.md`.
- Las animaciones no tapan ni retrasan datos: duran ≤ 0.6 s, usan `opacity`/`transform` y no reservan ni mueven espacio.
- Texto AA (usa los tokens), foco visible, `label` real en cada control, tablas con encabezados, modales navegables con teclado, iconos decorativos con `aria-hidden`.
- Objetivos táctiles ≥ 40 px en celular (los componentes ya lo cumplen).

## 6. Demo local

```bash
export DB_DATABASE=/ruta/a/zg-demo.sqlite && touch "$DB_DATABASE"
php artisan migrate --seed --force            # esquema + catálogo de vendedores
php artisan db:seed --class=DemoSeeder --force  # usuarios, 14 cuentas, 49 espacios y publicidad (solo desarrollo)
npm run build
php artisan serve --port=8101                 # http://127.0.0.1:8101/login
```

Usuarios de demo: `leo` (administrador) y `christian` (socio), contraseña `demo-zengpt-2026`. El `DemoSeeder` no se ejecuta en producción ni se llama desde `DatabaseSeeder`.
