import { Link } from '@inertiajs/react';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { Aparecer } from '@/components/ui/Aparecer';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { diasRestantes, fechaCorta, plural } from '@/lib/formato';
import type { Cuenta } from '@/types';

/** Cuántas cuentas se listan antes de mandar a la pantalla de cuentas. */
const MAXIMO = 6;

/** Cuentas vigentes a las que les quedan pocos días, con los días restantes como dato principal de cada renglón. */
export function PorVencer({ cuentas, className }: { cuentas: Cuenta[]; className?: string }) {
    const visibles = cuentas.slice(0, MAXIMO);
    const restantes = cuentas.length - visibles.length;

    return (
        <Tarjeta
            className={cn('flex flex-col', className)}
            relleno="ninguno"
            titulo="Por vencer"
            descripcion={cuentas.length > 0 ? `${plural(cuentas.length, 'cuenta')} con pocos días de vigencia` : 'Cuentas a las que les quedan pocos días'}
        >
            {cuentas.length === 0 ? (
                <EstadoVacio className="my-auto" compacto icono={<CalendarCheck className="size-5" />} titulo="Nada por vencer" descripcion="Ninguna cuenta vigente vence en los próximos días." />
            ) : (
                <>
                    <ul className="border-t border-borde">
                        {visibles.map((cuenta, indice) => {
                            const urgente = cuenta.dias_restantes <= 3;

                            return (
                                <Aparecer como="li" key={cuenta.id} indice={indice} className="border-b border-borde/70 last:border-b-0">
                                    <Link
                                        href={`/cuentas?estado=activas&q=${encodeURIComponent(cuenta.email)}`}
                                        aria-label={`${cuenta.email}: ${diasRestantes(cuenta.dias_restantes)}, ${plural(cuenta.ocupados, 'cliente')}`}
                                        className="group flex items-center gap-3.5 px-5 py-3 transition-colors duration-100 hover:bg-superficie-2/70 focus-visible:-outline-offset-2 sm:px-6"
                                    >
                                        <span
                                            className={cn(
                                                'flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-campo border',
                                                urgente ? 'border-peligro/40 bg-peligro/10 text-peligro' : 'border-alerta/35 bg-alerta/10 text-alerta',
                                            )}
                                            aria-hidden="true"
                                        >
                                            {cuenta.dias_restantes <= 0 ? (
                                                <span className="font-titulo text-sm font-semibold">Hoy</span>
                                            ) : (
                                                <>
                                                    <span className="cifras font-titulo text-lg leading-none font-semibold">{cuenta.dias_restantes}</span>
                                                    <span className="mt-0.5 text-[10px] leading-none font-medium tracking-wide uppercase">{cuenta.dias_restantes === 1 ? 'día' : 'días'}</span>
                                                </>
                                            )}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium text-texto">{cuenta.email}</span>
                                            <span className="mt-0.5 block truncate text-xs text-tenue">
                                                {cuenta.dias_restantes <= 0 ? 'Vence hoy' : `Vence el ${fechaCorta(cuenta.expires_on)}`} · {plural(cuenta.ocupados, 'cliente')}
                                            </span>
                                        </span>
                                        <ChevronRight className="size-4 shrink-0 text-tenue transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-acento" aria-hidden="true" />
                                    </Link>
                                </Aparecer>
                            );
                        })}
                    </ul>
                    {restantes > 0 && (
                        <p className="mt-auto border-t border-borde px-5 py-3 text-[13px] sm:px-6">
                            <Link href="/cuentas?estado=activas" className="font-medium text-acento hover:text-acento-fuerte">
                                Ver {restantes === 1 ? 'la otra cuenta' : `las otras ${restantes} cuentas`} por vencer
                            </Link>
                        </p>
                    )}
                </>
            )}
        </Tarjeta>
    );
}
