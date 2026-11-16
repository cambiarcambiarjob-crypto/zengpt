import { useId } from 'react';
import { cn } from '@/lib/cn';

/** Casilla «Pendiente de pago»: el cliente ya está dentro pero no cuenta en ventas hasta que pague. */
export function CasillaPendiente({ marcada, alCambiar, className }: { marcada: boolean; alCambiar: (valor: boolean) => void; className?: string }) {
    const id = useId();

    return (
        <div className={cn('flex items-start gap-2.5 rounded-campo border p-3 transition-colors', marcada ? 'border-alerta/40 bg-alerta/10' : 'border-borde', className)}>
            <input id={id} type="checkbox" aria-describedby={`${id}-ayuda`} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-alerta" checked={marcada} onChange={(e) => alCambiar(e.target.checked)} />
            <div className="min-w-0">
                <label htmlFor={id} className="cursor-pointer text-sm text-texto">
                    Pendiente de pago (aún no transfiere)
                </label>
                <p id={`${id}-ayuda`} className="mt-0.5 text-xs text-tenue">
                    Ocupa el espacio, pero no cuenta en ventas ni ganancias hasta que lo marques como pagado.
                </p>
            </div>
        </div>
    );
}
