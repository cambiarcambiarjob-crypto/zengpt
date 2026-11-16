import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { estilosBoton } from '@/components/ui/Boton';
import { CAJA_CONTROL, TEXTO_CONTROL } from '@/components/ui/Campo';
import { cn } from '@/lib/cn';
import { fechaLarga } from '@/lib/formato';
import { esFechaCompleta } from './utilidades';

export interface NavegadorFechaProps {
    /** Día que se está viendo ('AAAA-MM-DD'). */
    fecha: string;
    anterior: string;
    /** null = el día mostrado es hoy: no hay siguiente. */
    siguiente: string | null;
    esHoy: boolean;
    /** Hoy según el negocio (props.negocio.hoy): tope del selector. */
    hoy: string;
    /** Pide ir a otro día (la pantalla decide si antes hay que confirmar cambios sin guardar). */
    alIr: (fecha: string) => void;
    /** Cambia cuando una navegación se canceló: el selector vuelve a mostrar el día en pantalla. */
    version?: number;
    className?: string;
}

/** ¿El foco está en algo donde las flechas ya significan otra cosa (campos, listas) o hay una ventana abierta? */
function flechasOcupadas(destino: EventTarget | null): boolean {
    if (document.querySelector('[aria-modal="true"]')) return true;
    if (!(destino instanceof HTMLElement)) return false;

    return destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName) || destino.closest('[role="radiogroup"], [role="tablist"], [role="menu"], details') !== null;
}

/**
 * Cambiar de día: anterior, selector de fecha (tope: hoy), siguiente y «Hoy». En PC también con las flechas ← →
 * del teclado cuando el foco no está en un campo. Los botones que no aplican (siguiente y «Hoy» estando en hoy)
 * se quedan en su lugar, apagados: el encabezado no se mueve al cambiar de día.
 */
export function NavegadorFecha({ fecha, anterior, siguiente, esHoy, hoy, alIr, version = 0, className }: NavegadorFechaProps) {
    const id = useId();
    const [valor, setValor] = useState(fecha);
    const espera = useRef<number | undefined>(undefined);
    const ir = useRef(alIr);
    ir.current = alIr;

    // El selector sigue al día en pantalla (y vuelve a él si se canceló el cambio).
    useEffect(() => {
        setValor(fecha);
    }, [fecha, version]);

    useEffect(() => () => window.clearTimeout(espera.current), []);

    // Flechas del teclado: ← día anterior · → día siguiente.
    useEffect(() => {
        const alTeclear = (evento: KeyboardEvent) => {
            if (evento.defaultPrevented || evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return;
            if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
            if (flechasOcupadas(evento.target)) return;

            const destino = evento.key === 'ArrowLeft' ? anterior : siguiente;
            if (!destino) return;

            evento.preventDefault();
            ir.current(destino);
        };

        document.addEventListener('keydown', alTeclear);

        return () => document.removeEventListener('keydown', alTeclear);
    }, [anterior, siguiente]);

    const elegir = (texto: string, inmediato: boolean) => {
        window.clearTimeout(espera.current);
        if (!esFechaCompleta(texto)) return;

        const destino = texto > hoy ? hoy : texto;
        if (destino === fecha) {
            if (destino !== texto) setValor(destino);

            return;
        }

        // Al escribir la fecha con el teclado pasa por días intermedios («01» antes de «16»): se espera a que termine.
        if (inmediato) ir.current(destino);
        else espera.current = window.setTimeout(() => ir.current(destino), 550);
    };

    const flecha = estilosBoton({ soloIcono: true });

    return (
        <div role="group" aria-label="Cambiar de día" className={cn('flex w-full items-center gap-2 sm:w-auto', className)}>
            <button type="button" className={flecha} onClick={() => alIr(anterior)} aria-label={`Día anterior: ${fechaLarga(anterior)}`} aria-keyshortcuts="ArrowLeft" title="Día anterior (←)">
                <ChevronLeft className="size-4.5" aria-hidden="true" />
            </button>

            <label htmlFor={id} className="sr-only">
                Ir a una fecha
            </label>
            <div className={cn(CAJA_CONTROL, 'min-w-0 flex-1 border-borde-fuerte hover:border-tenue/60 sm:w-44 sm:flex-none')}>
                <CalendarDays className="size-4 shrink-0 text-tenue" aria-hidden="true" />
                <input
                    id={id}
                    type="date"
                    max={hoy}
                    required
                    value={valor}
                    onChange={(evento) => {
                        setValor(evento.target.value);
                        elegir(evento.target.value, false);
                    }}
                    onKeyDown={(evento) => {
                        if (evento.key === 'Enter') elegir(evento.currentTarget.value, true);
                    }}
                    onBlur={(evento) => {
                        // Fecha a medias o borrada: se regresa al día en pantalla.
                        if (!esFechaCompleta(evento.target.value)) {
                            window.clearTimeout(espera.current);
                            setValor(fecha);
                        }
                    }}
                    className={cn('cifras h-full min-w-0 flex-1 self-stretch bg-transparent py-2 outline-none', TEXTO_CONTROL)}
                />
            </div>

            <button
                type="button"
                className={flecha}
                onClick={() => siguiente && alIr(siguiente)}
                aria-disabled={siguiente === null || undefined}
                aria-label={siguiente ? `Día siguiente: ${fechaLarga(siguiente)}` : 'Día siguiente: no hay, estás viendo hoy'}
                aria-keyshortcuts="ArrowRight"
                title={siguiente ? 'Día siguiente (→)' : 'Estás viendo hoy'}
            >
                <ChevronRight className="size-4.5" aria-hidden="true" />
            </button>

            <button type="button" className={estilosBoton()} onClick={() => !esHoy && alIr(hoy)} aria-disabled={esHoy || undefined} aria-label={esHoy ? 'Hoy: ya lo estás viendo' : 'Ir a hoy'}>
                Hoy
            </button>
        </div>
    );
}
