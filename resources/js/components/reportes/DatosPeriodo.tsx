import { Link } from '@inertiajs/react';
import { CalendarCheck2, CalendarHeart, Megaphone, Tag, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { dinero, fechaCorta, plural } from '@/lib/formato';
import type { DiaSerie, Totales } from '@/types';
import { porciento, proporcion } from './periodos';

export interface DatosPeriodoProps {
    totales: Totales;
    serie: DiaSerie[];
    /** Días que cubre el rango pedido. */
    dias: number;
    className?: string;
}

function Dato({ icono, etiqueta, valor, detalle }: { icono: ReactNode; etiqueta: string; valor: ReactNode; detalle?: ReactNode }) {
    return (
        <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-campo border border-borde bg-superficie-2 text-tenue" aria-hidden="true">
                {icono}
            </span>
            <div className="min-w-0 flex-1">
                <dt className="truncate text-[13px] text-suave">{etiqueta}</dt>
                {detalle && <dd className="cifras truncate text-xs text-tenue">{detalle}</dd>}
            </div>
            <dd className="cifras shrink-0 text-right font-titulo text-base font-semibold text-texto">{valor}</dd>
        </div>
    );
}

const SIN_DATO = (
    <span className="relative text-tenue">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sin dato</span>
    </span>
);

/** Indicadores que salen de las mismas cifras del reporte: precio promedio, ritmo diario, mejor día y costo de publicidad. */
export function DatosPeriodo({ totales, serie, dias, className }: DatosPeriodoProps) {
    const hayVentas = totales.ventas_count > 0;
    const mejor = serie.reduce<DiaSerie | null>((maximo, dia) => (dia.ventas > (maximo?.ventas ?? 0) ? dia : maximo), null);
    const diasConVenta = serie.filter((dia) => dia.ventas_count > 0).length;
    const porDia = totales.ventas_count / Math.max(1, dias);

    return (
        <Tarjeta className={className} titulo="Datos del periodo" descripcion={`${plural(dias, 'día')} · calculados con las cifras del reporte`}>
            <dl className="divide-y divide-borde/70">
                <Dato icono={<Tag className="size-4" />} etiqueta="Precio promedio" detalle="Por venta" valor={hayVentas ? dinero(Math.round(totales.ventas / totales.ventas_count)) : SIN_DATO} />
                <Dato
                    icono={<TrendingUp className="size-4" />}
                    etiqueta="Vendido por día"
                    detalle={hayVentas ? `${porDia >= 10 ? Math.round(porDia) : porDia.toFixed(1)} ventas al día` : 'Sin ventas'}
                    valor={dinero(Math.round(totales.ventas / Math.max(1, dias)))}
                />
                <Dato
                    icono={<CalendarHeart className="size-4" />}
                    etiqueta="Mejor día"
                    detalle={
                        mejor ? (
                            <Link href={`/dia/${mejor.fecha}`} className="rounded-sm text-suave underline decoration-borde-fuerte underline-offset-2 transition-colors hover:text-texto hover:decoration-tenue">
                                {fechaCorta(mejor.fecha)} · {plural(mejor.ventas_count, 'venta')}
                            </Link>
                        ) : (
                            'Sin ventas'
                        )
                    }
                    valor={mejor ? dinero(mejor.ventas) : SIN_DATO}
                />
                <Dato icono={<CalendarCheck2 className="size-4" />} etiqueta="Días con ventas" detalle={`${porciento(proporcion(diasConVenta, serie.length))} de los días`} valor={`${diasConVenta} de ${serie.length}`} />
                <Dato
                    icono={<Megaphone className="size-4" />}
                    etiqueta="Publicidad por venta"
                    detalle={totales.ventas > 0 ? `${porciento(proporcion(totales.publicidad, totales.ventas))} de lo vendido` : 'Sin ventas'}
                    valor={hayVentas ? dinero(Math.round(totales.publicidad / totales.ventas_count)) : SIN_DATO}
                />
            </dl>
        </Tarjeta>
    );
}
