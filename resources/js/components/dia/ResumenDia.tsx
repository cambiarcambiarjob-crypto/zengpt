import { Megaphone, Server, TrendingUp } from 'lucide-react';
import { FondoAurora } from '@/components/fondos/FondoAurora';
import CountUp from '@/components/reactbits/CountUp';
import { Cifra } from '@/components/ui/Cifra';
import { Insignia } from '@/components/ui/Insignia';
import { TarjetaFoco } from '@/components/ui/TarjetaFoco';
import { cn } from '@/lib/cn';
import { dinero, plural } from '@/lib/formato';
import type { Totales } from '@/types';
import { BarraReparto, MuestraReparto, type SegmentoReparto } from './BarraReparto';
import { porciento, type ParteReparto } from './utilidades';

/** Un destino del neto: muestra de color, nombre y monto con conteo animado (CountUp de React Bits). */
function Parte({ parte, nombre, detalle, centavos, mio = false }: { parte: ParteReparto; nombre: string; detalle: string; centavos: number; mio?: boolean }) {
    const absoluto = Math.abs(centavos);

    return (
        <div className="flex items-center gap-3 border-t border-borde/70 py-3 first:border-t-0 last:pb-0">
            <dt className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-texto">
                    <MuestraReparto parte={parte} />
                    <span className="truncate">{nombre}</span>
                    {mio && (
                        <Insignia estado="acento" tamano="sm" sinPunto>
                            Tú
                        </Insignia>
                    )}
                </span>
                <span className="mt-0.5 block truncate pl-[1.125rem] text-xs text-tenue">{detalle}</span>
            </dt>
            <dd className={cn('cifras font-titulo text-xl leading-none font-semibold tracking-tight whitespace-nowrap', centavos < 0 ? 'text-peligro' : mio ? 'text-acento' : 'text-texto')}>
                <span className="sr-only">{dinero(centavos)}</span>
                <span aria-hidden="true">
                    <CountUp to={absoluto / 100} duration={0.9} easing="expo" separator="," decimals={absoluto % 100 !== 0 ? 2 : 0} prefix={`${centavos < 0 ? '−' : ''}$`} />
                </span>
            </dd>
        </div>
    );
}

export interface ResumenDiaProps {
    totales: Totales;
    esHoy: boolean;
    /** Nombre del dueño para rotular su parte. */
    nombreDueno: string;
    porcentajeSocio: number;
    /** true = quien mira es el dueño; false = el socio. Marca «su» parte del reparto. */
    esAdmin: boolean;
    className?: string;
}

/**
 * Resumen del cierre: a la izquierda la cuenta del día (ventas − publicidad − costo de cuentas = neto, la cifra que manda) y a la derecha
 * cómo se reparte ese neto (socio, vendedores y dueño). Las cifras cuentan desde el valor anterior al cambiar de día
 * o al guardar (CountUp de React Bits); la aurora del encabezado es decorativa y se descarga aparte.
 */
export function ResumenDia({ totales, esHoy, nombreDueno, porcentajeSocio, esAdmin, className }: ResumenDiaProps) {
    const sinMovimiento = totales.ventas_count === 0 && totales.publicidad === 0;
    const segmentos: SegmentoReparto[] = [
        { parte: 'socio', nombre: 'Socio', centavos: totales.socio },
        { parte: 'vendedor', nombre: 'Vendedores', centavos: totales.vendedor },
        { parte: 'dueno', nombre: nombreDueno, centavos: totales.dueno },
    ];

    return (
        <div className={cn('grid grid-cols-1 gap-4 xl:grid-cols-12', className)}>
            <section aria-label="Cuenta del día" className="relative isolate min-w-0 overflow-hidden rounded-tarjeta border border-borde bg-superficie shadow-tarjeta xl:col-span-7">
                {/* Adorno recortado hacia la derecha: nunca queda debajo de un número. */}
                <div className="pointer-events-none absolute -top-24 -right-20 -z-10 size-72 rounded-full bg-acento/8 blur-3xl" aria-hidden="true" />
                <FondoAurora
                    alto={0.6}
                    opacidad={0.5}
                    className="-z-10 max-sm:[mask-image:linear-gradient(to_bottom_left,black,transparent_50%)] sm:[mask-image:linear-gradient(to_right,transparent_38%,black_92%)]"
                />

                <div className="flex h-full flex-col p-5 sm:p-7">
                    <Cifra
                        etiqueta={esHoy ? 'Neto de hoy' : 'Neto del día'}
                        valor={totales.neto}
                        tamano="xl"
                        tono={totales.neto > 0 ? 'acento' : 'normal'}
                        negativoEnRojo
                        detalle={
                            sinMovimiento
                                ? esHoy
                                    ? 'Aún no hay ventas ni publicidad capturadas hoy.'
                                    : 'Este día no tuvo ventas ni publicidad.'
                                : totales.neto < 0
                                  ? 'Los gastos superaron a las ventas: la pérdida se reparte igual que la ganancia.'
                                  : 'Ventas menos publicidad y costo de cuentas: lo que se reparte.'
                        }
                    />

                    <div className="mt-auto flex flex-wrap gap-x-12 gap-y-5 pt-7 sm:pt-9">
                        <Cifra etiqueta="Ventas" icono={<TrendingUp className="size-4" />} valor={totales.ventas} tamano="md" detalle={plural(totales.ventas_count, 'venta')} />
                        <Cifra
                            etiqueta="Publicidad"
                            icono={<Megaphone className="size-4" />}
                            valor={totales.publicidad === 0 ? 0 : -totales.publicidad}
                            tamano="md"
                            detalle={totales.publicidad > 0 ? 'Se resta de las ventas' : 'Sin gasto capturado'}
                        />
                        <Cifra
                            etiqueta="Costo de cuentas"
                            icono={<Server className="size-4" />}
                            valor={totales.costo === 0 ? 0 : -totales.costo}
                            tamano="md"
                            detalle={totales.ventas_count > 0 ? `${dinero(Math.round(totales.costo / totales.ventas_count))} por espacio vendido` : 'Sin espacios vendidos'}
                        />
                    </div>
                </div>
            </section>

            <TarjetaFoco
                className="xl:col-span-5 [&>div]:flex [&>div]:h-full [&>div]:flex-col"
                titulo="Cómo se reparte"
                descripcion={totales.neto > 0 ? `${dinero(totales.neto)} entre el socio, los vendedores y ${nombreDueno}` : 'Socio, vendedores y dueño'}
            >
                <BarraReparto segmentos={segmentos} />

                <dl className="mt-auto pt-4">
                    <Parte parte="socio" nombre={`Socio · ${porciento(porcentajeSocio)}`} detalle={`${porciento(porcentajeSocio)} del neto de cada vendedor`} centavos={totales.socio} mio={!esAdmin} />
                    <Parte parte="vendedor" nombre="Vendedores" detalle="Su parte de lo que vendieron" centavos={totales.vendedor} />
                    <Parte parte="dueno" nombre={nombreDueno} detalle="Su parte y sus propias ventas" centavos={totales.dueno} mio={esAdmin} />
                </dl>
            </TarjetaFoco>
        </div>
    );
}
