import { router, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarSearch, Receipt, Undo2, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FiltroPeriodo } from '@/components/reportes/FiltroPeriodo';
import { ModalPago } from '@/components/reportes/ModalPago';
import { capitalizar, diasDelRango, periodoEnPalabras } from '@/components/reportes/periodos';
import { Aparecer } from '@/components/ui/Aparecer';
import { Boton, EnlaceBoton } from '@/components/ui/Boton';
import { Cifra } from '@/components/ui/Cifra';
import { Confirmar } from '@/components/ui/Confirmar';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Insignia } from '@/components/ui/Insignia';
import { Pestanas } from '@/components/ui/Pestanas';
import { type Columna, Tabla } from '@/components/ui/Tabla';
import { Tarjeta } from '@/components/ui/Tarjeta';
import AppLayout from '@/layouts/AppLayout';
import { cn } from '@/lib/cn';
import { dinero, diasEntre, fechaCorta, fechaLarga, numero, plural, rangoFechas, sumarDias } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { DiaVendedor, PagoVendedor, VendedorReporteProps } from '@/types';

function Monto({ centavos, fuerte = false }: { centavos: number; fuerte?: boolean }) {
    return <span className={cn(centavos < 0 && 'text-peligro', fuerte && 'font-semibold')}>{dinero(centavos)}</span>;
}

/**
 * Pantalla de un vendedor: sus métricas de hoy, del periodo y día por día; cuánto se le debe (su parte acumulada menos
 * lo ya pagado) y el historial de pagos. El administrador registra aquí el pago de cada semana.
 */
export default function ReporteVendedor() {
    const { vendedor, vendedores, desde, hasta, hoyVendedor, periodo, dias, pago, pagos, puedePagar, negocio } = usePagina<VendedorReporteProps>();
    const { url } = usePage();
    const [pagando, setPagando] = useState(false);
    const [porDeshacer, setPorDeshacer] = useState<PagoVendedor | null>(null);
    const [deshaciendo, setDeshaciendo] = useState(false);
    const [cargando, setCargando] = useState(false);

    const base = `/reportes/vendedores/${vendedor.id}`;
    const hoy = negocio.hoy;
    const totalDias = diasDelRango(desde, hasta);
    const diasSinPagar = pago?.desde ? diasEntre(pago.desde, hoy) + 1 : 0;
    const filas = useMemo(() => [...dias].reverse(), [dias]);
    const ultimoPago = pagos.find((p) => p.puede_borrar) ?? null;
    // «Sin pagar»: del primer día sin pagar a hoy (como mucho 90 días), igual que lo que abre el servidor por omisión.
    const extras = useMemo(() => {
        if (!pago?.desde || pago.desde > hoy) return undefined;
        const limite = sumarDias(hoy, -89);

        return [{ clave: 'sin_pagar' as const, etiqueta: 'Sin pagar', desde: pago.desde > limite ? pago.desde : limite, hasta: hoy }];
    }, [pago?.desde, hoy]);

    useEffect(() => {
        const quitarInicio = router.on('start', (evento) => {
            if (evento.detail.visit.url.pathname === base && evento.detail.visit.method === 'get') setCargando(true);
        });
        const quitarFin = router.on('finish', () => setCargando(false));

        return () => {
            quitarInicio();
            quitarFin();
        };
    }, [base]);

    const deshacer = () => {
        if (!porDeshacer) return;
        router.delete(`/pagos-vendedores/${porDeshacer.id}`, {
            preserveScroll: true,
            onStart: () => setDeshaciendo(true),
            onFinish: () => {
                setDeshaciendo(false);
                setPorDeshacer(null);
            },
        });
    };

    const columnasDia: Columna<DiaVendedor>[] = [
        {
            clave: 'fecha',
            titulo: 'Día',
            clase: 'whitespace-nowrap',
            celda: (dia) => (
                <span className="text-texto">
                    {dia.fecha === hoy ? (
                        'Hoy'
                    ) : (
                        <>
                            <span className="sm:hidden">{fechaCorta(dia.fecha)}</span>
                            <span className="max-sm:hidden">{capitalizar(fechaLarga(dia.fecha))}</span>
                        </>
                    )}
                </span>
            ),
            pie: 'Total',
        },
        { clave: 'cantidad', titulo: 'Ventas', numerica: true, celda: (dia) => numero(dia.ventas_count), pie: numero(periodo.ventas_count) },
        { clave: 'ventas', titulo: 'Vendido', numerica: true, celda: (dia) => dinero(dia.ventas), pie: dinero(periodo.ventas) },
        { clave: 'publicidad', titulo: 'Publicidad', numerica: true, ocultar: 'movil', celda: (dia) => dinero(-dia.publicidad), pie: dinero(-periodo.publicidad) },
        { clave: 'costo', titulo: 'Cuentas', numerica: true, ocultar: 'tableta', celda: (dia) => dinero(-dia.costo), pie: dinero(-periodo.costo) },
        { clave: 'neto', titulo: 'Neto', numerica: true, ocultar: 'movil', celda: (dia) => <Monto centavos={dia.neto} />, pie: <Monto centavos={periodo.neto} /> },
        {
            clave: 'parte',
            titulo: vendedor.is_owner ? 'Su parte (dueño)' : 'Su parte',
            numerica: true,
            celda: (dia) => <Monto centavos={dia.parte} fuerte />,
            pie: <Monto centavos={periodo.parte} fuerte />,
        },
        ...(vendedor.is_owner
            ? []
            : [
                  {
                      clave: 'estado',
                      titulo: 'Pago',
                      alinear: 'derecha' as const,
                      clase: 'w-0 whitespace-nowrap',
                      celda: (dia: DiaVendedor) =>
                          dia.pago ? (
                              <Insignia estado="activa" tamano="sm" title={`Pagado el ${fechaLarga(dia.pago.paid_on)}`}>
                                  Pagado · {fechaCorta(dia.pago.paid_on)}
                              </Insignia>
                          ) : (
                              <Insignia estado="por_vencer" tamano="sm">
                                  Por pagar
                              </Insignia>
                          ),
                  },
              ]),
    ];

    const columnasPago: Columna<PagoVendedor>[] = [
        { clave: 'cubre', titulo: 'Cubre', clase: 'whitespace-nowrap', celda: (p) => <span className="text-texto">{p.desde ? rangoFechas(p.desde, p.hasta) : `Hasta el ${fechaCorta(p.hasta)}`}</span> },
        { clave: 'fecha', titulo: 'Pagado el', clase: 'whitespace-nowrap', celda: (p) => fechaCorta(p.paid_on) },
        { clave: 'monto', titulo: 'Monto', numerica: true, celda: (p) => <Monto centavos={p.amount_cents} fuerte /> },
        { clave: 'notas', titulo: 'Notas', ocultar: 'movil', celda: (p) => <span className="text-suave">{[p.notes, p.registrado_por ? `registró ${p.registrado_por}` : null].filter(Boolean).join(' · ') || '—'}</span> },
    ];

    return (
        <AppLayout
            titulo={vendedor.name}
            ancho="ancho"
            descripcion={
                <>
                    {vendedor.is_owner ? 'Dueño · ' : 'Vendedor · '}
                    {periodoEnPalabras(desde, hasta)}
                    {totalDias > 1 && <span className="text-tenue"> · {plural(totalDias, 'día')}</span>}
                </>
            }
            acciones={
                <>
                    <EnlaceBoton href="/reportes" variante="fantasma" icono={<ArrowLeft className="size-4" aria-hidden="true" />}>
                        Reportes
                    </EnlaceBoton>
                    {puedePagar && pago && (
                        <Boton variante="primario" icono={<Wallet className="size-4" aria-hidden="true" />} onClick={() => setPagando(true)}>
                            Registrar pago
                        </Boton>
                    )}
                </>
            }
        >
            <Pestanas
                etiqueta="Vendedor"
                activa={String(vendedor.id)}
                className="mb-4"
                opciones={vendedores.map((v) => ({ valor: String(v.id), etiqueta: v.name, href: `/reportes/vendedores/${v.id}` }))}
            />

            <FiltroPeriodo desde={desde} hasta={hasta} hoy={hoy} url={url} cargando={cargando} base={base} extras={extras} />

            <div className={cn('mt-4 grid grid-cols-1 gap-4 transition-opacity duration-200 xl:grid-cols-12', cargando && 'opacity-60')} aria-busy={cargando || undefined}>
                <Aparecer indice={0} className="xl:col-span-5">
                    <Tarjeta className="h-full" titulo="Hoy" descripcion={capitalizar(fechaLarga(hoy))}>
                        <div className="grid grid-cols-3 gap-4">
                            <Cifra etiqueta="Vendido" valor={hoyVendedor.ventas} tamano="sm" detalle={plural(hoyVendedor.ventas_count, 'venta')} />
                            <Cifra etiqueta="Publicidad" valor={-hoyVendedor.publicidad} tamano="sm" tono="suave" />
                            <Cifra etiqueta="Su parte" valor={hoyVendedor.parte} tamano="sm" tono={hoyVendedor.parte > 0 ? 'acento' : 'normal'} negativoEnRojo />
                        </div>
                    </Tarjeta>
                </Aparecer>

                <Aparecer indice={1} className="xl:col-span-7">
                    {pago ? (
                        <Tarjeta
                            className="h-full"
                            titulo={
                                <span className="flex items-center gap-2">
                                    <Wallet className="size-4 text-acento" aria-hidden="true" />
                                    Por pagar
                                </span>
                            }
                            descripcion="Su parte acumulada menos lo que ya se le pagó"
                        >
                            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                                <Cifra
                                    etiqueta="Se le debe hoy"
                                    valor={pago.pendiente}
                                    tamano="lg"
                                    tono={pago.pendiente > 0 ? 'alerta' : 'suave'}
                                    negativoEnRojo
                                    detalle={
                                        pago.pendiente > 0 && pago.desde
                                            ? `desde el ${fechaCorta(pago.desde)} · ${plural(diasSinPagar, 'día')} sin pagar`
                                            : pago.pendiente < 0
                                              ? 'saldo en contra: se descuenta del siguiente pago'
                                              : 'al corriente'
                                    }
                                />
                                <div className="min-w-0 text-[13px] leading-relaxed text-suave sm:text-right">
                                    {pago.ultimo ? (
                                        <>
                                            <p>
                                                Último pago: <strong className="cifras font-semibold text-texto">{dinero(pago.ultimo.amount_cents)}</strong> el {fechaCorta(pago.ultimo.paid_on)}
                                            </p>
                                            <p className="text-tenue">cubrió hasta el {fechaCorta(pago.ultimo.hasta)}</p>
                                        </>
                                    ) : (
                                        <p className="text-tenue">Todavía no tiene pagos registrados.</p>
                                    )}
                                    {puedePagar && (
                                        <Boton tamano="sm" className="mt-3" variante={pago.pendiente > 0 ? 'primario' : 'secundario'} onClick={() => setPagando(true)}>
                                            Registrar pago
                                        </Boton>
                                    )}
                                </div>
                            </div>
                            {pago.ajuste !== 0 && (
                                <p className="mt-4 flex items-start gap-2 rounded-campo border border-alerta/30 bg-alerta/8 px-3 py-2 text-[13px] leading-snug text-suave">
                                    <Receipt className="mt-0.5 size-3.5 shrink-0 text-alerta" aria-hidden="true" />
                                    <span>
                                        Incluye <strong className="cifras text-texto">{dinero(pago.ajuste)}</strong> de días que ya estaban pagados: ventas o publicidad que se capturaron después del pago, o un
                                        pago que no fue exacto.
                                    </span>
                                </p>
                            )}
                        </Tarjeta>
                    ) : (
                        <Tarjeta className="h-full" titulo="Su parte">
                            <p className="text-sm leading-relaxed text-suave">
                                {vendedor.name} es el dueño: lo que queda de sus ventas (y la mitad de las de los vendedores) es suyo, así que no se le registran pagos.
                            </p>
                        </Tarjeta>
                    )}
                </Aparecer>

                <Aparecer indice={2} className="xl:col-span-12">
                    <Tarjeta titulo="En el periodo" descripcion={periodoEnPalabras(desde, hasta)}>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
                            <Cifra etiqueta="Ventas" valor={periodo.ventas_count} formato="numero" tamano="sm" />
                            <Cifra etiqueta="Vendido" valor={periodo.ventas} tamano="sm" />
                            <Cifra etiqueta="Publicidad" valor={-periodo.publicidad} tamano="sm" tono="suave" />
                            <Cifra etiqueta="Costo de cuentas" valor={-periodo.costo} tamano="sm" tono="suave" />
                            <Cifra etiqueta="Neto" valor={periodo.neto} tamano="sm" negativoEnRojo detalle={`socio ${dinero(periodo.socio)}`} />
                            <Cifra etiqueta="Su parte" valor={periodo.parte} tamano="sm" tono={periodo.parte > 0 ? 'acento' : 'normal'} negativoEnRojo />
                        </div>
                    </Tarjeta>
                </Aparecer>

                <Aparecer indice={3} className="xl:col-span-12">
                    <Tarjeta relleno="ninguno" titulo="Día por día" descripcion="Solo los días con ventas o publicidad">
                        <Tabla
                            className="border-t border-borde"
                            sinMarco
                            titulo={`Métricas por día de ${vendedor.name}`}
                            filas={filas}
                            clave={(dia) => dia.fecha}
                            columnas={columnasDia}
                            vacio={<EstadoVacio compacto icono={<CalendarSearch className="size-5" />} titulo="Sin movimiento en este periodo" descripcion="No hay ventas pagadas ni publicidad de este vendedor entre estas fechas." />}
                        />
                    </Tarjeta>
                </Aparecer>

                {pago && (
                    <Aparecer indice={4} className="xl:col-span-12">
                        <Tarjeta relleno="ninguno" titulo="Pagos" descripcion="Lo que se le ha pagado y qué días cubre cada pago">
                            <Tabla
                                className="border-t border-borde"
                                sinMarco
                                titulo={`Pagos a ${vendedor.name}`}
                                filas={pagos}
                                clave={(p) => p.id}
                                columnas={columnasPago}
                                vacio={<p className="px-6 py-8 text-center text-sm text-tenue">Todavía no hay pagos registrados.</p>}
                            />
                            {puedePagar && ultimoPago && (
                                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-borde px-5 py-3 text-xs text-tenue sm:px-6">
                                    <span>¿Registraste mal el último pago? Deshazlo y vuelve a registrarlo.</span>
                                    <Boton variante="fantasma" tamano="sm" icono={<Undo2 className="size-3.5" aria-hidden="true" />} onClick={() => setPorDeshacer(ultimoPago)}>
                                        Deshacer el último pago
                                    </Boton>
                                </div>
                            )}
                        </Tarjeta>
                    </Aparecer>
                )}
            </div>

            {pagando && pago && <ModalPago nombre={vendedor.name} url={`${base}/pagos`} pago={pago} hoy={hoy} alCerrar={() => setPagando(false)} />}

            <Confirmar abierto={porDeshacer !== null} titulo="¿Deshacer este pago?" textoConfirmar="Deshacer pago" cargando={deshaciendo} alCancelar={() => setPorDeshacer(null)} alConfirmar={deshacer}>
                {porDeshacer && (
                    <>
                        Se borra el pago de {dinero(porDeshacer.amount_cents)} del {fechaCorta(porDeshacer.paid_on)} y esos días vuelven a quedar por pagar.
                    </>
                )}
            </Confirmar>
        </AppLayout>
    );
}
