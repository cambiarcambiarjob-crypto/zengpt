import { Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { EnlaceBoton } from '@/components/ui/Boton';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Insignia } from '@/components/ui/Insignia';
import { Tabla, type Columna } from '@/components/ui/Tabla';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { dinero, mesLargo, numero, plural, rangoFechas } from '@/lib/formato';
import type { DashboardProps, FilaVendedor, Totales } from '@/types';
import { capitalizar, porciento } from './texto';

export interface VendedoresMesProps {
    filas: FilaVendedor[];
    /** Totales del mes (el pie de la tabla) con el rango de fechas que cubren. */
    mes: DashboardProps['mes'];
    /** true = quien mira es el dueño; false = el socio. Resalta la columna de «su» parte. */
    esAdmin: boolean;
    porcentajeSocio: number;
    className?: string;
}

function Monto({ centavos, resaltar = false }: { centavos: number; resaltar?: boolean }) {
    return <span className={cn(centavos < 0 ? 'text-peligro' : resaltar && centavos > 0 ? 'font-semibold text-acento' : undefined)}>{dinero(centavos)}</span>;
}

/** Deja que el rótulo largo de una columna se parta en dos renglones en pantallas angostas (los montos no tienen espacios: no se parten). */
const ENCABEZADO_EN_DOS = 'max-xl:whitespace-normal! max-xl:min-w-20';

/** Columnas intermedias con menos relleno en pantallas angostas: la tabla completa cabe sin desplazarse en tableta y laptop. */
const APRETADA = 'max-xl:px-2.5!';

function Vendido({ totales }: { totales: Pick<Totales, 'ventas' | 'ventas_count'> }) {
    return (
        <>
            <span className="block">{dinero(totales.ventas)}</span>
            <span className="block text-xs font-normal text-tenue xl:hidden">{plural(totales.ventas_count, 'venta')}</span>
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

/**
 * Reparto del mes por vendedor: ventas, publicidad, neto y cómo se divide (vendedor, dueño y socio).
 * Tabla completa de 768 px en adelante; en celular, una tarjeta por vendedor con los mismos datos.
 */
export function VendedoresMes({ filas, mes, esAdmin, porcentajeSocio, className }: VendedoresMesProps) {
    const dueno = filas.find((fila) => fila.is_owner)?.name;
    const rotuloDueno = dueno ? `Parte de ${dueno}` : 'Parte del dueño';
    const rotuloSocio = `Socio (${porciento(porcentajeSocio)})`;
    const totales: Totales = mes;

    const columnas: Columna<FilaVendedor>[] = [
        {
            clave: 'vendedor',
            titulo: 'Vendedor',
            celda: (fila) => <Nombre fila={fila} />,
            pie: (
                <>
                    <span className="xl:hidden">Total</span>
                    <span className="max-xl:hidden">Total del mes</span>
                </>
            ),
        },
        // De 1280 px en adelante el número de ventas tiene su columna; en pantallas más angostas baja a un segundo renglón de «Vendido».
        { clave: 'cantidad', titulo: 'Ventas', numerica: true, celda: (fila) => numero(fila.ventas_count), pie: numero(totales.ventas_count), clase: 'max-xl:hidden' },
        { clave: 'ventas', titulo: 'Vendido', numerica: true, celda: (fila) => <Vendido totales={fila} />, pie: <Vendido totales={totales} />, clase: APRETADA },
        { clave: 'publicidad', titulo: 'Publicidad', numerica: true, celda: (fila) => dinero(-fila.publicidad), pie: dinero(-totales.publicidad), clase: APRETADA },
        { clave: 'neto', titulo: 'Neto', numerica: true, celda: (fila) => <Monto centavos={fila.neto} />, pie: <Monto centavos={totales.neto} />, clase: cn('font-medium', APRETADA) },
        { clave: 'parte-vendedor', titulo: 'Parte del vendedor', numerica: true, celda: (fila) => <ParteVendedor fila={fila} />, pie: <Monto centavos={totales.vendedor} />, clase: cn(ENCABEZADO_EN_DOS, APRETADA) },
        {
            clave: 'parte-dueno',
            titulo: esAdmin ? `${rotuloDueno} · tú` : rotuloDueno,
            numerica: true,
            celda: (fila) => <Monto centavos={fila.dueno} resaltar={esAdmin} />,
            pie: <Monto centavos={totales.dueno} resaltar={esAdmin} />,
            clase: cn(ENCABEZADO_EN_DOS, APRETADA),
        },
        {
            clave: 'parte-socio',
            titulo: esAdmin ? rotuloSocio : `${rotuloSocio} · tú`,
            numerica: true,
            celda: (fila) => <Monto centavos={fila.socio} resaltar={!esAdmin} />,
            pie: <Monto centavos={totales.socio} resaltar={!esAdmin} />,
            clase: ENCABEZADO_EN_DOS,
        },
    ];

    return (
        <Tarjeta
            className={className}
            relleno="ninguno"
            titulo="Vendedores del mes"
            descripcion={`${capitalizar(mesLargo(mes.hasta))} · ${rangoFechas(mes.desde, mes.hasta)} · ventas, publicidad y reparto por vendedor`}
            acciones={
                <EnlaceBoton href={`/reportes?desde=${mes.desde}&hasta=${mes.hasta}`} tamano="sm">
                    Ver reporte
                </EnlaceBoton>
            }
        >
            {filas.length === 0 ? (
                <EstadoVacio compacto icono={<Users className="size-5" />} titulo="Sin vendedores con movimiento" descripcion="Cuando se capture una venta o un gasto de publicidad este mes, aquí aparece el reparto." />
            ) : (
                <>
                    <Tabla className="border-t border-borde max-md:hidden" sinMarco titulo="Reparto del mes por vendedor" filas={filas} clave={(fila) => fila.seller_id} columnas={columnas} />

                    {/* Celular: los mismos datos, una tarjeta por vendedor. */}
                    <ul className="border-t border-borde md:hidden">
                        {filas.map((fila) => (
                            <li key={fila.seller_id} className="border-b border-borde/70 px-5 py-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Nombre fila={fila} />
                                        <p className="mt-0.5 text-xs text-tenue">
                                            {plural(fila.ventas_count, 'venta')} · {dinero(fila.ventas)} vendidos
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-tenue">Neto</p>
                                        <p className="cifras font-titulo text-lg leading-tight font-semibold text-texto">
                                            <Monto centavos={fila.neto} />
                                        </p>
                                    </div>
                                </div>
                                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                                    <Par etiqueta="Publicidad">{dinero(-fila.publicidad)}</Par>
                                    <Par etiqueta="Parte del vendedor">
                                        <ParteVendedor fila={fila} />
                                    </Par>
                                    <Par etiqueta={esAdmin ? `${rotuloDueno} · tú` : rotuloDueno}>
                                        <Monto centavos={fila.dueno} resaltar={esAdmin} />
                                    </Par>
                                    <Par etiqueta={esAdmin ? rotuloSocio : `${rotuloSocio} · tú`}>
                                        <Monto centavos={fila.socio} resaltar={!esAdmin} />
                                    </Par>
                                </dl>
                            </li>
                        ))}
                        <li className="bg-superficie-2/60 px-5 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-texto">Total del mes</p>
                                    <p className="mt-0.5 text-xs text-tenue">
                                        {plural(totales.ventas_count, 'venta')} · {dinero(totales.ventas)} vendidos
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-tenue">Neto</p>
                                    <p className="cifras font-titulo text-lg leading-tight font-semibold text-texto">
                                        <Monto centavos={totales.neto} />
                                    </p>
                                </div>
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                                <Par etiqueta="Publicidad">{dinero(-totales.publicidad)}</Par>
                                <Par etiqueta="Vendedores">
                                    <Monto centavos={totales.vendedor} />
                                </Par>
                                <Par etiqueta={esAdmin ? `${rotuloDueno} · tú` : rotuloDueno}>
                                    <Monto centavos={totales.dueno} resaltar={esAdmin} />
                                </Par>
                                <Par etiqueta={esAdmin ? rotuloSocio : `${rotuloSocio} · tú`}>
                                    <Monto centavos={totales.socio} resaltar={!esAdmin} />
                                </Par>
                            </dl>
                        </li>
                    </ul>
                </>
            )}
        </Tarjeta>
    );
}
