import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const RELLENOS = { normal: 'p-5 sm:p-6', compacto: 'p-4', ninguno: '' } as const;

export interface TarjetaProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
    /** Título de la tarjeta (se pinta como <h2>). */
    titulo?: ReactNode;
    descripcion?: ReactNode;
    /** Botones o filtros a la derecha del título. */
    acciones?: ReactNode;
    /** normal (por defecto) · compacto · ninguno (para tablas o listas a sangre). */
    relleno?: keyof typeof RELLENOS;
    /** Etiqueta HTML del contenedor. */
    como?: 'section' | 'div' | 'article' | 'aside';
    /** Resalta al pasar el cursor (para tarjetas que son enlaces o se pueden pulsar). */
    interactiva?: boolean;
}

/** Encabezado estándar de una tarjeta (lo comparten Tarjeta y TarjetaFoco). */
export function EncabezadoTarjeta({ titulo, descripcion, acciones, className }: { titulo?: ReactNode; descripcion?: ReactNode; acciones?: ReactNode; className?: string }) {
    if (!titulo && !acciones) return null;

    return (
        <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}>
            <div className="min-w-0">
                {titulo && <h2 className="text-base leading-snug font-semibold text-texto">{titulo}</h2>}
                {descripcion && <p className="mt-0.5 text-[13px] leading-snug text-suave">{descripcion}</p>}
            </div>
            {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
        </div>
    );
}

/**
 * Superficie base del sistema.
 *
 *   <Tarjeta titulo="Ventas de hoy" acciones={<Boton tamano="sm">Agregar</Boton>}>…</Tarjeta>
 *   <Tarjeta relleno="ninguno" titulo="Clientes"><Tabla … /></Tarjeta>   // el título conserva su relleno
 */
export function Tarjeta({ titulo, descripcion, acciones, relleno = 'normal', como: Etiqueta = 'section', interactiva = false, className, children, ...resto }: TarjetaProps) {
    const hayEncabezado = Boolean(titulo || acciones);

    return (
        <Etiqueta
            className={cn(
                'rounded-tarjeta border border-borde bg-superficie shadow-tarjeta',
                interactiva && 'transition-[border-color,background-color] duration-150 hover:border-borde-fuerte hover:bg-superficie-2',
                RELLENOS[relleno],
                className,
            )}
            {...resto}
        >
            {hayEncabezado && <EncabezadoTarjeta titulo={titulo} descripcion={descripcion} acciones={acciones} className={relleno === 'ninguno' ? 'px-5 pt-5 pb-4 sm:px-6' : 'mb-4'} />}
            {children}
        </Etiqueta>
    );
}
