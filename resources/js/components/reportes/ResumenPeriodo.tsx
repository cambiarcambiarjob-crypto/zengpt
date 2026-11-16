import { Megaphone, PiggyBank, ReceiptText } from 'lucide-react';
import type { ReactNode } from 'react';
import { Cifra } from '@/components/ui/Cifra';
import { TarjetaFoco } from '@/components/ui/TarjetaFoco';
import { cn } from '@/lib/cn';
import { dinero, plural } from '@/lib/formato';
import type { Totales } from '@/types';
import { COLOR_SERIE } from './colores';
import { useEntrada } from './entrada';
import { porciento, proporcion } from './periodos';

export interface ResumenPeriodoProps {
    totales: Totales;
    /** Días que cubre el rango (para el promedio diario). */
    dias: number;
    /** Nombre del dueño según el catálogo de vendedores («Leo»). */
    dueno: string;
    /** true = quien mira es el dueño; false = el socio. Resalta «su» parte. */
    esAdmin: boolean;
    porcentajeSocio: number;
    className?: string;
}

function Operador({ children }: { children: ReactNode }) {
    return (
        <span className="mt-7 hidden font-titulo text-2xl leading-none font-medium text-tenue select-none sm:block" aria-hidden="true">
            {children}
        </span>
    );
}

interface Tramo {
    clave: string;
    valor: number;
    color: string;
}

/** Barra de una sola pieza partida en tramos proporcionales, con 2 px de aire entre ellos. Decorativa: los montos van escritos al lado. */
function BarraPartida({ tramos, listo }: { tramos: Tramo[]; listo: boolean }) {
    const visibles = tramos.filter((tramo) => tramo.valor > 0);

    if (visibles.length === 0) return <div className="h-2 rounded-full bg-superficie-3" aria-hidden="true" />;

    return (
        <div className="flex h-2 gap-0.5" aria-hidden="true">
            {visibles.map((tramo, indice) => (
                <span key={tramo.clave} className="h-full min-w-1 overflow-hidden rounded-full" style={{ flexGrow: tramo.valor, flexBasis: 0 }}>
                    <span
                        className="block h-full w-full rounded-full transition-transform duration-700 ease-suave"
                        style={{ backgroundColor: tramo.color, transform: listo ? 'translateX(0)' : 'translateX(-101%)', transitionDelay: `${indice * 90}ms` }}
                    />
                </span>
            ))}
        </div>
    );
}

// El tramo de quien mira va en jade; los otros dos, en grises de dos pasos (el nombre y el monto están justo debajo).
const TONO_TRAMO = { propio: '#34d8a6', claro: '#a4b1ac', hondo: '#5d6b66' } as const;

// Los números grandes se ajustan al ancho de su columna: un paso menos en celular (dos por renglón) y uno más en pantallas muy anchas.
const CIFRA_PRINCIPAL = 'max-sm:[&_.font-titulo]:text-2xl 2xl:[&_.font-titulo]:text-4xl';

/**
 * Las seis cifras del periodo en dos tarjetas con la luz de SpotlightCard y el conteo de CountUp (React Bits):
 * ventas − publicidad = neto, y cómo se reparte ese neto entre socio, vendedores y dueño.
 */
export function ResumenPeriodo({ totales, dias, dueno, esAdmin, porcentajeSocio, className }: ResumenPeriodoProps) {
    const listo = useEntrada();
    const hayVentas = totales.ventas_count > 0;
    const ticket = hayVentas ? Math.round(totales.ventas / totales.ventas_count) : 0;
    const repartible = totales.neto > 0;
    const dePublicidad = proporcion(totales.publicidad, totales.ventas);

    const partes = [
        { clave: 'socio', nombre: `Socio (${porciento(porcentajeSocio)})`, valor: totales.socio, propia: !esAdmin, detalle: `${porciento(porcentajeSocio)} del neto` },
        { clave: 'vendedor', nombre: 'Vendedores', valor: totales.vendedor, propia: false, detalle: repartible ? `${porciento(proporcion(totales.vendedor, totales.neto))} del neto` : 'Su mitad del resto' },
        { clave: 'dueno', nombre: dueno, valor: totales.dueno, propia: esAdmin, detalle: repartible ? `${porciento(proporcion(totales.dueno, totales.neto))} del neto` : 'El resto' },
    ].map((parte, indice, lista) => ({
        ...parte,
        color: parte.propia ? TONO_TRAMO.propio : lista.slice(0, indice).some((previa) => !previa.propia) ? TONO_TRAMO.hondo : TONO_TRAMO.claro,
    }));

    return (
        <div className={cn('grid grid-cols-1 gap-4 xl:grid-cols-12', className)}>
            <TarjetaFoco className="xl:col-span-7">
                <div className="grid grid-cols-2 items-start gap-x-4 gap-y-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <Cifra
                        className={cn('col-span-2 sm:col-span-1', '2xl:[&_.font-titulo]:text-4xl')}
                        etiqueta="Ventas"
                        icono={<ReceiptText className="size-4" />}
                        valor={totales.ventas}
                        detalle={hayVentas ? `${plural(totales.ventas_count, 'venta')} · ${dinero(ticket)} en promedio` : 'Sin ventas en el periodo'}
                    />
                    <Operador>−</Operador>
                    <Cifra
                        className={CIFRA_PRINCIPAL}
                        etiqueta="Publicidad"
                        icono={<Megaphone className="size-4" />}
                        valor={totales.publicidad}
                        tono="suave"
                        detalle={totales.ventas > 0 ? `${porciento(dePublicidad)} de lo vendido` : totales.publicidad > 0 ? 'Sin ventas que la cubran' : 'Sin gasto capturado'}
                    />
                    <Operador>=</Operador>
                    <Cifra
                        className={CIFRA_PRINCIPAL}
                        etiqueta="Neto"
                        icono={<PiggyBank className="size-4" />}
                        valor={totales.neto}
                        tono="acento"
                        negativoEnRojo
                        detalle={totales.neto < 0 ? 'Se gastó más de lo que se vendió' : dias > 1 ? `${dinero(Math.round(totales.neto / dias))} por día en promedio` : 'Ventas menos publicidad'}
                    />
                </div>

                {/* De cada peso vendido, cuánto se fue en publicidad y cuánto quedó. */}
                <div className="mt-6 border-t border-borde/70 pt-4">
                    <BarraPartida
                        listo={listo}
                        tramos={[
                            { clave: 'publicidad', valor: totales.publicidad, color: COLOR_SERIE.publicidad },
                            { clave: 'neto', valor: Math.max(0, totales.neto), color: COLOR_SERIE.neto },
                        ]}
                    />
                    <p className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-suave">
                        {totales.ventas > 0 && totales.neto >= 0 ? (
                            <>
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_SERIE.publicidad }} aria-hidden="true" />
                                    Publicidad: ${dePublicidad} de cada $100 vendidos
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_SERIE.neto }} aria-hidden="true" />
                                    Neto: ${100 - dePublicidad} de cada $100
                                </span>
                            </>
                        ) : totales.neto < 0 ? (
                            'La publicidad superó a las ventas del periodo.'
                        ) : (
                            'Sin ventas ni publicidad en el periodo.'
                        )}
                    </p>
                </div>
            </TarjetaFoco>

            <TarjetaFoco className="xl:col-span-5" titulo="Reparto del neto" descripcion={`${dinero(totales.neto, { mxn: true })} entre socio, vendedores y ${dueno}`}>
                <BarraPartida listo={listo} tramos={repartible ? partes : []} />

                <div className="mt-5 grid grid-cols-3 gap-x-4">
                    {partes.map((parte) => (
                        <Cifra
                            key={parte.clave}
                            etiqueta={parte.propia ? `${parte.nombre} · tú` : parte.nombre}
                            icono={<span className="block size-2 rounded-full" style={{ backgroundColor: parte.color }} />}
                            valor={parte.valor}
                            tamano="sm"
                            tono={parte.propia ? 'acento' : 'normal'}
                            negativoEnRojo
                            detalle={parte.detalle}
                            className="max-sm:[&_.font-titulo]:text-lg"
                        />
                    ))}
                </div>

                {totales.neto < 0 && <p className="mt-4 text-[13px] leading-snug text-tenue">Con neto negativo, la pérdida se reparte en la misma proporción que la ganancia.</p>}
            </TarjetaFoco>
        </div>
    );
}
