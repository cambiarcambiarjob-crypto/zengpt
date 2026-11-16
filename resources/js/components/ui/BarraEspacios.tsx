import { cn } from '@/lib/cn';

export interface BarraEspaciosProps {
    /** Espacios con cliente. */
    ocupados: number;
    /** Espacios de la cuenta (5 por defecto; usa `cuenta.capacidad`). */
    capacidad?: number;
    /** sm = segmentos finos para tablas · md (por defecto) · lg = para tarjetas de cuenta. */
    tamano?: 'sm' | 'md' | 'lg';
    /** Muestra «3/5» junto a los segmentos. */
    conTexto?: boolean;
    className?: string;
}

const SEGMENTO = { sm: 'h-1.5 w-3.5', md: 'h-2 w-5', lg: 'h-2.5 w-7' } as const;

/** Los 5 espacios de una cuenta: segmentos ocupados (jade) y libres (huecos). <BarraEspacios ocupados={cuenta.ocupados} capacidad={cuenta.capacidad} conTexto /> */
export function BarraEspacios({ ocupados, capacidad = 5, tamano = 'md', conTexto = false, className }: BarraEspaciosProps) {
    const total = Math.max(1, capacidad);
    const llenos = Math.min(Math.max(0, ocupados), total);
    const libres = total - llenos;

    return (
        <span
            role="img"
            aria-label={`${llenos} de ${total} espacios ocupados, ${libres === 0 ? 'ninguno libre' : libres === 1 ? '1 libre' : `${libres} libres`}`}
            className={cn('inline-flex items-center gap-2', className)}
        >
            <span className="inline-flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: total }, (_, i) => (
                    <span
                        key={i}
                        className={cn(
                            'rounded-full transition-colors duration-300',
                            SEGMENTO[tamano],
                            i < llenos ? 'bg-acento shadow-[0_0_10px_-2px_rgb(52_216_166/0.7)]' : 'bg-superficie-3 inset-ring inset-ring-borde-fuerte',
                        )}
                    />
                ))}
            </span>
            {conTexto && (
                <span className="cifras text-xs font-medium text-suave" aria-hidden="true">
                    {llenos}/{total}
                </span>
            )}
        </span>
    );
}
