import { Pencil, Phone, Plus, UserMinus } from 'lucide-react';
import { memo } from 'react';
import { cn } from '@/lib/cn';
import { dinero, fechaRelativa } from '@/lib/formato';
import type { Cuenta, Espacio } from '@/types';
import { Copiable } from './Copiable';

// Las casillas viven en la rejilla de TarjetaCuenta (un contenedor `@container`): angosta = 2 columnas (la ocupada usa las 2),
// mediana = 3 y ancha = los 5 espacios en fila.
const BOTON_ICONO =
    'flex size-7 shrink-0 items-center justify-center rounded-md text-tenue transition-colors duration-150 hover:bg-superficie-3 hover:text-texto pointer-coarse:size-10';

export interface CasillaOcupadaProps {
    cuenta: Cuenta;
    espacio: Espacio;
    hoy: string;
    /** El cliente coincide con la búsqueda: se resalta para encontrarlo de un vistazo. */
    resaltada?: boolean;
    alEditar: (cuenta: Cuenta, espacio: Espacio) => void;
    alLiberar: (cuenta: Cuenta, espacio: Espacio) => void;
}

/** Espacio con cliente: precio, Gmail y teléfono copiables, vendedor y fecha de venta. */
export const CasillaOcupada = memo(function CasillaOcupada({ cuenta, espacio, hoy, resaltada = false, alEditar, alLiberar }: CasillaOcupadaProps) {
    return (
        <li
            className={cn(
                'col-span-2 flex min-w-0 flex-col rounded-campo border p-3 transition-colors duration-200 @min-[36rem]:col-span-1',
                resaltada ? 'border-acento/60 bg-acento/8' : 'border-borde bg-superficie-2/60',
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2">
                    <span className="cifras flex size-5 shrink-0 items-center justify-center rounded-full bg-acento/15 text-[11px] font-semibold text-acento" title={`Espacio ${espacio.position}`}>
                        <span className="sr-only">Espacio </span>
                        {espacio.position}
                    </span>
                    <span className="cifras truncate text-[15px] leading-none font-semibold text-texto">{dinero(espacio.price_cents)}</span>
                </p>
                <div className="-my-1 -mr-1.5 flex shrink-0 items-center">
                    <button type="button" className={BOTON_ICONO} onClick={() => alEditar(cuenta, espacio)} title="Editar cliente" aria-label={`Editar cliente ${espacio.client_email}`}>
                        <Pencil className="size-3.5" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        className={cn(BOTON_ICONO, 'hover:bg-peligro/12! hover:text-peligro!')}
                        onClick={() => alLiberar(cuenta, espacio)}
                        title="Liberar espacio"
                        aria-label={`Liberar el espacio de ${espacio.client_email}`}
                    >
                        <UserMinus className="size-3.5" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div className="mt-2 flex min-w-0 flex-col items-start gap-0.5">
                <Copiable texto={espacio.client_email} etiqueta="Gmail del cliente" className="py-0.5 text-[13px] font-medium text-texto pointer-coarse:py-2" />
                {espacio.client_phone && (
                    <Copiable
                        texto={espacio.client_phone}
                        etiqueta="teléfono del cliente"
                        icono={<Phone className="size-3" />}
                        className="cifras py-0.5 text-xs text-suave pointer-coarse:py-2"
                    />
                )}
            </div>

            <p className="mt-auto truncate pt-2 text-xs text-tenue">
                <span className="text-suave">{espacio.seller_name ?? 'Sin vendedor'}</span>
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, vendido </span>
                <time dateTime={espacio.sold_on}>{fechaRelativa(espacio.sold_on, hoy)}</time>
            </p>
        </li>
    );
});

export interface CasillaLibreProps {
    cuenta: Cuenta;
    /** false en cuentas vencidas: el espacio se ve, pero no se ofrece agregar. */
    disponible: boolean;
    alAgregar: (cuenta: Cuenta) => void;
}

/** Espacio libre: un botón «Agregar cliente» (o un hueco inerte si la cuenta ya venció). */
export const CasillaLibre = memo(function CasillaLibre({ cuenta, disponible, alAgregar }: CasillaLibreProps) {
    if (!disponible) {
        return (
            <li className="flex min-h-14 min-w-0 items-center justify-center rounded-campo border border-dashed border-borde px-3 text-[13px] text-tenue @min-[36rem]:min-h-22">
                Sin cliente
            </li>
        );
    }

    return (
        <li className="min-w-0">
            <button
                type="button"
                data-libre
                onClick={() => alAgregar(cuenta)}
                aria-label={`Agregar cliente a ${cuenta.email}`}
                className={cn(
                    'group/libre flex h-full min-h-14 w-full items-center justify-center gap-2 rounded-campo border border-dashed border-acento/35 bg-acento/3 px-3 text-[13px] font-medium text-acento',
                    'transition-[background-color,border-color,transform] duration-150 hover:border-acento/80 hover:bg-acento/10 active:scale-[0.98] @min-[36rem]:min-h-22 @min-[36rem]:flex-col @min-[36rem]:gap-1.5',
                )}
            >
                <span className="flex size-6 items-center justify-center rounded-full bg-acento/12 transition-transform duration-200 ease-suave group-hover/libre:scale-110 group-hover/libre:bg-acento/20" aria-hidden="true">
                    <Plus className="size-3.5" />
                </span>
                Agregar cliente
            </button>
        </li>
    );
});
