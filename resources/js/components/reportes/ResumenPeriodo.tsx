import { Megaphone, PiggyBank, ReceiptText } from 'lucide-react';
import type { ReactNode } from 'react';
import { Cifra } from '@/components/ui/Cifra';
import { TarjetaFoco } from '@/components/ui/TarjetaFoco';
import { cn } from '@/lib/cn';
import { dinero, plural } from '@/lib/formato';
import type { Totales } from '@/types';
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
        <span className="hidden self-center font-titulo text-2xl font-medium text-tenue select-none sm:block" aria-hidden="true">
            {children}
        </span>
    );
}

// El tramo de quien mira va en jade; los otros dos, en grises de dos pasos (el nombre y el monto están justo debajo).
const TONO_TRAMO = { propio: '#34d8a6', claro: '#a4b1ac', hondo: '#5d6b66' } as const;

/**
 * Las seis cifras del periodo en dos tarjetas con la luz de SpotlightCard y el conteo de CountUp (React Bits):
 * ventas − publicidad = neto, y cómo se reparte ese neto entre socio, vendedores y dueño.
 */
export function ResumenPeriodo({ totales, dias, dueno, esAdmin, porcentajeSocio, className }: ResumenPeriodoProps) {
    const listo = useEntrada();
    const hayVentas = totales.ventas_count > 0;
    const ticket = hayVentas ? Math.round(totales.ventas / totales.ventas_count) : 0;
    const repartible = totales.neto > 0;

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
                {/* En celular, Publicidad y Neto comparten renglón: bajan un tamaño para caber sin recortarse. */}
                <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <Cifra
                        className="col-span-2 sm:col-span-1"
                        etiqueta="Ventas"
                        icono={<ReceiptText className="size-4" />}
                        valor={totales.ventas}
                        tamano="lg"
                        detalle={hayVentas ? `${plural(totales.ventas_count, 'venta')} · ${dinero(ticket)} en promedio` : 'Sin ventas en el periodo'}
                    />
                    <Operador>−</Operador>
                    <Cifra
                        etiqueta="Publicidad"
                        icono={<Megaphone className="size-4" />}
                        valor={totales.publicidad}
                        tamano="lg"
                        tono="suave"
                        className="max-sm:[&>p:nth-child(2)]:text-[1.75rem]"
                        detalle={totales.ventas > 0 ? `${porciento(proporcion(totales.publicidad, totales.ventas))} de lo vendido` : totales.publicidad > 0 ? 'Sin ventas que la cubran' : 'Sin gasto capturado'}
                    />
                    <Operador>=</Operador>
                    <Cifra
                        etiqueta="Neto"
                        icono={<PiggyBank className="size-4" />}
                        valor={totales.neto}
                        tamano="lg"
                        tono="acento"
                        negativoEnRojo
                        className="max-sm:[&>p:nth-child(2)]:text-[1.75rem]"
                        detalle={totales.neto < 0 ? 'Se gastó más de lo que se vendió' : dias > 1 ? `${dinero(Math.round(totales.neto / dias))} por día en promedio` : 'Ventas menos publicidad'}
                    />
                </div>
            </TarjetaFoco>

            <TarjetaFoco className="xl:col-span-5" titulo="Reparto del neto" descripcion={`${dinero(totales.neto, { mxn: true })} entre socio, vendedores y ${dueno}`}>
                {/* Barra de una sola pieza partida en tres: el ancho de cada tramo es su parte del neto. Decorativa: los montos van abajo. */}
                {repartible ? (
                    <div className="flex h-2 gap-0.5" aria-hidden="true">
                        {partes.map(
                            (parte) =>
                                parte.valor > 0 && (
                                    <span key={parte.clave} className="h-full min-w-1 overflow-hidden rounded-full" style={{ flexGrow: parte.valor, flexBasis: 0 }}>
                                        <span
                                            className="block h-full w-full origin-left rounded-full transition-transform duration-700 ease-suave"
                                            style={{ backgroundColor: parte.color, transform: listo ? 'scaleX(1)' : 'scaleX(0)' }}
                                        />
                                    </span>
                                ),
                        )}
                    </div>
                ) : (
                    <div className="h-2 rounded-full bg-superficie-3" aria-hidden="true" />
                )}

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
                        />
                    ))}
                </div>

                {!repartible && totales.neto < 0 && <p className="mt-4 text-[13px] leading-snug text-tenue">Con neto negativo, la pérdida se reparte en la misma proporción que la ganancia.</p>}
            </TarjetaFoco>
        </div>
    );
}
