import { ChevronRight, Scale } from 'lucide-react';
import type { ReactNode } from 'react';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Insignia } from '@/components/ui/Insignia';
import { Tabla, type Columna } from '@/components/ui/Tabla';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { dinero, plural } from '@/lib/formato';
import type { FilaVendedor, Totales } from '@/types';
import { porciento } from './utilidades';

export interface RepartoDiaProps {
    filas: FilaVendedor[];
    totales: Totales;
    /** Nombre del dueño para rotular su columna. */
    nombreDueno: string;
    porcentajeSocio: number;
    porcentajeVendedor: number;
    /** true = quien mira es el dueño; false = el socio. Resalta la columna de «su» parte. */
    esAdmin: boolean;
    className?: string;
}

function Monto({ centavos, resaltar = false }: { centavos: number; resaltar?: boolean }) {
    return <span className={cn(centavos < 0 ? 'text-peligro' : resaltar && centavos > 0 ? 'font-semibold text-acento' : undefined)}>{dinero(centavos)}</span>;
}

function Vendido({ totales }: { totales: Pick<Totales, 'ventas' | 'ventas_count'> }) {
    return (
        <>
            <span className="block">{dinero(totales.ventas)}</span>
            <span className="block text-xs font-normal text-tenue">{plural(totales.ventas_count, 'venta')}</span>
        </>
    );
}

/** La parte del vendedor: el dueño no cobra comisión de vendedor (todo el resto ya es suyo). */
function ParteVendedor({ fila }: { fila: FilaVendedor }) {
    if (fila.is_owner) {
        return (
            <span className="text-tenue">
                <span aria-hidden="true">—</span>
                <span className="sr-only">No aplica: es el dueño</span>
            </span>
        );
    }

    return <Monto centavos={fila.vendedor} />;
}

function Nombre({ fila }: { fila: FilaVendedor }) {
    return (
        <span className="flex items-center gap-2">
            <span className="truncate font-medium text-texto">{fila.name}</span>
            {fila.is_owner && (
                <Insignia estado="acento" tamano="sm" sinPunto>
                    Dueño
                </Insignia>
            )}
        </span>
    );
}

function Par({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="truncate text-xs text-tenue">{etiqueta}</dt>
            <dd className="cifras mt-0.5 text-sm text-texto">{children}</dd>
        </div>
    );
}

const sinMovimiento = (fila: FilaVendedor) => fila.ventas_count === 0 && fila.publicidad === 0;

/** Columnas intermedias con menos relleno: la tabla completa cabe sin desplazarse en tableta y laptop. */
const APRETADA = 'max-xl:px-2.5!';

/**
 * Reparto del día por vendedor: ventas, publicidad, neto y a quién le toca cada parte, con fila de totales y la regla
 * en una línea plegable. Tabla de 768 px en adelante; en celular, una tarjeta por vendedor con los mismos datos.
 */
export function RepartoDia({ filas, totales, nombreDueno, porcentajeSocio, porcentajeVendedor, esAdmin, className }: RepartoDiaProps) {
    const rotuloSocio = `Socio ${porciento(porcentajeSocio)}`;
    const rotuloDueno = `Para ${nombreDueno}`;
    const tituloSocio = esAdmin ? rotuloSocio : `${rotuloSocio} · tú`;
    const tituloDueno = esAdmin ? `${rotuloDueno} · tú` : rotuloDueno;
    const conMovimiento = filas.some((fila) => !sinMovimiento(fila));

    const columnas: Columna<FilaVendedor>[] = [
        { clave: 'vendedor', titulo: 'Vendedor', celda: (fila) => <Nombre fila={fila} />, pie: 'Total del día' },
        { clave: 'ventas', titulo: 'Ventas', numerica: true, celda: (fila) => <Vendido totales={fila} />, pie: <Vendido totales={totales} />, clase: APRETADA },
        { clave: 'publicidad', titulo: 'Publicidad', numerica: true, celda: (fila) => dinero(fila.publicidad === 0 ? 0 : -fila.publicidad), pie: dinero(totales.publicidad === 0 ? 0 : -totales.publicidad), clase: APRETADA },
        { clave: 'neto', titulo: 'Neto', numerica: true, celda: (fila) => <Monto centavos={fila.neto} />, pie: <Monto centavos={totales.neto} />, clase: cn('font-medium', APRETADA) },
        { clave: 'socio', titulo: tituloSocio, numerica: true, celda: (fila) => <Monto centavos={fila.socio} resaltar={!esAdmin} />, pie: <Monto centavos={totales.socio} resaltar={!esAdmin} />, clase: APRETADA },
        { clave: 'parte-vendedor', titulo: 'Para el vendedor', numerica: true, celda: (fila) => <ParteVendedor fila={fila} />, pie: <Monto centavos={totales.vendedor} />, clase: APRETADA },
        { clave: 'dueno', titulo: tituloDueno, numerica: true, celda: (fila) => <Monto centavos={fila.dueno} resaltar={esAdmin} />, pie: <Monto centavos={totales.dueno} resaltar={esAdmin} /> },
    ];

    const tarjeta = (clave: string | number, encabezado: ReactNode, datos: Pick<Totales, 'ventas' | 'ventas_count' | 'publicidad' | 'neto'>, partes: ReactNode, total = false) => (
        <li key={clave} className={cn('px-5 py-4', total ? 'bg-superficie-2/60' : 'border-b border-borde/70')}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    {encabezado}
                    <p className="cifras mt-0.5 text-xs text-tenue">
                        {plural(datos.ventas_count, 'venta')} · {dinero(datos.ventas)} vendidos
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-tenue">Neto</p>
                    <p className="cifras font-titulo text-lg leading-tight font-semibold text-texto">
                        <Monto centavos={datos.neto} />
                    </p>
                </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                <Par etiqueta="Publicidad">{dinero(datos.publicidad === 0 ? 0 : -datos.publicidad)}</Par>
                {partes}
            </dl>
        </li>
    );

    return (
        <Tarjeta className={className} relleno="ninguno" titulo="Reparto por vendedor" descripcion="Qué le toca a cada quien por las ventas de este día">
            {filas.length === 0 ? (
                <div className="border-t border-borde">
                    <EstadoVacio compacto icono={<Scale className="size-5" />} titulo="Sin vendedores con movimiento" descripcion="Cuando haya una venta o un gasto de publicidad con esta fecha, aquí aparece el reparto." />
                </div>
            ) : (
                <>
                    <Tabla
                        className="border-t border-borde max-md:hidden"
                        sinMarco
                        titulo="Reparto del día por vendedor"
                        filas={filas}
                        clave={(fila) => fila.seller_id}
                        columnas={columnas}
                        claseFila={(fila) => (conMovimiento && sinMovimiento(fila) ? '[&>td]:text-tenue' : undefined)}
                    />

                    {/* Celular: los mismos datos, una tarjeta por vendedor. */}
                    <ul className="border-t border-borde md:hidden">
                        {filas.map((fila) =>
                            tarjeta(
                                fila.seller_id,
                                <Nombre fila={fila} />,
                                fila,
                                <>
                                    <Par etiqueta={tituloSocio}>
                                        <Monto centavos={fila.socio} resaltar={!esAdmin} />
                                    </Par>
                                    <Par etiqueta="Para el vendedor">
                                        <ParteVendedor fila={fila} />
                                    </Par>
                                    <Par etiqueta={tituloDueno}>
                                        <Monto centavos={fila.dueno} resaltar={esAdmin} />
                                    </Par>
                                </>,
                            ),
                        )}
                        {tarjeta(
                            'total',
                            <p className="text-sm font-semibold text-texto">Total del día</p>,
                            totales,
                            <>
                                <Par etiqueta={tituloSocio}>
                                    <Monto centavos={totales.socio} resaltar={!esAdmin} />
                                </Par>
                                <Par etiqueta="Para los vendedores">
                                    <Monto centavos={totales.vendedor} />
                                </Par>
                                <Par etiqueta={tituloDueno}>
                                    <Monto centavos={totales.dueno} resaltar={esAdmin} />
                                </Par>
                            </>,
                            true,
                        )}
                    </ul>
                </>
            )}

            <details className="group border-t border-borde">
                <summary className="flex min-h-11 list-none items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-suave transition-colors hover:text-texto focus-visible:-outline-offset-2 sm:px-6 [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="size-4 shrink-0 text-tenue transition-transform duration-200 group-open:rotate-90" aria-hidden="true" />
                    ¿Cómo se calcula el reparto?
                </summary>
                <p className="animate-aparecer px-5 pb-4 pl-11 text-[13px] leading-relaxed text-suave sm:px-6 sm:pl-12">
                    <span className="text-texto">Neto = ventas − publicidad</span> · {porciento(porcentajeSocio)} del neto para el socio ·{' '}
                    {porcentajeVendedor === 50 ? `el resto, mitad para el vendedor y mitad para ${nombreDueno}` : `del resto, ${porciento(porcentajeVendedor)} para el vendedor y lo demás para ${nombreDueno}`}; lo que vende{' '}
                    {nombreDueno} no se reparte con vendedor: después del socio, todo es suyo.
                </p>
            </details>
        </Tarjeta>
    );
}
