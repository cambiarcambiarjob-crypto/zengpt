import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { diasRestantes } from '@/lib/formato';
import type { Cuenta } from '@/types';

export type EstadoInsignia = 'activa' | 'por_vencer' | 'vencida' | 'libre' | 'ocupado' | 'neutral' | 'acento' | 'info';

const ESTILOS: Record<EstadoInsignia, { caja: string; punto: string; texto: string }> = {
    activa: { caja: 'border-exito/30 bg-exito/10 text-exito', punto: 'bg-exito', texto: 'Activa' },
    por_vencer: { caja: 'border-alerta/35 bg-alerta/10 text-alerta', punto: 'bg-alerta', texto: 'Por vencer' },
    vencida: { caja: 'border-peligro/35 bg-peligro/10 text-peligro', punto: 'bg-peligro', texto: 'Vencida' },
    libre: { caja: 'border-acento/40 border-dashed bg-transparent text-acento', punto: 'border border-acento bg-transparent', texto: 'Libre' },
    ocupado: { caja: 'border-borde-fuerte bg-superficie-3 text-suave', punto: 'bg-tenue', texto: 'Ocupado' },
    neutral: { caja: 'border-borde-fuerte bg-superficie-2 text-suave', punto: 'bg-tenue', texto: '' },
    acento: { caja: 'border-acento/35 bg-acento/10 text-acento', punto: 'bg-acento', texto: '' },
    info: { caja: 'border-info/35 bg-info/10 text-info', punto: 'bg-info', texto: '' },
};

export interface InsigniaProps extends HTMLAttributes<HTMLSpanElement> {
    /** activa · por_vencer · vencida (cuentas) · libre · ocupado (espacios) · neutral · acento · info (usos libres). */
    estado?: EstadoInsignia;
    /** Texto; si lo omites se usa el del estado («Activa», «Por vencer», «Vencida», «Libre», «Ocupado»). */
    children?: ReactNode;
    /** Oculta el punto de color. */
    sinPunto?: boolean;
    tamano?: 'sm' | 'md';
}

/** Etiqueta de estado. El significado nunca depende solo del color: siempre lleva texto. */
export function Insignia({ estado = 'neutral', children, sinPunto = false, tamano = 'md', className, ...resto }: InsigniaProps) {
    const estilo = ESTILOS[estado];

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
                tamano === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-xs',
                estilo.caja,
                className,
            )}
            {...resto}
        >
            {!sinPunto && <span className={cn('size-1.5 rounded-full', estilo.punto)} aria-hidden="true" />}
            {children ?? estilo.texto}
        </span>
    );
}

/** Estado de una cuenta a partir del contrato: 'vencida' | 'por_vencer' | 'activa'. */
export function estadoDeCuenta(cuenta: Pick<Cuenta, 'activa' | 'por_vencer'>): 'activa' | 'por_vencer' | 'vencida' {
    if (!cuenta.activa) return 'vencida';

    return cuenta.por_vencer ? 'por_vencer' : 'activa';
}

/**
 * Insignia de vigencia de una cuenta: «Activa», «Vence en 5 días», «Vence hoy» o «Venció hace 3 días».
 * Con `detalle` también las activas dicen cuánto falta («Vence en 62 días»).
 */
export function InsigniaCuenta({ cuenta, detalle = false, ...resto }: { cuenta: Pick<Cuenta, 'activa' | 'por_vencer' | 'dias_restantes'>; detalle?: boolean } & Omit<InsigniaProps, 'estado' | 'children'>) {
    const estado = estadoDeCuenta(cuenta);
    const frase = diasRestantes(cuenta.dias_restantes);
    const texto = estado === 'activa' && !detalle ? 'Activa' : frase.charAt(0).toUpperCase() + frase.slice(1);

    return (
        <Insignia estado={estado} {...resto}>
            {texto}
        </Insignia>
    );
}
