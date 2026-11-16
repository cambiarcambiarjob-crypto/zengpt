import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface AparecerProps extends HTMLAttributes<HTMLDivElement> {
    /** Espera antes de entrar, en milisegundos. */
    retraso?: number;
    /** Posición en una lista: escalona la entrada (40 ms por elemento, máximo 8) sin retrasar los datos. */
    indice?: number;
    /** entrada = sube y aparece (por defecto) · aparecer = solo opacidad · enfocar = desenfoque (títulos). */
    efecto?: 'entrada' | 'aparecer' | 'enfocar';
    como?: 'div' | 'li' | 'section' | 'span';
}

const EFECTOS = { entrada: 'animate-entrada', aparecer: 'animate-aparecer', enfocar: 'animate-enfocar' } as const;

/**
 * Entrada suave con CSS puro (sin JavaScript de animación, sin saltos de layout: solo opacidad y transform).
 * Con «reducir movimiento» el contenido aparece directo.
 *
 *   {cuentas.map((cuenta, i) => <Aparecer key={cuenta.id} indice={i}>…</Aparecer>)}
 */
export function Aparecer({ retraso, indice, efecto = 'entrada', como: Etiqueta = 'div', className, style, ...resto }: AparecerProps) {
    const espera = retraso ?? (indice !== undefined ? Math.min(indice, 8) * 40 : 0);
    const estilo: CSSProperties | undefined = espera > 0 ? { animationDelay: `${espera}ms`, ...style } : style;
    const Componente = Etiqueta as 'div';

    return <Componente className={cn('min-w-0', EFECTOS[efecto], className)} style={estilo} {...resto} />;
}
