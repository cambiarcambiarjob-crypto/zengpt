import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InterruptorProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role' | 'aria-checked'> {
    /** Estado actual. */
    activo: boolean;
    alCambiar: (activo: boolean) => void;
    /** Nombre accesible («Jorge: activo»). El interruptor no trae texto visible propio. */
    etiqueta: string;
    /** true mientras se guarda el cambio: no admite otro clic y late suavemente. */
    ocupado?: boolean;
}

/**
 * Interruptor de encendido/apagado (`role="switch"`): se usa con teclado (Espacio o Enter) y anuncia su estado.
 * El área que se pulsa mide 44 px de alto aunque la pista sea más baja.
 */
export function Interruptor({ activo, alCambiar, etiqueta, ocupado = false, disabled, className, ...resto }: InterruptorProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={activo}
            aria-label={etiqueta}
            aria-busy={ocupado || undefined}
            disabled={disabled || ocupado}
            onClick={() => alCambiar(!activo)}
            className={cn('group inline-flex h-11 shrink-0 items-center rounded-full px-1 disabled:cursor-not-allowed', ocupado && 'animate-pulse', className)}
            {...resto}
        >
            <span
                className={cn(
                    'relative block h-6 w-11 rounded-full border transition-colors duration-200',
                    activo ? 'border-acento bg-acento' : 'border-borde-fuerte bg-superficie-3 group-hover:border-tenue/70',
                    disabled && !ocupado && 'opacity-50',
                )}
            >
                <span
                    className={cn(
                        'absolute top-1/2 left-0.5 size-[1.125rem] -translate-y-1/2 rounded-full shadow-sm transition-transform duration-200 ease-suave',
                        activo ? 'translate-x-5 bg-sobre-acento' : 'translate-x-0 bg-suave',
                    )}
                />
            </span>
        </button>
    );
}
