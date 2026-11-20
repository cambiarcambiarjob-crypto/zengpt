import { Link } from '@inertiajs/react';
import { ChevronRight, Wallet } from 'lucide-react';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { dinero, diasEntre, fechaCorta, plural } from '@/lib/formato';
import type { ReportesProps } from '@/types';

export interface PagosVendedoresProps {
    pagos: ReportesProps['pagos'];
    hoy: string;
    className?: string;
}

/**
 * Lo que se le debe HOY a cada vendedor (su parte acumulada menos lo ya pagado), sin importar el periodo elegido.
 * Cada renglón lleva a la pantalla del vendedor: sus métricas por día y donde se registra el pago.
 */
export function PagosVendedores({ pagos, hoy, className }: PagosVendedoresProps) {
    if (pagos.length === 0) return null;

    const total = pagos.reduce((suma, pago) => suma + Math.max(0, pago.pendiente), 0);

    return (
        <Tarjeta
            className={className}
            relleno="ninguno"
            titulo={
                <span className="flex items-center gap-2">
                    <Wallet className="size-4 text-acento" aria-hidden="true" />
                    Pagos a vendedores
                </span>
            }
            descripcion={total > 0 ? `Por pagar hoy: ${dinero(total)} en total` : 'Todos al corriente'}
        >
            <ul className="grid grid-cols-1 border-t border-borde sm:grid-cols-2 xl:grid-cols-3">
                {pagos.map((pago) => {
                    const dias = pago.desde ? diasEntre(pago.desde, hoy) + 1 : 0;
                    const debe = pago.pendiente > 0;

                    return (
                        <li key={pago.seller_id} className="border-b border-borde/70 sm:border-r sm:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r xl:[&:nth-child(3n)]:border-r-0">
                            <Link
                                href={`/reportes/vendedores/${pago.seller_id}`}
                                className="group flex h-full items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-superficie-2/70 sm:px-6"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-2 text-sm font-medium text-texto">
                                        {pago.name}
                                        {!pago.active && <span className="text-xs font-normal text-tenue">(de baja)</span>}
                                    </p>
                                    <p className={cn('cifras mt-1 font-titulo text-xl leading-none font-semibold', debe ? 'text-alerta' : pago.pendiente < 0 ? 'text-peligro' : 'text-suave')}>
                                        <span className="sr-only">Por pagar: </span>
                                        {dinero(pago.pendiente)}
                                    </p>
                                    <p className="mt-1.5 truncate text-xs text-tenue">
                                        {debe && pago.desde
                                            ? `por pagar desde el ${fechaCorta(pago.desde)} · ${plural(dias, 'día')}`
                                            : pago.pendiente < 0
                                              ? 'saldo en contra (se descuenta del siguiente pago)'
                                              : 'al corriente'}
                                    </p>
                                    <p className="mt-0.5 truncate text-xs text-tenue">
                                        {pago.ultimo ? `Último pago: ${dinero(pago.ultimo.amount_cents)} el ${fechaCorta(pago.ultimo.paid_on)}` : 'Sin pagos registrados'}
                                    </p>
                                </div>
                                <ChevronRight className="size-4 shrink-0 text-tenue transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-suave" aria-hidden="true" />
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </Tarjeta>
    );
}
