import { useForm } from '@inertiajs/react';
import { Lock, Megaphone, Save } from 'lucide-react';
import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import CountUp from '@/components/reactbits/CountUp';
import StatusMark, { type StatusMarkStatus } from '@/components/reactbits/StatusMark';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Insignia } from '@/components/ui/Insignia';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { dinero, pesos, plural } from '@/lib/formato';
import type { DiaProps, FilaVendedor } from '@/types';
import { aCentavos } from './utilidades';

type Gasto = DiaProps['publicidad'][number];

export interface PublicidadDiaProps {
    /** Día al que pertenece la publicidad ('AAAA-MM-DD'). */
    fecha: string;
    publicidad: Gasto[];
    /** Reparto del día por vendedor: da contexto a cada renglón (cuánto vendió). */
    filas: FilaVendedor[];
    /** Ventas totales del día en centavos: para mostrar cómo queda el neto con lo capturado. */
    ventas: number;
    puedeEditar: boolean;
    /** Avisa si hay montos escritos sin guardar (la pantalla pregunta antes de cambiar de día). */
    alCambiarPendiente?: (pendiente: boolean) => void;
    className?: string;
}

function Vendedor({ gasto, fila }: { gasto: Gasto; fila?: FilaVendedor }) {
    return (
        <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-texto">{gasto.name}</span>
                {fila?.is_owner && (
                    <Insignia estado="acento" tamano="sm" sinPunto>
                        Dueño
                    </Insignia>
                )}
            </span>
            <span className="cifras mt-0.5 block text-xs text-tenue">{fila && fila.ventas_count > 0 ? `Vendió ${dinero(fila.ventas)} · ${plural(fila.ventas_count, 'venta')}` : 'Sin ventas este día'}</span>
        </span>
    );
}

/** Total en vivo: cuenta desde el valor anterior cada vez que cambia un monto (CountUp de React Bits). */
function Total({ centavos }: { centavos: number }) {
    return (
        <>
            <span className="sr-only">{dinero(centavos)}</span>
            <span aria-hidden="true">
                <CountUp to={centavos / 100} duration={0.35} easing="expo" separator="," decimals={centavos % 100 !== 0 ? 2 : 0} prefix="$" trigger="load" />
            </span>
        </>
    );
}

function Pie({ total, ventas, children }: { total: number; ventas: number; children?: ReactNode }) {
    const neto = ventas - total;

    return (
        <div className="border-t border-borde-fuerte bg-superficie-2/60 px-5 py-4 sm:px-6">
            <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-texto">Publicidad del día</p>
                <p className="cifras font-titulo text-xl leading-none font-semibold text-texto">
                    <Total centavos={total} />
                </p>
            </div>
            <p className="cifras mt-1.5 flex items-baseline justify-between gap-3 text-[13px] text-tenue">
                <span>Neto del día con esta publicidad</span>
                <span className={cn('font-medium', neto < 0 ? 'text-peligro' : 'text-suave')}>{dinero(neto)}</span>
            </p>
            {children}
        </div>
    );
}

/** Formulario del administrador: un campo de pesos por vendedor, total en vivo y «Guardar publicidad». */
function Formulario({ fecha, publicidad, filas, ventas, alCambiarPendiente }: Omit<PublicidadDiaProps, 'puedeEditar' | 'className'>) {
    const form = useForm(() => ({ gastos: Object.fromEntries(publicidad.map((gasto) => [String(gasto.seller_id), pesos(gasto.amount_cents)])) as Record<string, string> }));
    const errores = form.errors as Record<string, string | undefined>;
    const total = publicidad.reduce((suma, gasto) => suma + aCentavos(form.data.gastos[String(gasto.seller_id)] ?? ''), 0);

    const avisar = useRef(alCambiarPendiente);
    avisar.current = alCambiarPendiente;

    useEffect(() => {
        avisar.current?.(form.isDirty);
    }, [form.isDirty]);

    useEffect(() => () => avisar.current?.(false), []);

    const enviar = (evento: FormEvent) => {
        evento.preventDefault();

        // Solo viajan los vendedores que están en pantalla; un campo vacío cuenta como $0 (borra el gasto).
        form.transform((datos) => ({ gastos: Object.fromEntries(publicidad.map((gasto) => [String(gasto.seller_id), (datos.gastos[String(gasto.seller_id)] ?? '').trim()])) }));
        form.put(`/dia/${fecha}/publicidad`, { preserveScroll: true, preserveState: true });
    };

    const estado: { marca: StatusMarkStatus; texto: string; clase: string } = form.processing
        ? { marca: 'running', texto: 'Guardando…', clase: 'text-suave' }
        : form.hasErrors
          ? { marca: 'failed', texto: 'Revisa los montos marcados', clase: 'text-peligro' }
          : form.isDirty
            ? { marca: 'pending', texto: 'Cambios sin guardar', clase: 'text-alerta' }
            : { marca: 'done', texto: form.recentlySuccessful ? 'Publicidad guardada' : 'Todo guardado', clase: 'text-suave' };

    return (
        <form onSubmit={enviar} noValidate>
            <ul className="border-t border-borde">
                {publicidad.map((gasto) => {
                    const clave = String(gasto.seller_id);

                    return (
                        <li key={gasto.seller_id} className="flex items-start gap-3 border-b border-borde/70 px-5 py-3 last:border-b-0 sm:px-6">
                            <span className="flex min-h-11 min-w-0 flex-1 items-center sm:min-h-10">
                                <Vendedor gasto={gasto} fila={filas.find((fila) => fila.seller_id === gasto.seller_id)} />
                            </span>
                            <Campo
                                etiqueta={`Publicidad de ${gasto.name}, en pesos`}
                                ocultarEtiqueta
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={1000000}
                                step="any"
                                placeholder="0"
                                autoComplete="off"
                                prefijo="$"
                                className="cifras text-right"
                                claseContenedor="w-36 shrink-0 gap-1!"
                                value={form.data.gastos[clave] ?? ''}
                                onChange={(evento) => {
                                    form.setData('gastos', { ...form.data.gastos, [clave]: evento.target.value });
                                    if (errores[`gastos.${clave}`]) form.clearErrors(`gastos.${clave}`);
                                }}
                                error={errores[`gastos.${clave}`]}
                            />
                        </li>
                    );
                })}
            </ul>

            <Pie total={total} ventas={ventas}>
                {errores.gastos && (
                    <p role="alert" className="mt-3 text-[13px] leading-snug text-peligro">
                        {errores.gastos}
                    </p>
                )}
                <div className="mt-4 flex min-h-8 items-center justify-between gap-3">
                    <p role="status" className={cn('flex min-w-0 items-center gap-2 text-[13px] font-medium', estado.clase)}>
                        {/* StatusMark (React Bits): anillo punteado → arco girando → palomita. El texto de al lado dice lo mismo. */}
                        <span aria-hidden="true" className="inline-flex">
                            <StatusMark status={estado.marca} size={18} doneColor="#34d8a6" errorColor="#f26d6d" />
                        </span>
                        <span className="truncate">{estado.texto}</span>
                    </p>
                    {/* Siempre ocupa su lugar (invisible sin cambios): el pie no salta al escribir. */}
                    <Boton variante="fantasma" tamano="sm" className={cn('-mr-2', !form.isDirty && 'invisible')} disabled={form.processing || !form.isDirty} onClick={() => {
                            form.reset();
                            form.clearErrors();
                        }}
                    >
                        Descartar
                    </Boton>
                </div>
                <Boton type="submit" variante="primario" anchoCompleto className="mt-3" cargando={form.processing} disabled={!form.isDirty} icono={<Save className="size-4" aria-hidden="true" />}>
                    Guardar publicidad
                </Boton>
            </Pie>
        </form>
    );
}

/** Lo mismo que captura el administrador, en solo lectura (el socio la ve pero no la edita). */
function SoloLectura({ publicidad, filas, ventas }: Pick<PublicidadDiaProps, 'publicidad' | 'filas' | 'ventas'>) {
    const total = publicidad.reduce((suma, gasto) => suma + gasto.amount_cents, 0);

    return (
        <>
            <ul className="border-t border-borde">
                {publicidad.map((gasto) => (
                    <li key={gasto.seller_id} className="flex items-center gap-3 border-b border-borde/70 px-5 py-3 last:border-b-0 sm:px-6">
                        <Vendedor gasto={gasto} fila={filas.find((fila) => fila.seller_id === gasto.seller_id)} />
                        <span className={cn('cifras text-sm font-medium whitespace-nowrap', gasto.amount_cents > 0 ? 'text-texto' : 'text-tenue')}>{dinero(gasto.amount_cents)}</span>
                    </li>
                ))}
            </ul>
            <Pie total={total} ventas={ventas}>
                <p className="mt-4 flex items-start gap-2 text-[13px] leading-snug text-suave">
                    <Lock className="mt-0.5 size-3.5 shrink-0 text-tenue" aria-hidden="true" />
                    La publicidad la captura el administrador.
                </p>
            </Pie>
        </>
    );
}

/**
 * Publicidad del día por vendedor. El administrador la captura en pesos (un campo por vendedor); el socio ve los
 * mismos datos sin poder editarlos. Lo capturado se resta de las ventas de cada vendedor antes de repartir.
 */
export function PublicidadDia({ fecha, publicidad, filas, ventas, puedeEditar, alCambiarPendiente, className }: PublicidadDiaProps) {
    return (
        <Tarjeta className={className} relleno="ninguno" titulo="Publicidad por vendedor" descripcion={puedeEditar ? 'En pesos. Se resta de las ventas de cada vendedor.' : 'Lo que se gastó este día; se resta de las ventas de cada vendedor.'}>
            {publicidad.length === 0 ? (
                <div className="border-t border-borde">
                    <EstadoVacio compacto icono={<Megaphone className="size-5" />} titulo="No hay vendedores activos" descripcion="Activa o agrega un vendedor para capturar su publicidad." />
                </div>
            ) : puedeEditar ? (
                <Formulario fecha={fecha} publicidad={publicidad} filas={filas} ventas={ventas} alCambiarPendiente={alCambiarPendiente} />
            ) : (
                <SoloLectura publicidad={publicidad} filas={filas} ventas={ventas} />
            )}
        </Tarjeta>
    );
}
