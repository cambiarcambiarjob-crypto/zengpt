# React Bits en ZenGPT

Componentes copiados del registro oficial de [React Bits](https://reactbits.dev) (variante **TS + Tailwind**), sin reescribir su lógica.
Guía general de la interfaz: `docs/INTERFAZ.md`.

## Cómo se instala uno nuevo

```bash
curl -s https://reactbits.dev/r/<Nombre>-TS-TW.json   # → files[].content y dependencies
```

1. Guarda `files[0].content` tal cual en `resources/js/components/reactbits/<Nombre>.tsx`.
2. Si trae `dependencies`, instálalas con `npm install` **solo** si no rompen la regla de peso (ver abajo).
3. Anótalo en la tabla de este archivo: para qué se usa y si va con `lazy()`.
4. Colores: pásale siempre los de la marca en **hex** (los componentes con canvas leen el color con un lienzo; no entienden `var(--color-…)`):
   jade `#34d8a6`, jade claro `#6ee9c2`, jade hondo `#0f6f55`, azul de apoyo `#2b9bd6`, texto `#e8eeeb`, superficie `#0f1413`.

## Reglas de rendimiento

- **Fondos WebGL / canvas a pantalla completa → siempre `React.lazy()`** (o los envoltorios `FondoAurora` / `FondoHilos`, que ya lo hacen,
  esperan a que el navegador esté libre y dejan una versión fija con «reducir movimiento»).
- **Nada de `three`, `gsap` ni `ogl` en el arranque de una pantalla.** Por eso NO están instalados `SplitText`, `AnimatedContent`, `FadeContent`
  ni `TextType` (usan gsap) ni los fondos con three (`ColorBends`, etc.). Para entradas usa `<Aparecer>` (CSS puro, `components/ui/Aparecer.tsx`).
- La única librería de animación es **`motion`** (la usan `CountUp` y `BlurText`); viaja en el archivo de la pantalla que la importa, nunca en el login.
- Todos los instalados respetan `prefers-reduced-motion` por sí mismos y se pausan fuera de la vista; los fondos también con la pestaña oculta.
- Efectos que escuchan el cursor (`SpotlightCard`, `Magnet`): pocos por pantalla (tarjetas destacadas), nunca uno por fila de una lista.

## Instalados

| Componente | Dependencias | `lazy()` | Para qué | Dónde se usa ya |
| --- | --- | --- | --- | --- |
| `Aurora` | ninguna (WebGL2) | **Sí** | Fondo de aurora. Úsalo con `<FondoAurora />`. | Login |
| `Threads` | ninguna (WebGL2) | **Sí** | Hilos que ondulan, adorno de encabezados. Úsalo con `<FondoHilos />`. | — (recomendado: tarjeta principal del panel) |
| `ShinyText` | ninguna | No | Brillo que recorre un texto (marca, una cifra clave). | Marca en AppLayout y Login |
| `GradientText` | ninguna | No | Texto con degradado en movimiento para UNA palabra o frase por pantalla. | Titular del Login |
| `StarBorder` | ninguna (canvas 2D) | No | Luz que recorre el borde de un botón o tarjeta (una llamada a la acción por pantalla). | Tarjeta del Login |
| `SpotlightCard` | ninguna | No | Tarjeta con luz que sigue al cursor. Úsala con `<TarjetaFoco>`. | `ui/TarjetaFoco` |
| `ClickSpark` | ninguna (canvas 2D) | No | Chispas al hacer clic. | AppLayout (ya envuelve todo: no lo repitas) |
| `PillNav` | ninguna | No | Navegación de píldoras con indicador deslizante. Úsala con `<Pestanas>`. | `ui/Pestanas` |
| `Magnet` | ninguna | No | El contenido «sigue» un poco al cursor (botón principal de un estado vacío). | — |
| `CountUp` | `motion` | No | Conteo animado de números. Úsalo con `<Cifra>`. | `ui/Cifra` |
| `BlurText` | `motion` | No | Texto que entra desenfocado palabra por palabra (saludo o titular de una pantalla). | — (recomendado: saludo del panel) |
| `GlareHover` | ninguna | No | Destello que barre una tarjeta al pasar el cursor o al entrar en pantalla (una tarjeta destacada por pantalla). | Tarjeta de identidad del Perfil |

Único cambio respecto al registro: las etiquetas accesibles del menú plegado de `PillNav` están en español («Abrir menú» / «Cerrar menú»).

## Cómo importarlos

```tsx
// Ligeros (sin dependencias): import normal
import ShinyText from '@/components/reactbits/ShinyText';
import GradientText from '@/components/reactbits/GradientText';
import StarBorder from '@/components/reactbits/StarBorder';
import Magnet from '@/components/reactbits/Magnet';
import BlurText from '@/components/reactbits/BlurText'; // usa motion

// Con envoltorio del sistema (preferidos)
import { Cifra } from '@/components/ui/Cifra'; // CountUp
import { TarjetaFoco } from '@/components/ui/TarjetaFoco'; // SpotlightCard
import { Pestanas } from '@/components/ui/Pestanas'; // PillNav
import { FondoAurora } from '@/components/fondos/FondoAurora'; // Aurora (lazy)
import { FondoHilos } from '@/components/fondos/FondoHilos'; // Threads (lazy)
```

### Recetas con los colores de la marca

```tsx
// Marca o texto con brillo (cada 7 s, sin gasto entre brillos)
<ShinyText text="ZenGPT" color="#e8eeeb" shineColor="#34d8a6" speed={2.2} delay={7} className="font-titulo text-xl font-semibold" />

// Una frase con degradado
<GradientText colors={['#34d8a6', '#b4f5df', '#7fd4f5', '#34d8a6']} animationSpeed={7}>en calma.</GradientText>

// Saludo que entra desenfocado (una vez por pantalla, corto)
<BlurText text="Buenas tardes, Leo" animateBy="words" delay={60} className="font-titulo text-2xl font-semibold" />

// Llamada a la acción con luz en el borde (es un <button>; para envolver una tarjeta: as="div" + className="block! w-full p-0!")
<StarBorder color="#34d8a6" radius={10} duration={6} backgroundColor="#151b19" textColor="#e8eeeb" borderColor="rgb(255 255 255 / 0.09)">Agregar cuenta</StarBorder>

// Botón «magnético»
<Magnet padding={40} magnetStrength={3}><Boton variante="primario">Agregar cuenta</Boton></Magnet>

// Fondo propio con otro componente pesado: SIEMPRE así
const Fondo = lazy(() => import('@/components/reactbits/Aurora'));
<Suspense fallback={null}><Fondo colorStops={['#0f6f55', '#34d8a6', '#1f8fb8']} paused={reducido} /></Suspense>
```

## Evaluados y descartados

- `SplitText`, `AnimatedContent`, `FadeContent`, `TextType`: dependen de **gsap** (+ ScrollTrigger); una entrada no puede cargarse en diferido sin parpadeo → `<Aparecer>`.
- `AnimatedList`, `CardNav`: dependen de `@hugeicons/*`; las listas van con `<Tabla>` o listas propias + `<Aparecer indice={i}>`.
- `Dock`: pensado para cursor (magnificación); en celular la barra inferior de AppLayout es más cómoda y ligera.
- `Silk`, `DarkVeil`, `Beams`, `Galaxy`, `Particles`…: fondos válidos (WebGL sin dependencias), pero con un fondo de marca basta; si alguna pantalla necesita otro, va con `lazy()`.
