import { lazy, Suspense } from 'react';
import { cn } from '@/lib/cn';
import { useCuandoLibre, useMovimientoReducido } from '@/lib/movimiento';

// Hilos WebGL en su propio archivo: no pesa en la carga inicial de la pantalla que lo usa.
const Threads = lazy(() => import('@/components/reactbits/Threads'));

export interface FondoHilosProps {
    /** Color de los hilos (jade por defecto). */
    color?: string;
    /** 0–1: opacidad general. Mantenla baja si hay texto encima. */
    opacidad?: number;
    /** Cantidad de hilos (menos = más ligero y más sobrio). */
    hilos?: number;
    className?: string;
}

/**
 * Adorno de hilos que ondulan (Threads de React Bits, WebGL2 sin dependencias) para encabezados o tarjetas destacadas.
 * Se descarga aparte, se monta cuando el navegador está libre, queda fijo con «reducir movimiento» y se pausa solo con
 * la pestaña oculta o fuera de la vista. Si no hay WebGL2 simplemente no se ve (es decorativo).
 * Colócalo dentro de un contenedor `relative overflow-hidden`; no recibe clics.
 *
 *   <div className="relative overflow-hidden rounded-tarjeta border border-borde bg-superficie">
 *       <FondoHilos className="opacity-60" />
 *       <div className="relative p-6">…contenido…</div>
 *   </div>
 */
export function FondoHilos({ color = '#34d8a6', opacidad = 0.55, hilos = 22, className }: FondoHilosProps) {
    const reducido = useMovimientoReducido();
    const libre = useCuandoLibre();

    return (
        <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
            {libre && (
                <Suspense fallback={null}>
                    <Threads
                        className="absolute inset-0 animate-aparecer"
                        color={color}
                        lineCount={hilos}
                        amplitude={1}
                        distance={0.3}
                        speed={0.6}
                        opacity={opacidad}
                        enableMouseInteraction={false}
                        paused={reducido}
                    />
                </Suspense>
            )}
        </div>
    );
}
