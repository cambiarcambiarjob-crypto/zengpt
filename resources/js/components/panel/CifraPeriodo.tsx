import type { ReactNode } from 'react';
import { Cifra } from '@/components/ui/Cifra';
import { TarjetaFoco } from '@/components/ui/TarjetaFoco';
import { dinero, plural } from '@/lib/formato';
import type { Totales } from '@/types';

export interface CifraPeriodoProps {
    /** «Ganancia del mes», «Ganancia histórica». */
    etiqueta: string;
    /** A qué periodo corresponde («1 – 16 nov», «Desde el inicio»). */
    periodo: ReactNode;
    icono?: ReactNode;
    totales: Totales;
    className?: string;
}

/** Ganancia neta de un periodo en una tarjeta destacada (SpotlightCard), con las ventas y la publicidad que la forman. */
export function CifraPeriodo({ etiqueta, periodo, icono, totales, className }: CifraPeriodoProps) {
    return (
        <TarjetaFoco className={className}>
            <div className="flex h-full flex-col">
                <Cifra etiqueta={etiqueta} icono={icono} valor={totales.neto} tamano="lg" negativoEnRojo detalle={periodo} />
                <dl className="mt-5 grid grid-cols-2 gap-x-4 border-t border-borde/70 pt-4 text-[13px]">
                    <div className="min-w-0">
                        <dt className="text-tenue">Ventas</dt>
                        <dd className="cifras mt-0.5 font-semibold text-texto">{dinero(totales.ventas)}</dd>
                        <dd className="text-xs text-tenue">{plural(totales.ventas_count, 'venta')}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-tenue">Publicidad</dt>
                        <dd className="cifras mt-0.5 font-semibold text-texto">{dinero(-totales.publicidad)}</dd>
                    </div>
                </dl>
            </div>
        </TarjetaFoco>
    );
}
