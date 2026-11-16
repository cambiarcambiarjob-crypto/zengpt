import { lazy, Suspense, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { useCuandoLibre, useMovimientoReducido } from '@/lib/movimiento';

// El fondo WebGL viaja en su propio archivo: no pesa en la carga inicial de la pantalla que lo usa.
const Aurora = lazy(() => import('@/components/reactbits/Aurora'));

function hayWebGL2(): boolean {
    try {
        const gl = document.createElement('canvas').getContext('webgl2');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();

        return gl !== null;
    } catch {
        return false;
    }
}

export interface FondoAuroraProps {
    /** Colores de la aurora, de izquierda a derecha (2 a 5). Por defecto, la gama jade de la marca. */
    colores?: string[];
    /** 0–1: qué tanto del alto ocupa la aurora desde arriba. */
    alto?: number;
    /** 0–1: opacidad general (bájala si hay texto encima). */
    opacidad?: number;
    className?: string;
}

/** Aviso interno de que el lienzo ya está montado, para desvanecer el respaldo estático. */
function AlMontar({ avisar }: { avisar: () => void }) {
    useEffect(avisar, [avisar]);

    return null;
}

/**
 * Fondo de aurora (Aurora de React Bits, WebGL2 sin dependencias) listo para usarse:
 *  · se descarga aparte y se monta cuando el navegador está libre: nunca retrasa el contenido;
 *  · mientras carga (o si no hay WebGL2) se ve un degradado estático equivalente;
 *  · con «reducir movimiento» queda como imagen fija; con la pestaña oculta se pausa solo.
 * Colócalo dentro de un contenedor `relative`; ocupa todo el contenedor y no recibe clics.
 */
export function FondoAurora({ colores = ['#0f6f55', '#34d8a6', '#1f8fb8'], alto = 0.44, opacidad = 0.8, className }: FondoAuroraProps) {
    const reducido = useMovimientoReducido();
    const libre = useCuandoLibre();
    const [soportado, setSoportado] = useState(false);
    const [montado, setMontado] = useState(false);

    useEffect(() => {
        if (libre) setSoportado(hayWebGL2());
    }, [libre]);

    return (
        <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
            <div
                className={cn('absolute inset-0 transition-opacity duration-[1600ms] ease-out', montado ? 'opacity-0' : 'opacity-100')}
                style={{
                    backgroundImage:
                        'radial-gradient(60% 46% at 22% -6%, rgb(15 111 85 / 0.55), transparent 70%), radial-gradient(52% 40% at 62% -10%, rgb(52 216 166 / 0.32), transparent 72%), radial-gradient(40% 36% at 96% -8%, rgb(43 155 214 / 0.28), transparent 70%)',
                }}
            />
            {libre && soportado && (
                <Suspense fallback={null}>
                    <div className="absolute inset-0">
                        <Aurora
                            colorStops={colores}
                            height={alto}
                            opacity={opacidad}
                            amplitude={1.25}
                            blend={0.9}
                            glow={0.55}
                            scale={0.7}
                            layers={3}
                            speed={0.7}
                            intro={!reducido}
                            paused={reducido}
                            mouseInteraction={!reducido}
                            dpr={Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 1.5)}
                        />
                    </div>
                    <AlMontar avisar={() => setMontado(true)} />
                </Suspense>
            )}
        </div>
    );
}
