import type { HTMLAttributes, ReactNode } from 'react';
import SpotlightCard from '@/components/reactbits/SpotlightCard';
import { cn } from '@/lib/cn';
import { EncabezadoTarjeta, RELLENOS } from './Tarjeta';

export interface TarjetaFocoProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    titulo?: ReactNode;
    descripcion?: ReactNode;
    acciones?: ReactNode;
    relleno?: keyof typeof RELLENOS;
    /** Color de la luz que sigue al cursor (por defecto, el jade de la marca). */
    color?: string;
    /** 0–1: fuerza de la luz. */
    intensidad?: number;
}

/**
 * Tarjeta destacada con la luz de SpotlightCard (React Bits) siguiendo al cursor. Para lo importante de cada pantalla
 * (cifras del día, resumen del mes): no la uses en cada fila de una lista (cada una escucha el movimiento del cursor).
 */
export function TarjetaFoco({ titulo, descripcion, acciones, relleno = 'normal', color = '#34d8a6', intensidad = 0.1, className, children, ...resto }: TarjetaFocoProps) {
    return (
        <SpotlightCard
            spotlightColor={color}
            intensity={intensidad}
            borderGlow={0.55}
            spotlightSize={280}
            // Las clases con «!» pisan el radio y el relleno que trae el componente original.
            className={cn('rounded-tarjeta! p-0! shadow-tarjeta', className)}
            style={{ '--spotlight-card-surface': 'var(--color-superficie)', '--spotlight-card-border': 'var(--color-borde)', '--spotlight-card-shadow': 'var(--shadow-tarjeta)' } as React.CSSProperties}
            {...resto}
        >
            <div className={RELLENOS[relleno]}>
                <EncabezadoTarjeta titulo={titulo} descripcion={descripcion} acciones={acciones} className="mb-4" />
                {children}
            </div>
        </SpotlightCard>
    );
}
