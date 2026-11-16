import { Link } from '@inertiajs/react';
import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Insignia } from '@/components/ui/Insignia';
import { Pestanas } from '@/components/ui/Pestanas';
import { Tabla, type Columna } from '@/components/ui/Tabla';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { dinero, fechaCorta, fechaLarga, numero, plural, rangoFechas } from '@/lib/formato';
import type { DiaSerie, FilaVendedor, Totales } from '@/types';
import { capitalizar, porciento } from './periodos';

type Vista = 'vendedor' | 'dia';

export interface DetalleReporteProps {
    desde: string;
    hasta: string;
    filas: FilaVendedor[];
    totales: Totales;
    serie: DiaSerie[];
    hoy: string;
    /** Nombre del dueño («Leo») para rotular su columna. */
    dueno: string;
    esAdmin: boolean;
    porcentajeSocio: number;
    /** Descarga la serie por día (la tabla por vendedor se exporta con el botón del encabezado de la pantalla). */
    alExportarDias: () => void;
    className?: string;
}

function Monto({ centavos, resaltar = false }: { centavos: number; resaltar?: boolean }) {
    return <span className={cn(centavos < 0 ? 'text-peligro' : resaltar && centavos > 0 ? 'font-semibold text-acento' : undefined)}>{dinero(centavos)}</span>;
}

/** Deja que el rótulo largo de una columna se parta en dos renglones en pantallas angostas (los montos no se parten). */
const ENCABEZADO_EN_DOS = 'max-xl:whitespace-normal! max-xl:min-w-20';

/**
 * Tabla detallada del reporte con totales al pie: por vendedor (ventas, publicidad, neto y las tres partes del reparto)
 * o por día (un renglón por fecha, con enlace al cierre de ese día).
 */
export function DetalleReporte({ desde, hasta, filas, totales, serie, hoy, dueno, esAdmin, porcentajeSocio, alExportarDias, className }: DetalleReporteProps) {
    const [vista, setVista] = useState<Vista>('vendedor');
    const rotuloSocio = `Socio (${porciento(porcentajeSocio)})`;
    const rotuloDueno = `Parte de ${dueno}`;

    const columnasVendedor: Columna<FilaVendedor>[] = [
        {
            clave: 'vendedor',
            titulo: 'Vendedor',
            celda: (fila) => (
                <span className="flex items-center gap-2">
                    <span className="truncate font-medium text-texto">{fila.name}</span>
                    {fila.is_owner && (
                        <Insignia estado="neutral" tamano="sm" sinPunto>
                            Dueño
                        </Insignia>
                    )}
                </span>
            ),
            pie: 'Total',
        },
        { clave: 'cantidad', titulo: 'Ventas', numerica: true, celda: (fila) => numero(fila.ventas_count), pie: numero(totales.ventas_count) },
        { clave: 'ventas', titulo: 'Vendido', numerica: true, celda: (fila) => dinero(fila.ventas), pie: dinero(totales.ventas) },
        { clave: 'publicidad', titulo: 'Publicidad', numerica: true, celda: (fila) => dinero(-fila.publicidad), pie: dinero(-totales.publicidad) },
        { clave: 'costo', titulo: 'Cuentas', numerica: true, celda: (fila) => dinero(-fila.costo), pie: dinero(-totales.costo) },
        { clave: 'neto', titulo: 'Neto', numerica: true, clase: 'font-medium', celda: (fila) => <Monto centavos={fila.neto} />, pie: <Monto centavos={totales.neto} /> },
        {
            clave: 'socio',
            titulo: esAdmin ? rotuloSocio : `${rotuloSocio} · tú`,
            numerica: true,
            clase: ENCABEZADO_EN_DOS,
            celda: (fila) => <Monto centavos={fila.socio} resaltar={!esAdmin} />,
            pie: <Monto centavos={totales.socio} resaltar={!esAdmin} />,
        },
        {
            clave: 'parte-vendedor',
            titulo: 'Parte del vendedor',
            numerica: true,
            clase: ENCABEZADO_EN_DOS,
            celda: (fila) =>
                fila.is_owner ? (
                    // «relative»: el texto para lectores de pantalla queda dentro del marco desplazable de la tabla (si no, ensancha la página en celular).
                    <span className="relative text-tenue">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">No aplica: es el dueño</span>
                    </span>
                ) : (
                    <Monto centavos={fila.vendedor} />
                ),
            pie: <Monto centavos={totales.vendedor} />,
        },
        {
            clave: 'parte-dueno',
            titulo: esAdmin ? `${rotuloDueno} · tú` : rotuloDueno,
            numerica: true,
            clase: ENCABEZADO_EN_DOS,
            celda: (fila) => <Monto centavos={fila.dueno} resaltar={esAdmin} />,
            pie: <Monto centavos={totales.dueno} resaltar={esAdmin} />,
        },
    ];

    const dias = useMemo(() => [...serie].reverse(), [serie]);
    const totalDias = useMemo(
        () => serie.reduce((suma, dia) => ({ n: suma.n + dia.ventas_count, ventas: suma.ventas + dia.ventas, publicidad: suma.publicidad + dia.publicidad, costo: suma.costo + dia.costo, neto: suma.neto + dia.neto }), { n: 0, ventas: 0, publicidad: 0, costo: 0, neto: 0 }),
        [serie],
    );
    const recortada = serie.length > 0 && serie[0].fecha > desde;

    const columnasDia: Columna<DiaSerie>[] = [
        {
            clave: 'fecha',
            titulo: 'Día',
            clase: 'whitespace-nowrap',
            celda: (dia) => (
                <Link href={`/dia/${dia.fecha}`} className="rounded-sm underline decoration-borde-fuerte underline-offset-4 transition-colors hover:text-acento hover:decoration-acento/60">
                    {dia.fecha === hoy ? (
                        'Hoy'
                    ) : (
                        <>
                            <span className="sm:hidden">{fechaCorta(dia.fecha)}</span>
                            <span className="max-sm:hidden">{capitalizar(fechaLarga(dia.fecha))}</span>
                        </>
                    )}
                </Link>
            ),
            pie: recortada ? 'Total del último año' : 'Total',
        },
        { clave: 'cantidad', titulo: 'Ventas', numerica: true, celda: (dia) => numero(dia.ventas_count), pie: numero(totalDias.n) },
        { clave: 'ventas', titulo: 'Vendido', numerica: true, celda: (dia) => dinero(dia.ventas), pie: dinero(totalDias.ventas) },
        { clave: 'publicidad', titulo: 'Publicidad', numerica: true, celda: (dia) => dinero(-dia.publicidad), pie: dinero(-totalDias.publicidad) },
        { clave: 'costo', titulo: 'Cuentas', numerica: true, celda: (dia) => dinero(-dia.costo), pie: dinero(-totalDias.costo) },
        { clave: 'neto', titulo: 'Neto', numerica: true, clase: 'font-medium', celda: (dia) => <Monto centavos={dia.neto} />, pie: <Monto centavos={totalDias.neto} /> },
    ];

    return (
        <Tarjeta
            className={className}
            relleno="ninguno"
            titulo="Detalle del reporte"
            descripcion={
                vista === 'vendedor'
                    ? `${rangoFechas(desde, hasta)} · ${plural(filas.length, 'vendedor', 'vendedores')} · ventas, gastos y reparto`
                    : `${plural(serie.length, 'día')}, del más reciente al más antiguo${recortada ? ' · solo el último año del periodo' : ''}`
            }
            acciones={
                <>
                    {vista === 'dia' && (
                        <Boton tamano="sm" variante="fantasma" icono={<Download className="size-3.5" aria-hidden="true" />} onClick={alExportarDias} disabled={serie.length === 0}>
                            CSV por día
                        </Boton>
                    )}
                    <Pestanas
                        etiqueta="Tabla del reporte"
                        activa={vista}
                        alCambiar={setVista}
                        opciones={[
                            { valor: 'vendedor', etiqueta: 'Por vendedor' },
                            { valor: 'dia', etiqueta: 'Por día' },
                        ]}
                    />
                </>
            }
        >
            {vista === 'vendedor' ? (
                <Tabla className="border-t border-borde" sinMarco titulo={`Reporte por vendedor, ${rangoFechas(desde, hasta)}`} filas={filas} clave={(fila) => fila.seller_id} columnas={columnasVendedor} vacio={<p className="px-6 py-10 text-center text-sm text-tenue">Sin vendedores con movimiento en el periodo.</p>} />
            ) : (
                // Con muchos días la tabla se desplaza dentro de su marco (accesible con teclado) para no alargar la página.
                <div tabIndex={dias.length > 31 ? 0 : undefined} role={dias.length > 31 ? 'region' : undefined} aria-label={dias.length > 31 ? 'Tabla por día (desplazable)' : undefined} className={cn('border-t border-borde', dias.length > 31 && 'max-h-[34rem] overflow-y-auto overscroll-contain')}>
                    <Tabla sinMarco densa titulo={`Reporte por día, ${rangoFechas(desde, hasta)}`} filas={dias} clave={(dia) => dia.fecha} columnas={columnasDia} claseFila={(dia) => (dia.ventas === 0 && dia.publicidad === 0 ? '[&>td]:text-tenue' : undefined)} />
                </div>
            )}
        </Tarjeta>
    );
}
