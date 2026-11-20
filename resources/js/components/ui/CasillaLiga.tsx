import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * Casilla «Mandarle su liga por correo al guardar»: cuando el espacio del cliente ya tiene su liga, se le manda por correo
 * (el de botón verde) y no se le invita por Google, porque los lugares de Google ya están ocupados con las ligas.
 */
export function CasillaLiga({ marcada, alCambiar, espacio, className }: { marcada: boolean; alCambiar: (valor: boolean) => void; espacio: number; className?: string }) {
    const id = useId();

    return (
        <div className={cn('flex items-start gap-2.5 rounded-campo border p-3 transition-colors', marcada ? 'border-exito/40 bg-exito/10' : 'border-borde', className)}>
            <input id={id} type="checkbox" aria-describedby={`${id}-ayuda`} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-exito" checked={marcada} onChange={(e) => alCambiar(e.target.checked)} />
            <div className="min-w-0">
                <label htmlFor={id} className="cursor-pointer text-sm text-texto">
                    Mandarle su liga por correo al guardar
                </label>
                <p id={`${id}-ayuda`} className="mt-0.5 text-xs text-tenue">
                    Le llega a su correo con el botón verde y la liga del espacio {espacio}. No se le invita por Google: esos lugares ya están ocupados con las ligas.
                </p>
            </div>
        </div>
    );
}
