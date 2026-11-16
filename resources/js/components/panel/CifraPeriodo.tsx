import type { ReactNode } from 'react';
import { Cifra } from '@/components/ui/Cifra';
import { TarjetaFoco } from '@/components/ui/TarjetaFoco';
import { cn } from '@/lib/cn';
import { dinero, plural } from '@/lib/formato';
import type { Totales } from '@/types';
import { porciento } from './texto';

export interface CifraPeriodoProps {
    /** «Ganancia del mes», «Ganancia histórica». */
    etiqueta: string;
    /** A qué periodo corresponde («Noviembre de 2026 · 1 – 16 nov», «Desde la primera venta»). */
    periodo: ReactNode;
    icono?: ReactNode;
    totales: Totales;
    /** Nombre del dueño para rotular su parte (si no se conoce, solo «Dueño»). */
    nombreDueno?: string;
    porcentajeSocio: number;
    /** true = quien mira es el dueño; false = el socio. Marca «su» renglón del reparto. */
    esAdmin: boolean;
    className?: string;
}

function Renglon({ etiqueta, detalle, centavos, mio = false, gasto = false }: { etiqueta: string; detalle?: string; centavos: number; mio?: boolean; gasto?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1">
            <dt className="min-w-0 truncate text-suave">
                {etiqueta}
                {detalle && <span className="text-tenue"> · {detalle}</span>}
            </dt>
            <dd className={cn('cifras whitespace-nowrap', centavos < 0 && !gasto ? 'text-peligro' : mio ? 'font-semibold text-acento' : 'font-medium text-texto')}>{dinero(centavos)}</dd>
        </div>
    );
}

/**
 * Ganancia neta de un periodo en una tarjeta destacada (SpotlightCard): de dónde sale (ventas menos publicidad)
 * y cómo se reparte (socio, vendedores y dueño).
 */
export function CifraPeriodo({ etiqueta, periodo, icono, totales, nombreDueno, porcentajeSocio, esAdmin, className }: CifraPeriodoProps) {
    return (
        // [&>div]: el contenedor con relleno de TarjetaFoco pasa a ser columna para anclar el reparto al fondo de la tarjeta.
        <TarjetaFoco className={cn('[&>div]:flex [&>div]:h-full [&>div]:flex-col', className)}>
            <Cifra etiqueta={etiqueta} icono={icono} valor={totales.neto} tamano="lg" negativoEnRojo detalle={periodo} />

            <div className="mt-auto pt-5 text-[13px]">
                <dl>
                    <Renglon etiqueta="Ventas" detalle={plural(totales.ventas_count, 'venta')} centavos={totales.ventas} />
                    <Renglon etiqueta="Publicidad" centavos={-totales.publicidad} gasto />
                </dl>
                <p className="mt-2 border-t border-borde/70 pt-2.5 text-[11px] font-semibold tracking-wider text-tenue uppercase">Cómo se reparte</p>
                <dl className="mt-1">
                    <Renglon etiqueta={`Socio (${porciento(porcentajeSocio)})`} detalle={esAdmin ? undefined : 'tú'} centavos={totales.socio} mio={!esAdmin} />
                    <Renglon etiqueta="Vendedores" centavos={totales.vendedor} />
                    <Renglon etiqueta={nombreDueno ? `${nombreDueno} (dueño)` : 'Dueño'} detalle={esAdmin ? 'tú' : undefined} centavos={totales.dueno} mio={esAdmin} />
                </dl>
            </div>
        </TarjetaFoco>
    );
}
