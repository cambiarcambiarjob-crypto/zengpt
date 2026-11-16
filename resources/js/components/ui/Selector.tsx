import { ChevronDown } from 'lucide-react';
import { useId, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { CAJA_CONTROL, EnvolturaCampo, idsDescripcion, TEXTO_CONTROL } from './Campo';

export interface OpcionSelector {
    valor: string | number;
    etiqueta: string;
    deshabilitada?: boolean;
}

export interface SelectorProps extends SelectHTMLAttributes<HTMLSelectElement> {
    etiqueta: ReactNode;
    /** Opciones como datos; también puedes pasar <option> como children. */
    opciones?: OpcionSelector[];
    /** Primera opción vacía («Elige un vendedor…»). */
    marcador?: string;
    error?: string | null;
    ayuda?: ReactNode;
    opcional?: boolean;
    ocultarEtiqueta?: boolean;
    claseContenedor?: string;
    ref?: Ref<HTMLSelectElement>;
}

/**
 * Lista desplegable nativa (rápida y accesible en PC y celular) con el aspecto del sistema.
 *
 *   <Selector etiqueta="Vendedor" value={form.data.seller_id} onChange={(e) => form.setData('seller_id', e.target.value)}
 *             opciones={vendedores.map((v) => ({ valor: v.id, etiqueta: v.name }))} marcador="Elige un vendedor…" error={form.errors.seller_id} />
 */
export function Selector({ etiqueta, opciones, marcador, error, ayuda, opcional, ocultarEtiqueta, claseContenedor, className, id, ref, children, ...resto }: SelectorProps) {
    const propio = useId();
    const campoId = id ?? propio;

    return (
        <EnvolturaCampo id={campoId} etiqueta={etiqueta} error={error} ayuda={ayuda} opcional={opcional} ocultarEtiqueta={ocultarEtiqueta} className={claseContenedor}>
            <div className={cn(CAJA_CONTROL, 'relative px-0!', error ? 'border-peligro/70' : 'border-borde-fuerte hover:border-tenue/60', resto.disabled && 'opacity-60')}>
                <select
                    ref={ref}
                    id={campoId}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={idsDescripcion(campoId, error, ayuda)}
                    className={cn('h-full min-w-0 flex-1 cursor-pointer appearance-none self-stretch rounded-campo bg-transparent py-2 pr-9 pl-3 outline-none', TEXTO_CONTROL, className)}
                    {...resto}
                >
                    {marcador !== undefined && <option value="">{marcador}</option>}
                    {opciones?.map((opcion) => (
                        <option key={opcion.valor} value={opcion.valor} disabled={opcion.deshabilitada}>
                            {opcion.etiqueta}
                        </option>
                    ))}
                    {children}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 size-4 text-tenue" aria-hidden="true" />
            </div>
        </EnvolturaCampo>
    );
}
