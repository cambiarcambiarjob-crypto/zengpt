import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EstadoVacioProps {
    /** Icono de lucide-react: <Inbox className="size-5" />. */
    icono?: ReactNode;
    titulo: ReactNode;
    descripcion?: ReactNode;
    /** Botón o enlace para resolverlo («Agregar cuenta»). */
    accion?: ReactNode;
    /** Menos alto: para usarlo dentro de una tarjeta o tabla. */
    compacto?: boolean;
    className?: string;
}

/** Lo que se ve cuando aún no hay datos: explica qué falta y ofrece la acción para empezar. */
export function EstadoVacio({ icono, titulo, descripcion, accion, compacto = false, className }: EstadoVacioProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center text-center', compacto ? 'px-4 py-8' : 'px-6 py-14', className)}>
            {icono && (
                <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-borde-fuerte bg-superficie-2 text-acento shadow-tarjeta" aria-hidden="true">
                    {icono}
                </div>
            )}
            <p className="font-titulo text-base font-semibold text-texto">{titulo}</p>
            {descripcion && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-suave">{descripcion}</p>}
            {accion && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{accion}</div>}
        </div>
    );
}
