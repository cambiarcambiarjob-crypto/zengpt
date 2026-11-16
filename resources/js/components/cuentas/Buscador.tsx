import { Search, X } from 'lucide-react';
import type { Ref } from 'react';
import { Cargador } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';

export interface BuscadorProps {
    valor: string;
    alCambiar: (valor: string) => void;
    /** Enter: busca de inmediato, sin esperar la pausa. */
    alConfirmar?: () => void;
    /** Hay una búsqueda en camino al servidor. */
    buscando?: boolean;
    ref?: Ref<HTMLInputElement>;
    className?: string;
}

/** Buscador de cuentas: por Gmail de la cuenta, Gmail del cliente o teléfono. «/» lo enfoca; Esc lo limpia. */
export function Buscador({ valor, alCambiar, alConfirmar, buscando = false, ref, className }: BuscadorProps) {
    return (
        <search className={className}>
            <Campo
                ref={ref}
                etiqueta="Buscar por Gmail de la cuenta, Gmail del cliente o teléfono"
                ocultarEtiqueta
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Buscar cuenta, cliente o teléfono"
                aria-keyshortcuts="/"
                value={valor}
                onChange={(evento) => alCambiar(evento.target.value)}
                onKeyDown={(evento) => {
                    if (evento.key === 'Enter') {
                        evento.preventDefault();
                        alConfirmar?.();
                    } else if (evento.key === 'Escape' && valor !== '') {
                        evento.preventDefault();
                        alCambiar('');
                    }
                }}
                className="[&::-webkit-search-cancel-button]:hidden"
                prefijo={<Search className="size-4" aria-hidden="true" />}
                sufijo={
                    // Caja de ancho fijo: el indicador, la «X» y el atajo se relevan sin mover el texto.
                    <span className="flex h-7 w-7 items-center justify-center">
                        {buscando ? (
                            <>
                                <Cargador className="size-3.5 text-acento" />
                                <span className="sr-only">Buscando…</span>
                            </>
                        ) : valor !== '' ? (
                            <button
                                type="button"
                                onClick={() => alCambiar('')}
                                aria-label="Limpiar búsqueda"
                                className="flex size-7 items-center justify-center rounded-md text-tenue transition-colors hover:bg-superficie-3 hover:text-texto"
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        ) : (
                            <kbd className="hidden h-5 min-w-5 items-center justify-center rounded border border-borde-fuerte px-1 font-sans text-[11px] text-tenue pointer-fine:flex" aria-hidden="true">
                                /
                            </kbd>
                        )}
                    </span>
                }
            />
        </search>
    );
}
