import { Trophy, Users } from 'lucide-react';
import { useMemo } from 'react';
import ShinyText from '@/components/reactbits/ShinyText';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Insignia } from '@/components/ui/Insignia';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { dinero, plural } from '@/lib/formato';
import type { FilaVendedor, Totales } from '@/types';
import { COLOR_SERIE } from './colores';
import { useEntrada } from './entrada';
import { porciento, proporcion } from './periodos';

export interface RankingVendedoresProps {
    filas: FilaVendedor[];
    totales: Totales;
    /** Nombre del dueño («Leo») para la nota del reparto. */
    dueno: string;
    porcentajeSocio: number;
    porcentajeVendedor: number;
    className?: string;
}

const REJILLA = 'md:grid md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_5.5rem_5.5rem_6rem] md:items-center md:gap-x-6';

/** Barra fina que se desliza desde la izquierda hasta su porcentaje (solo `transform`: no mueve nada alrededor). */
function Barra({ porcentaje, color, listo, retraso, gruesa = false }: { porcentaje: number; color: string; listo: boolean; retraso: number; gruesa?: boolean }) {
    const ancho = porcentaje > 0 ? Math.max(1.5, Math.min(100, porcentaje)) : 0;

    return (
        <span className={cn('block overflow-hidden rounded-full', gruesa ? 'h-2 bg-superficie-3' : 'h-1')}>
            {ancho > 0 && (
                <span
                    className="block h-full rounded-full transition-transform duration-700 ease-suave"
                    style={{ backgroundColor: color, width: '100%', transform: `translateX(${listo ? ancho - 100 : -100}%)`, transitionDelay: `${retraso}ms` }}
                />
            )}
        </span>
    );
}

function Monto({ centavos, fuerte = false }: { centavos: number; fuerte?: boolean }) {
    return <span className={cn(centavos < 0 ? 'text-peligro' : fuerte ? 'text-texto' : 'text-suave', fuerte && 'font-semibold')}>{dinero(centavos)}</span>;
}

/**
 * Ranking del periodo: un renglón por vendedor, ordenado por monto vendido, con su barra (y la de publicidad a la misma
 * escala), el número de ventas, el neto y lo que le toca. «¿Cuánto ha vendido Jorge?» se contesta de un vistazo.
 */
export function RankingVendedores({ filas, totales, dueno, porcentajeSocio, porcentajeVendedor, className }: RankingVendedoresProps) {
    const listo = useEntrada();
    const ordenadas = useMemo(() => [...filas].sort((a, b) => b.ventas - a.ventas || b.ventas_count - a.ventas_count || b.neto - a.neto), [filas]);
    const tope = Math.max(1, ...filas.map((fila) => Math.max(fila.ventas, fila.publicidad)));
    const mitad = porcentajeVendedor === 50 ? 'la mitad' : porciento(porcentajeVendedor);

    return (
        <Tarjeta className={className} relleno="ninguno" titulo="Ranking de vendedores" descripcion="Ordenado por monto vendido en el periodo">
            {ordenadas.length === 0 ? (
                <EstadoVacio compacto icono={<Users className="size-5" />} titulo="Sin vendedores con movimiento" descripcion="En este periodo no hay ventas ni publicidad capturadas." />
            ) : (
                <>
                    {/* Rótulos de columna (solo escritorio y solo visuales: cada dato lleva su etiqueta para lectores de pantalla). */}
                    <div className={cn('hidden border-y border-borde px-5 py-2.5 text-[11px] font-semibold tracking-wider text-tenue uppercase sm:px-6', REJILLA)} aria-hidden="true">
                        <span>Vendedor</span>
                        <span>Vendido</span>
                        <span className="text-right">Publicidad</span>
                        <span className="text-right">Neto</span>
                        <span className="text-right">Su parte</span>
                    </div>

                    <ol className="max-md:border-t max-md:border-borde">
                        {ordenadas.map((fila, indice) => {
                            const lider = indice === 0 && fila.ventas > 0;
                            const parte = fila.is_owner ? fila.dueno : fila.vendedor;

                            return (
                                <li key={fila.seller_id} className={cn('border-b border-borde/70 px-5 py-4 last:border-b-0 sm:px-6 md:py-3.5', REJILLA)}>
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span
                                            className={cn(
                                                'cifras flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                                                lider ? 'border-acento/40 bg-acento/10 text-acento' : 'border-borde-fuerte bg-superficie-2 text-suave',
                                            )}
                                        >
                                            <span className="sr-only">Lugar </span>
                                            {indice + 1}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="flex min-w-0 items-center gap-2">
                                                {lider ? (
                                                    <ShinyText text={fila.name} color="#e8eeeb" shineColor="#34d8a6" speed={2.2} delay={6} className="truncate text-sm font-semibold" />
                                                ) : (
                                                    <span className="truncate text-sm font-medium text-texto">{fila.name}</span>
                                                )}
                                                {lider && (
                                                    <Insignia estado="acento" tamano="sm" sinPunto>
                                                        <Trophy className="size-3" aria-hidden="true" />
                                                        Líder
                                                    </Insignia>
                                                )}
                                            </p>
                                            <p className="cifras mt-0.5 truncate text-xs text-tenue">
                                                {fila.ventas_count === 0 ? 'Sin ventas' : plural(fila.ventas_count, 'venta')}
                                                {fila.is_owner && ' · dueño'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="min-w-0 max-md:mt-3">
                                        <p className="flex items-baseline justify-between gap-3">
                                            <span className="cifras font-titulo text-lg leading-none font-semibold text-texto">
                                                <span className="sr-only">Vendido: </span>
                                                {dinero(fila.ventas)}
                                            </span>
                                            <span className="cifras text-xs whitespace-nowrap text-tenue">{totales.ventas > 0 ? `${porciento(proporcion(fila.ventas, totales.ventas))} del total` : ''}</span>
                                        </p>
                                        <span className="mt-2 flex flex-col gap-1" aria-hidden="true">
                                            <Barra gruesa porcentaje={(fila.ventas / tope) * 100} color={COLOR_SERIE.ventas} listo={listo} retraso={indice * 60} />
                                            <Barra porcentaje={(fila.publicidad / tope) * 100} color={COLOR_SERIE.publicidad} listo={listo} retraso={indice * 60 + 80} />
                                        </span>
                                    </div>

                                    <dl className="cifras grid grid-cols-3 gap-x-4 text-sm max-md:mt-3 md:contents">
                                        <div className="min-w-0 md:text-right">
                                            <dt className="text-xs text-tenue md:sr-only">Publicidad</dt>
                                            <dd className="max-md:mt-0.5">
                                                <Monto centavos={-fila.publicidad} />
                                            </dd>
                                        </div>
                                        <div className="min-w-0 md:text-right">
                                            <dt className="text-xs text-tenue md:sr-only">Neto</dt>
                                            <dd className="max-md:mt-0.5">
                                                <Monto centavos={fila.neto} fuerte />
                                            </dd>
                                        </div>
                                        <div className="min-w-0 md:text-right">
                                            <dt className="text-xs text-tenue md:sr-only">Su parte</dt>
                                            <dd className="max-md:mt-0.5">
                                                <Monto centavos={parte} fuerte />
                                            </dd>
                                        </div>
                                    </dl>
                                </li>
                            );
                        })}
                    </ol>

                    <div className="flex flex-col gap-2 border-t border-borde px-5 py-3.5 text-xs leading-relaxed text-tenue sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                        <ul className="flex shrink-0 items-center gap-4">
                            <li className="flex items-center gap-1.5">
                                <span className="h-2 w-3.5 rounded-full" style={{ backgroundColor: COLOR_SERIE.ventas }} aria-hidden="true" />
                                Vendido
                            </li>
                            <li className="flex items-center gap-1.5">
                                <span className="h-1 w-3.5 rounded-full" style={{ backgroundColor: COLOR_SERIE.publicidad }} aria-hidden="true" />
                                Publicidad (misma escala)
                            </li>
                        </ul>
                        <p className="lg:text-right">
                            Su parte: {mitad} de lo que queda de sus ventas tras la publicidad y el {porciento(porcentajeSocio)} del socio. Cuando vende {dueno}, ese resto es todo suyo.
                        </p>
                    </div>
                </>
            )}
        </Tarjeta>
    );
}
