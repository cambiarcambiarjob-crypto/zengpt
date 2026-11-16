import { router, usePage } from '@inertiajs/react';
import { CalendarSearch, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { csvPorDia, csvPorVendedor, descargarCsv } from '@/components/reportes/csv';
import { DatosPeriodo } from '@/components/reportes/DatosPeriodo';
import { DetalleReporte } from '@/components/reportes/DetalleReporte';
import { FiltroPeriodo } from '@/components/reportes/FiltroPeriodo';
import { GraficaDias } from '@/components/reportes/GraficaDias';
import { atajosDePeriodo, capitalizar, diasDelRango } from '@/components/reportes/periodos';
import { RankingVendedores } from '@/components/reportes/RankingVendedores';
import { ResumenPeriodo } from '@/components/reportes/ResumenPeriodo';
import { Aparecer } from '@/components/ui/Aparecer';
import { avisar } from '@/components/ui/Avisos';
import { Boton, EnlaceBoton } from '@/components/ui/Boton';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Tarjeta } from '@/components/ui/Tarjeta';
import AppLayout from '@/layouts/AppLayout';
import { cn } from '@/lib/cn';
import { fechaLarga, fechaMedia, plural } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { ReportesProps } from '@/types';

/** «Lunes 16 de noviembre de 2026» para un día; «1 de noviembre de 2026 – 16 de noviembre de 2026» para un rango. */
function periodoEnPalabras(desde: string, hasta: string): string {
    return desde === hasta ? capitalizar(fechaLarga(desde, { anio: true })) : `${fechaMedia(desde)} – ${fechaMedia(hasta)}`;
}

/**
 * Reportes: se elige un periodo y la pantalla contesta, de arriba abajo, cuánto se vendió y cuánto quedó, quién vendió
 * más (el ranking), cómo se movieron los días (la gráfica) y el detalle con totales, que se puede exportar a CSV.
 */
export default function ReportesIndex() {
    const { desde, hasta, filas, totales, serie, negocio, auth } = usePagina<ReportesProps>();
    const { url } = usePage();
    const [cargando, setCargando] = useState(false);

    const esAdmin = auth.user?.is_admin ?? false;
    const dueno = filas.find((fila) => fila.is_owner)?.name ?? 'el dueño';
    const dias = diasDelRango(desde, hasta);
    const sinMovimiento = totales.ventas_count === 0 && totales.publicidad === 0;
    const esteMes = atajosDePeriodo(negocio.hoy).find((atajo) => atajo.clave === 'mes');

    // Mientras llega otro periodo, las cifras actuales se quedan en su lugar (atenuadas): sin esqueletos ni saltos.
    useEffect(() => {
        const quitarInicio = router.on('start', (evento) => {
            if (evento.detail.visit.url.pathname === '/reportes' && evento.detail.visit.method === 'get') setCargando(true);
        });
        const quitarFin = router.on('finish', () => setCargando(false));

        return () => {
            quitarInicio();
            quitarFin();
        };
    }, []);

    const exportarVendedores = () => {
        descargarCsv(`zengpt-reporte-${desde}_${hasta}.csv`, csvPorVendedor({ desde, hasta, filas, totales, dueno: capitalizar(dueno), porcentajeSocio: negocio.porcentaje_socio }));
        avisar.exito('Reporte exportado a CSV.');
    };

    const exportarDias = () => {
        const primero = serie[0]?.fecha ?? desde;
        descargarCsv(`zengpt-reporte-por-dia-${primero}_${hasta}.csv`, csvPorDia(serie));
        avisar.exito('Detalle por día exportado a CSV.');
    };

    return (
        <AppLayout
            titulo="Reportes"
            ancho="ancho"
            descripcion={
                <>
                    {periodoEnPalabras(desde, hasta)}
                    {dias > 1 && <span className="text-tenue"> · {plural(dias, 'día')}</span>}
                </>
            }
            acciones={
                <Boton icono={<Download className="size-4" aria-hidden="true" />} onClick={exportarVendedores} disabled={filas.length === 0}>
                    Exportar CSV
                </Boton>
            }
        >
            <FiltroPeriodo desde={desde} hasta={hasta} hoy={negocio.hoy} url={url} cargando={cargando} />

            <div className={cn('mt-4 grid grid-cols-1 gap-4 transition-opacity duration-200 xl:grid-cols-12', cargando && 'opacity-60')} aria-busy={cargando || undefined}>
                <Aparecer indice={0} className="xl:col-span-12">
                    <ResumenPeriodo totales={totales} dias={dias} dueno={capitalizar(dueno)} esAdmin={esAdmin} porcentajeSocio={negocio.porcentaje_socio} />
                </Aparecer>

                {sinMovimiento ? (
                    <Aparecer indice={1} className="xl:col-span-12">
                        <Tarjeta>
                            <EstadoVacio
                                icono={<CalendarSearch className="size-5" />}
                                titulo="Sin movimiento en este periodo"
                                descripcion="No hay ventas ni publicidad capturadas entre estas fechas. Prueba con otro periodo."
                                accion={
                                    esteMes && (esteMes.desde !== desde || esteMes.hasta !== hasta) ? (
                                        <EnlaceBoton href={esteMes.href} variante="primario">
                                            Ver este mes
                                        </EnlaceBoton>
                                    ) : (
                                        <EnlaceBoton href="/cuentas">Capturar una venta</EnlaceBoton>
                                    )
                                }
                            />
                        </Tarjeta>
                    </Aparecer>
                ) : (
                    <>
                        <Aparecer indice={1} className="xl:col-span-8">
                            <RankingVendedores className="h-full" filas={filas} totales={totales} dueno={capitalizar(dueno)} porcentajeSocio={negocio.porcentaje_socio} porcentajeVendedor={negocio.porcentaje_vendedor} />
                        </Aparecer>
                        <Aparecer indice={2} className="xl:col-span-4">
                            <DatosPeriodo className="h-full" totales={totales} serie={serie} dias={dias} />
                        </Aparecer>

                        <Aparecer indice={3} className="xl:col-span-12">
                            <GraficaDias serie={serie} desde={desde} hoy={negocio.hoy} />
                        </Aparecer>

                        <Aparecer indice={4} className="xl:col-span-12">
                            <DetalleReporte
                                desde={desde}
                                hasta={hasta}
                                filas={filas}
                                totales={totales}
                                serie={serie}
                                hoy={negocio.hoy}
                                dueno={capitalizar(dueno)}
                                esAdmin={esAdmin}
                                porcentajeSocio={negocio.porcentaje_socio}
                                alExportarDias={exportarDias}
                            />
                        </Aparecer>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
