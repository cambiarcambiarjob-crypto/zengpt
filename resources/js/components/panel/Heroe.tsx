import { Megaphone, TrendingUp } from 'lucide-react';
import { lazy, Suspense, type ComponentType } from 'react';
import { FondoHilos } from '@/components/fondos/FondoHilos';
import { Cifra } from '@/components/ui/Cifra';
import { cn } from '@/lib/cn';
import { dinero, fechaLarga, plural } from '@/lib/formato';
import { useMovimientoReducido } from '@/lib/movimiento';
import type { DashboardProps } from '@/types';

interface SaludoProps {
    text?: string;
    className?: string;
    animateBy?: 'words' | 'letters';
    delay?: number;
    blur?: number;
    distance?: number;
    trigger?: 'view' | 'load' | 'hover' | 'click';
}

/** El saludo sin animación: es lo que se ve con «reducir movimiento» y lo que reserva el espacio mientras llega BlurText. */
function SaludoFijo({ text, className }: SaludoProps) {
    return <p className={className}>{text}</p>;
}

// BlurText (React Bits) trae la capa de componentes de `motion` (~22 kB comprimidos): se descarga aparte para que
// las cifras del panel no la esperen. Si la descarga falla, el saludo simplemente queda fijo.
const SaludoAnimado = lazy<ComponentType<SaludoProps>>(() => import('@/components/reactbits/BlurText').catch(() => ({ default: SaludoFijo })));

/** «Buenos días» / «Buenas tardes» / «Buenas noches» según la hora del dispositivo de quien mira el panel. */
function saludoDeLaHora(hora: number): string {
    if (hora >= 5 && hora < 12) return 'Buenos días';

    return hora >= 12 && hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export interface HeroeProps {
    /** Nombre de quien inició sesión. */
    nombre: string;
    hoy: DashboardProps['hoy'];
    className?: string;
}

/**
 * Cabecera del panel: saludo, fecha de hoy y la cifra que manda en la pantalla (la ganancia neta del día) con
 * las ventas y la publicidad que la forman. El adorno de hilos (Threads de React Bits) se descarga aparte y
 * solo ocupa el lado derecho (en celular, la esquina superior derecha): nunca queda debajo de un número.
 */
export function Heroe({ nombre, hoy, className }: HeroeProps) {
    const reducido = useMovimientoReducido();
    const saludo = `${saludoDeLaHora(new Date().getHours())}, ${nombre}`;
    const claseSaludo = 'font-titulo text-xl leading-snug font-semibold tracking-tight text-texto sm:text-2xl';
    const sinMovimiento = hoy.ventas_count === 0 && hoy.publicidad === 0;

    return (
        <section aria-label="Ganancia de hoy" className={cn('relative isolate min-w-0 overflow-hidden rounded-tarjeta border border-borde bg-superficie shadow-tarjeta', className)}>
            {/* Resplandor jade fijo + hilos animados, ambos decorativos y recortados hacia la derecha. */}
            <div className="pointer-events-none absolute -top-24 -right-16 -z-10 size-80 rounded-full bg-acento/10 blur-3xl" aria-hidden="true" />
            <FondoHilos opacidad={0.5} hilos={18} className="-z-10 max-sm:[mask-image:linear-gradient(to_bottom_left,black,transparent_56%)] sm:[mask-image:linear-gradient(to_right,transparent_30%,black_78%)]" />

            <div className="flex h-full flex-col p-5 sm:p-7">
                {reducido ? (
                    <SaludoFijo text={saludo} className={claseSaludo} />
                ) : (
                    // Mientras llega, el mismo texto invisible guarda el lugar: nada se mueve cuando aparece.
                    <Suspense fallback={<SaludoFijo text={saludo} className={cn(claseSaludo, 'invisible')} />}>
                        <SaludoAnimado text={saludo} animateBy="words" delay={60} blur={8} distance={10} trigger="load" className={claseSaludo} />
                    </Suspense>
                )}
                <p className="mt-1 text-sm text-suave first-letter:uppercase">{fechaLarga(hoy.fecha, { anio: true })}</p>

                <Cifra
                    className="mt-7 sm:mt-9"
                    etiqueta="Ganancia de hoy"
                    valor={hoy.neto}
                    tamano="xl"
                    tono={hoy.neto > 0 ? 'acento' : 'normal'}
                    negativoEnRojo
                    detalle={sinMovimiento ? 'Aún no hay ventas ni publicidad capturadas hoy.' : 'Neto del día: ventas menos publicidad y costo de cuentas.'}
                />

                <dl className="mt-auto flex flex-wrap gap-x-10 gap-y-4 pt-6 sm:pt-8">
                    <div className="min-w-0">
                        <dt className="flex items-center gap-1.5 text-[13px] font-medium text-suave">
                            <TrendingUp className="size-4 text-tenue" aria-hidden="true" />
                            Ventas de hoy
                        </dt>
                        <dd className="cifras mt-1 font-titulo text-xl leading-tight font-semibold text-texto">{dinero(hoy.ventas)}</dd>
                        <dd className="mt-0.5 text-[13px] text-tenue">{plural(hoy.ventas_count, 'venta')}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="flex items-center gap-1.5 text-[13px] font-medium text-suave">
                            <Megaphone className="size-4 text-tenue" aria-hidden="true" />
                            Publicidad de hoy
                        </dt>
                        <dd className="cifras mt-1 font-titulo text-xl leading-tight font-semibold text-texto">{dinero(-hoy.publicidad)}</dd>
                        <dd className="mt-0.5 text-[13px] text-tenue">{hoy.publicidad > 0 ? 'Se resta de las ventas' : 'Sin gasto capturado'}</dd>
                    </div>
                </dl>
            </div>
        </section>
    );
}
