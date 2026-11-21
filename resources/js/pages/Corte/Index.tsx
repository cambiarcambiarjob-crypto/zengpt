import { router } from '@inertiajs/react';
import { ChartColumn, HandCoins, Receipt, Undo2, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ModalPago } from '@/components/reportes/ModalPago';
import { capitalizar } from '@/components/reportes/periodos';
import { Aparecer } from '@/components/ui/Aparecer';
import { Boton, EnlaceBoton } from '@/components/ui/Boton';
import { Cifra } from '@/components/ui/Cifra';
import { Confirmar } from '@/components/ui/Confirmar';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { type Columna, Tabla } from '@/components/ui/Tabla';
import { Tarjeta } from '@/components/ui/Tarjeta';
import AppLayout from '@/layouts/AppLayout';
import { cn } from '@/lib/cn';
import { dinero, diasEntre, fechaCorta, fechaLarga, mesLargo, plural, rangoFechas } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { BeneficiarioCorte, CorteProps, MovimientoCorte } from '@/types';

/**
 * Corte: cuánto se le debe HOY a cada quien (el socio y cada vendedor; al dueño no) y lo que ya se les pagó. Lo que se
 * debe es su parte acumulada menos lo pagado, así que un pago parcial o una venta capturada tarde se arrastran solos al
 * siguiente corte. Lo ven el administrador y el socio; registrar o deshacer un pago es solo del administrador.
 */
export default function CorteIndex() {
    const { beneficiarios, movimientos, puedePagar, negocio } = usePagina<CorteProps>();
    const hoy = negocio.hoy;
    const [pagando, setPagando] = useState<BeneficiarioCorte | null>(null);
    const [porDeshacer, setPorDeshacer] = useState<BeneficiarioCorte | null>(null);
    const [deshaciendo, setDeshaciendo] = useState(false);
    const [filtro, setFiltro] = useState('todos');

    const totalPorPagar = beneficiarios.reduce((suma, b) => suma + Math.max(0, b.pago.pendiente), 0);
    const pendientes = beneficiarios.filter((b) => b.pago.pendiente > 0).length;
    const mes = hoy.slice(0, 7);
    const pagadoMes = movimientos.filter((m) => m.paid_on.startsWith(mes)).reduce((suma, m) => suma + m.amount_cents, 0);
    const ultimo = movimientos[0] ?? null;
    const filas = useMemo(() => (filtro === 'todos' ? movimientos : movimientos.filter((m) => m.clave === filtro)), [filtro, movimientos]);

    const deshacer = () => {
        if (!porDeshacer?.deshacer_url) return;
        router.delete(porDeshacer.deshacer_url, {
            preserveScroll: true,
            onStart: () => setDeshaciendo(true),
            onFinish: () => {
                setDeshaciendo(false);
                setPorDeshacer(null);
            },
        });
    };

    const columnas: Columna<MovimientoCorte>[] = [
        { clave: 'para', titulo: 'Para', clase: 'whitespace-nowrap', celda: (m) => <span className="font-medium text-texto">{m.para}</span> },
        { clave: 'cubre', titulo: 'Cubre', clase: 'whitespace-nowrap', celda: (m) => (m.desde ? rangoFechas(m.desde, m.hasta) : `Hasta el ${fechaCorta(m.hasta)}`) },
        { clave: 'fecha', titulo: 'Pagado el', clase: 'whitespace-nowrap', ocultar: 'movil', celda: (m) => fechaCorta(m.paid_on) },
        { clave: 'monto', titulo: 'Monto', numerica: true, celda: (m) => <span className={cn('font-semibold', m.amount_cents < 0 && 'text-peligro')}>{dinero(m.amount_cents)}</span> },
        {
            clave: 'notas',
            titulo: 'Notas',
            ocultar: 'tableta',
            celda: (m) => <span className="text-suave">{[m.notes, m.registrado_por ? `registró ${m.registrado_por}` : null].filter(Boolean).join(' · ') || '—'}</span>,
        },
    ];

    return (
        <AppLayout titulo="Corte" ancho="ancho" descripcion={<>Lo que se le debe hoy a cada quien · {capitalizar(fechaLarga(hoy))}</>}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                <Aparecer indice={0} className="sm:col-span-2 2xl:col-span-4">
                    <Tarjeta>
                        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
                            <Cifra
                                etiqueta="Por pagar hoy"
                                valor={totalPorPagar}
                                tamano="lg"
                                tono={totalPorPagar > 0 ? 'alerta' : 'suave'}
                                icono={<HandCoins className="size-4" aria-hidden="true" />}
                                detalle={totalPorPagar > 0 ? `${plural(pendientes, 'persona')} con saldo` : 'Todos al corriente'}
                            />
                            <Cifra etiqueta={`Pagado en ${mesLargo(hoy)}`} valor={pagadoMes} tamano="md" tono="normal" detalle={pagadoMes > 0 ? 'socio y vendedores' : 'Sin pagos este mes'} />
                            <Cifra
                                etiqueta="Último pago"
                                valor={ultimo?.amount_cents ?? 0}
                                tamano="md"
                                tono={ultimo ? 'normal' : 'suave'}
                                detalle={ultimo ? `a ${ultimo.para} el ${fechaCorta(ultimo.paid_on)}` : 'Todavía no hay pagos'}
                            />
                        </div>
                    </Tarjeta>
                </Aparecer>

                {beneficiarios.map((b, i) => (
                    <Aparecer key={b.clave} indice={i + 1}>
                        <TarjetaBeneficiario beneficiario={b} hoy={hoy} puedePagar={puedePagar} alPagar={() => setPagando(b)} alDeshacer={() => setPorDeshacer(b)} />
                    </Aparecer>
                ))}

                <Aparecer indice={beneficiarios.length + 1} className="sm:col-span-2 2xl:col-span-4">
                    <Tarjeta relleno="ninguno" titulo="Pagos registrados" descripcion="Qué se le pagó a cada quien y qué días cubre cada pago">
                        {beneficiarios.length > 1 && movimientos.length > 0 && (
                            <div className="border-t border-borde px-5 py-3 sm:px-6">
                                <Pestanas
                                    etiqueta="Pagos de"
                                    tamano="sm"
                                    activa={filtro}
                                    alCambiar={setFiltro}
                                    opciones={[{ valor: 'todos', etiqueta: 'Todos' }, ...beneficiarios.map((b) => ({ valor: b.clave, etiqueta: b.nombre }))]}
                                />
                            </div>
                        )}
                        <Tabla
                            className="border-t border-borde"
                            sinMarco
                            titulo="Pagos registrados"
                            filas={filas}
                            clave={(m) => `${m.clave}-${m.id}`}
                            columnas={columnas}
                            vacio={
                                <EstadoVacio
                                    compacto
                                    icono={<Receipt className="size-5" />}
                                    titulo="Sin pagos registrados"
                                    descripcion={puedePagar ? 'Cuando le pagues a alguien, regístralo en su tarjeta: queda aquí y deja de contarse como pendiente.' : 'Aquí aparecen los pagos que registre el administrador.'}
                                />
                            }
                        />
                    </Tarjeta>
                </Aparecer>
            </div>

            {pagando && <ModalPago nombre={pagando.nombre} url={pagando.pagar_url} pago={pagando.pago} hoy={hoy} alCerrar={() => setPagando(null)} />}

            <Confirmar
                abierto={porDeshacer !== null}
                titulo="¿Deshacer el último pago?"
                textoConfirmar="Deshacer pago"
                cargando={deshaciendo}
                alCancelar={() => setPorDeshacer(null)}
                alConfirmar={deshacer}
            >
                {porDeshacer?.pago.ultimo && (
                    <>
                        Se borra el pago a {porDeshacer.nombre} de {dinero(porDeshacer.pago.ultimo.amount_cents)} del {fechaCorta(porDeshacer.pago.ultimo.paid_on)} y esos días vuelven a quedar por
                        pagar.
                    </>
                )}
            </Confirmar>
        </AppLayout>
    );
}

interface TarjetaBeneficiarioProps {
    beneficiario: BeneficiarioCorte;
    hoy: string;
    puedePagar: boolean;
    alPagar: () => void;
    alDeshacer: () => void;
}

function TarjetaBeneficiario({ beneficiario: b, hoy, puedePagar, alPagar, alDeshacer }: TarjetaBeneficiarioProps) {
    const { pago } = b;
    const debe = pago.pendiente > 0;
    const dias = pago.desde ? diasEntre(pago.desde, hoy) + 1 : 0;

    return (
        <Tarjeta
            className="flex h-full flex-col"
            titulo={
                <span className="flex items-center gap-2">
                    <Wallet className={cn('size-4', debe ? 'text-alerta' : 'text-tenue')} aria-hidden="true" />
                    {b.nombre}
                </span>
            }
            descripcion={b.rol}
        >
            <div className="flex flex-1 flex-col">
                <Cifra
                    etiqueta="Se le debe hoy"
                    valor={pago.pendiente}
                    tamano="lg"
                    tono={debe ? 'alerta' : 'suave'}
                    negativoEnRojo
                    detalle={
                        debe && pago.desde
                            ? `desde el ${fechaCorta(pago.desde)} · ${plural(dias, 'día')}`
                            : pago.pendiente < 0
                              ? 'saldo en contra: se descuenta del siguiente pago'
                              : 'al corriente'
                    }
                />

                <p className="mt-4 text-[13px] leading-relaxed text-suave">
                    {pago.ultimo ? (
                        <>
                            Último pago: <strong className="cifras font-semibold text-texto">{dinero(pago.ultimo.amount_cents)}</strong> el {fechaCorta(pago.ultimo.paid_on)}
                            <span className="block text-tenue">cubrió hasta el {fechaCorta(pago.ultimo.hasta)}</span>
                        </>
                    ) : (
                        <span className="text-tenue">Todavía no tiene pagos registrados.</span>
                    )}
                </p>

                {pago.ajuste !== 0 && (
                    <p className="mt-3 flex items-start gap-2 rounded-campo border border-alerta/30 bg-alerta/8 px-3 py-2 text-xs leading-snug text-suave">
                        <Receipt className="mt-0.5 size-3.5 shrink-0 text-alerta" aria-hidden="true" />
                        <span>
                            Incluye <strong className="cifras text-texto">{dinero(pago.ajuste)}</strong> de días ya pagados (capturas tardías o un pago que no fue exacto).
                        </span>
                    </p>
                )}

                {(puedePagar || b.detalle_url) && (
                    <div className="mt-auto pt-4">
                        {puedePagar && (
                            <Boton tamano="sm" anchoCompleto variante={debe ? 'primario' : 'secundario'} onClick={alPagar}>
                                Registrar pago
                            </Boton>
                        )}
                        {(b.detalle_url || (puedePagar && b.deshacer_url)) && (
                            <div className={cn('flex items-center justify-between gap-2', puedePagar && 'mt-2')}>
                                {b.detalle_url ? (
                                    <EnlaceBoton href={b.detalle_url} tamano="sm" variante="fantasma" className="-ml-3" icono={<ChartColumn className="size-3.5" aria-hidden="true" />}>
                                        Día por día
                                    </EnlaceBoton>
                                ) : (
                                    <span />
                                )}
                                {puedePagar && b.deshacer_url && (
                                    <Boton tamano="sm" variante="fantasma" className="-mr-3" icono={<Undo2 className="size-3.5" aria-hidden="true" />} title="Deshacer el último pago" aria-label={`Deshacer el último pago a ${b.nombre}`} onClick={alDeshacer}>
                                        Deshacer
                                    </Boton>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Tarjeta>
    );
}
