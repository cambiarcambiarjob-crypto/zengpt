import { Head, Link, usePage } from '@inertiajs/react';
import { Bot, CalendarDays, ChartColumn, CircleUserRound, Ellipsis, Layers, LayoutDashboard, LogOut, Users, Wallet, type LucideIcon } from 'lucide-react';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { useSerpiente } from '@/components/easter/useSerpiente';
import ClickSpark from '@/components/reactbits/ClickSpark';
import ShinyText from '@/components/reactbits/ShinyText';
import { Avisos } from '@/components/ui/Avisos';
import { Emblema } from '@/components/ui/Marca';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { fechaLarga, iniciales } from '@/lib/formato';
import type { Compartido, Usuario } from '@/types';

// Easter eggs: solo se descargan si alguien los activa.
const Serpiente = lazy(() => import('@/components/easter/Serpiente'));
const ArenaZombies = lazy(() => import('@/components/easter/arena/ArenaZombies'));
const MenuJuegos = lazy(() => import('@/components/easter/MenuJuegos'));

interface Destino {
    href: string;
    etiqueta: string;
    icono: LucideIcon;
    /** Solo coincide con la ruta exacta (el Panel vive en «/»). */
    exacto?: boolean;
    soloAdmin?: boolean;
    /** En celular va dentro de «Más» en lugar de la barra inferior. */
    secundario?: boolean;
}

const DESTINOS: Destino[] = [
    { href: '/', etiqueta: 'Panel', icono: LayoutDashboard, exacto: true },
    { href: '/cuentas', etiqueta: 'Cuentas', icono: Layers },
    { href: '/dia', etiqueta: 'Día', icono: CalendarDays },
    { href: '/reportes', etiqueta: 'Reportes', icono: ChartColumn },
    { href: '/corte', etiqueta: 'Corte', icono: Wallet },
    { href: '/chatgpt', etiqueta: 'ChatGPT', icono: Bot, secundario: true },
    { href: '/vendedores', etiqueta: 'Vendedores', icono: Users, soloAdmin: true, secundario: true },
    { href: '/perfil', etiqueta: 'Perfil', icono: CircleUserRound, secundario: true },
];

const ANCHOS = { estrecho: 'max-w-2xl', normal: 'max-w-6xl', ancho: 'max-w-[96rem]' } as const;

export interface AppLayoutProps {
    /** Título de la pantalla: se pinta como <h1> y también va a la pestaña del navegador («Cuentas · ZenGPT»). */
    titulo: string;
    /** Línea de apoyo bajo el título (fecha, conteo, explicación breve). */
    descripcion?: ReactNode;
    /** Botones o filtros a la derecha del título (en celular bajan a una fila propia). */
    acciones?: ReactNode;
    /** Ancho máximo del contenido: estrecho (formularios, perfil) · normal (por defecto) · ancho (tablas grandes). */
    ancho?: keyof typeof ANCHOS;
    children: ReactNode;
}

function rolDe(usuario: Usuario): string {
    return usuario.is_admin ? 'Administrador' : 'Socio';
}

function estaActivo(destino: Destino, ruta: string): boolean {
    return destino.exacto ? ruta === destino.href : ruta === destino.href || ruta.startsWith(`${destino.href}/`);
}

function Avatar({ usuario, className }: { usuario: Usuario; className?: string }) {
    return (
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full border border-acento/35 bg-acento/12 font-titulo text-[13px] font-semibold text-acento', className)} aria-hidden="true">
            {iniciales(usuario.name)}
        </span>
    );
}

/**
 * Estructura común de las pantallas con sesión: barra lateral (escritorio), barra superior + inferior (celular),
 * avisos flash y encabezado con título y acciones.
 *
 *   export default function Cuentas() {
 *       return (
 *           <AppLayout titulo="Cuentas" descripcion="14 cuentas activas" acciones={<Boton variante="primario">Nueva cuenta</Boton>}>
 *               …
 *           </AppLayout>
 *       );
 *   }
 */
export default function AppLayout({ titulo, descripcion, acciones, ancho = 'normal', children }: AppLayoutProps) {
    const pagina = usePage();
    const { auth, negocio } = pagina.props as unknown as Compartido;
    const usuario = auth.user;
    const ruta = pagina.url.split(/[?#]/)[0] || '/';
    const [masAbierto, setMasAbierto] = useState(false);
    const serpiente = useSerpiente();

    // Sin sesión no hay layout (el servidor ya redirige a /login); evita romper si llegara a pasar.
    if (!usuario) return <>{children}</>;

    const destinos = DESTINOS.filter((destino) => !destino.soloAdmin || usuario.is_admin);
    const principales = destinos.filter((destino) => !destino.secundario);
    const secundarios = destinos.filter((destino) => destino.secundario);
    const enSecundario = secundarios.some((destino) => estaActivo(destino, ruta));

    return (
        <ClickSpark sparkColor="#34d8a6" sparkSize={7} sparkRadius={16} sparkCount={6} duration={380} className="min-h-dvh">
            <Head title={titulo} />

            <a
                href="#contenido"
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[2] focus:rounded-campo focus:bg-acento focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-sobre-acento"
            >
                Saltar al contenido
            </a>

            {/* Luz ambiental fija: da profundidad sin animación ni costo al desplazar. */}
            <div
                className="pointer-events-none fixed inset-0 -z-10"
                aria-hidden="true"
                style={{
                    backgroundImage:
                        'radial-gradient(52rem 30rem at 18% -12%, rgb(52 216 166 / 0.085), transparent 70%), radial-gradient(40rem 26rem at 100% 0%, rgb(43 155 214 / 0.05), transparent 70%)',
                }}
            />

            {/* Barra lateral · escritorio */}
            <aside className="fixed inset-y-0 left-0 z-[1] hidden w-64 flex-col border-r border-borde bg-superficie/70 lg:flex">
                <div className="px-5 pt-6 pb-5">
                    <Link href="/" onClick={serpiente.alClicEmblema} className="inline-flex items-center gap-2.5 rounded-campo" aria-label="ZenGPT, ir al panel">
                        <Emblema />
                        <ShinyText text="ZenGPT" color="#e8eeeb" shineColor="#34d8a6" speed={2.2} delay={7} className="font-titulo text-xl font-semibold tracking-tight" />
                    </Link>
                    <p className="mt-3 text-xs text-tenue first-letter:uppercase">{fechaLarga(negocio.hoy)}</p>
                </div>

                <nav className="flex-1 overflow-y-auto px-3" aria-label="Principal">
                    <ul className="flex flex-col gap-1">
                        {destinos.map((destino) => {
                            const activo = estaActivo(destino, ruta);
                            const Icono = destino.icono;

                            return (
                                <li key={destino.href}>
                                    <Link
                                        href={destino.href}
                                        aria-current={activo ? 'page' : undefined}
                                        className={cn(
                                            'group relative flex h-10 items-center gap-3 rounded-campo px-3 text-sm font-medium transition-colors duration-150',
                                            activo ? 'bg-superficie-3 text-texto' : 'text-suave hover:bg-superficie-2 hover:text-texto',
                                        )}
                                    >
                                        <span className={cn('absolute inset-y-2 left-0 w-0.5 rounded-full bg-acento transition-opacity duration-200', activo ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                                        <Icono className={cn('size-4.5 shrink-0 transition-colors duration-150', activo ? 'text-acento' : 'text-tenue group-hover:text-suave')} aria-hidden="true" />
                                        {destino.etiqueta}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <div className="border-t border-borde p-3">
                    <div className="flex items-center gap-3 rounded-campo px-2 py-2">
                        <Avatar usuario={usuario} />
                        <div className="min-w-0 flex-1 leading-tight">
                            <p className="truncate text-sm font-medium text-texto">{usuario.name}</p>
                            <p className="truncate text-xs text-tenue">{rolDe(usuario)}</p>
                        </div>
                    </div>
                    <Link
                        href="/logout"
                        method="post"
                        as="button"
                        className="mt-1 flex h-10 w-full items-center gap-3 rounded-campo px-3 text-sm font-medium text-suave transition-colors duration-150 hover:bg-superficie-2 hover:text-texto"
                    >
                        <LogOut className="size-4.5 shrink-0 text-tenue" aria-hidden="true" />
                        Cerrar sesión
                    </Link>
                </div>
            </aside>

            {/* Barra superior · celular y tableta */}
            <header className="sticky top-0 z-[1] flex h-14 items-center justify-between gap-3 border-b border-borde bg-fondo/90 px-4 backdrop-blur-md lg:hidden">
                <Link href="/" onClick={serpiente.alClicEmblema} className="inline-flex items-center gap-2 rounded-campo" aria-label="ZenGPT, ir al panel">
                    <Emblema className="size-7" />
                    <span className="font-titulo text-lg font-semibold tracking-tight text-texto">
                        Zen<span className="text-acento">GPT</span>
                    </span>
                </Link>
                <Link href="/perfil" className="flex items-center gap-2.5 rounded-full py-1 pl-3" aria-label={`${usuario.name}, ${rolDe(usuario)}: ver perfil`}>
                    <span className="text-right leading-tight">
                        <span className="block max-w-32 truncate text-[13px] font-medium text-texto">{usuario.name}</span>
                        <span className="block text-[11px] text-tenue">{rolDe(usuario)}</span>
                    </span>
                    <Avatar usuario={usuario} className="size-8 text-xs" />
                </Link>
            </header>

            {/* Contenido */}
            <div className="isolate lg:pl-64">
                <main id="contenido" tabIndex={-1} className={cn('mx-auto w-full animate-aparecer px-4 pt-6 pb-28 outline-none sm:px-6 lg:px-10 lg:pt-10 lg:pb-14', ANCHOS[ancho])}>
                    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 lg:mb-8">
                        <div className="min-w-0">
                            <h1 className="text-2xl leading-tight font-semibold text-texto sm:text-[1.75rem]">{titulo}</h1>
                            {descripcion && <p className="mt-1.5 text-sm leading-relaxed text-suave">{descripcion}</p>}
                        </div>
                        {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
                    </div>
                    {children}
                </main>
            </div>

            {/* Barra inferior · celular y tableta */}
            <nav className="fixed inset-x-0 bottom-0 z-[1] border-t border-borde bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="Principal">
                <ul className={cn('mx-auto grid max-w-xl', principales.length >= 5 ? 'grid-cols-6' : 'grid-cols-5')}>
                    {principales.map((destino) => {
                        const activo = estaActivo(destino, ruta);
                        const Icono = destino.icono;

                        return (
                            <li key={destino.href}>
                                <Link
                                    href={destino.href}
                                    aria-current={activo ? 'page' : undefined}
                                    className={cn('relative flex h-15 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150', activo ? 'text-acento' : 'text-suave active:text-texto')}
                                >
                                    <span className={cn('absolute top-0 h-0.5 w-8 rounded-full bg-acento transition-opacity duration-200', activo ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                                    <Icono className="size-5" aria-hidden="true" />
                                    {destino.etiqueta}
                                </Link>
                            </li>
                        );
                    })}
                    <li>
                        <button
                            type="button"
                            onClick={() => setMasAbierto(true)}
                            aria-haspopup="dialog"
                            aria-expanded={masAbierto}
                            className={cn('relative flex h-15 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150', enSecundario ? 'text-acento' : 'text-suave active:text-texto')}
                        >
                            <span className={cn('absolute top-0 h-0.5 w-8 rounded-full bg-acento transition-opacity duration-200', enSecundario ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                            <Ellipsis className="size-5" aria-hidden="true" />
                            Más
                        </button>
                    </li>
                </ul>
            </nav>

            <Modal abierto={masAbierto} alCerrar={() => setMasAbierto(false)} titulo={usuario.name} descripcion={`${rolDe(usuario)} · @${usuario.username}`} tamano="sm">
                <ul className="-mx-2 flex flex-col gap-1">
                    {secundarios.map((destino) => {
                        const activo = estaActivo(destino, ruta);
                        const Icono = destino.icono;

                        return (
                            <li key={destino.href}>
                                <Link
                                    href={destino.href}
                                    onClick={() => setMasAbierto(false)}
                                    aria-current={activo ? 'page' : undefined}
                                    className={cn('flex h-12 items-center gap-3 rounded-campo px-3 text-[15px] font-medium transition-colors', activo ? 'bg-superficie-3 text-texto' : 'text-suave hover:bg-superficie-2 hover:text-texto')}
                                >
                                    <Icono className={cn('size-5', activo ? 'text-acento' : 'text-tenue')} aria-hidden="true" />
                                    {destino.etiqueta}
                                </Link>
                            </li>
                        );
                    })}
                    <li className="mt-1 border-t border-borde pt-2">
                        <Link href="/logout" method="post" as="button" className="flex h-12 w-full items-center gap-3 rounded-campo px-3 text-[15px] font-medium text-suave transition-colors hover:bg-superficie-2 hover:text-texto">
                            <LogOut className="size-5 text-tenue" aria-hidden="true" />
                            Cerrar sesión
                        </Link>
                    </li>
                </ul>
            </Modal>

            <Avisos />

            {serpiente.juego && (
                <Suspense fallback={null}>
                    {serpiente.juego === 'snake' && <Serpiente alCerrar={serpiente.cerrar} />}
                    {serpiente.juego === 'zombies' && <ArenaZombies alCerrar={serpiente.cerrar} />}
                    {serpiente.juego === 'menu' && <MenuJuegos alElegir={serpiente.abrir} alCerrar={serpiente.cerrar} />}
                </Suspense>
            )}
        </ClickSpark>
    );
}
