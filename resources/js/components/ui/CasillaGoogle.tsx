import { useId } from 'react';
import { cn } from '@/lib/cn';

/** Casilla «Invitar en Google al guardar»: solo en cuentas con su sesión abierta en el servidor. */
export function CasillaGoogle({ marcada, alCambiar, className }: { marcada: boolean; alCambiar: (valor: boolean) => void; className?: string }) {
    const id = useId();

    return (
        <div className={cn('flex items-start gap-2.5 rounded-campo border p-3 transition-colors', marcada ? 'border-info/40 bg-info/10' : 'border-borde', className)}>
            <input id={id} type="checkbox" aria-describedby={`${id}-ayuda`} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-info" checked={marcada} onChange={(e) => alCambiar(e.target.checked)} />
            <div className="min-w-0">
                <label htmlFor={id} className="cursor-pointer text-sm text-texto">
                    Invitar en Google al guardar
                </label>
                <p id={`${id}-ayuda`} className="mt-0.5 text-xs text-tenue">
                    Google le manda al cliente su invitación al grupo familiar desde esta cuenta. Tarda unos segundos.
                </p>
            </div>
        </div>
    );
}
