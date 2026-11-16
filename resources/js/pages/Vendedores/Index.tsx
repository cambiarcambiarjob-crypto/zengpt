import { router, useForm } from '@inertiajs/react';
import { ChartColumn, Lock, Pencil, Plus, Trophy, UserCheck, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import GradientText from '@/components/reactbits/GradientText';
import { COLOR_SERIE } from '@/components/reportes/colores';
import { useEntrada } from '@/components/reportes/entrada';
import { Interruptor } from '@/components/reportes/Interruptor';
import { porciento, proporcion } from '@/components/reportes/periodos';
import { Aparecer } from '@/components/ui/Aparecer';
import { Boton, EnlaceBoton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Cifra } from '@/components/ui/Cifra';
import { Confirmar } from '@/components/ui/Confirmar';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Insignia } from '@/components/ui/Insignia';
import { Modal } from '@/components/ui/Modal';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { TarjetaFoco } from '@/components/ui/TarjetaFoco';
import AppLayout from '@/layouts/AppLayout';
import { cn } from '@/lib/cn';
import { iniciales, plural } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { VendedoresProps } from '@/types';

type Vendedor = VendedoresProps['vendedores'][number];

const REJILLA = 'md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_auto] md:items-center md:gap-x-8';

/**
 * Vendedores (solo administrador): el catálogo con las ventas acumuladas de cada uno, alta, cambio de nombre y
 * baja/reactivación. El dueño va marcado y no se puede dar de baja.
 */
export default function VendedoresIndex() {
    const { vendedores } = usePagina<VendedoresProps>();
    const listo = useEntrada();

    // null = cerrado · 'nuevo' = alta · un vendedor = cambio de nombre
    const [edicion, setEdicion] = useState<Vendedor | 'nuevo' | null>(null);
    const [porBaja, setPorBaja] = useState<Vendedor | null>(null);
    const [cambiando, setCambiando] = useState<number | null>(null);
    const form = useForm({ name: '', active: true });

    const activos = vendedores.filter((vendedor) => vendedor.active).length;
    const deBaja = vendedores.length - activos;
    const totalVentas = vendedores.reduce((suma, vendedor) => suma + vendedor.ventas_count, 0);
    const tope = Math.max(1, ...vendedores.map((vendedor) => vendedor.ventas_count));
    const mejor = vendedores.reduce<Vendedor | null>((maximo, vendedor) => (vendedor.ventas_count > (maximo?.ventas_count ?? 0) ? vendedor : maximo), null);

    const abrir = (destino: Vendedor | 'nuevo') => {
        form.clearErrors();
        form.setData(destino === 'nuevo' ? { name: '', active: true } : { name: destino.name, active: destino.active });
        setEdicion(destino);
    };

    const cerrar = () => setEdicion(null);

    const guardar = (evento: FormEvent) => {
        evento.preventDefault();
        if (edicion === null) return;

        // El aviso «Vendedor agregado.» / «Vendedor actualizado.» lo muestra el layout.
        if (edicion === 'nuevo') {
            form.post('/vendedores', { preserveScroll: true, onSuccess: cerrar });
        } else {
            form.put(`/vendedores/${edicion.id}`, { preserveScroll: true, onSuccess: cerrar });
        }
    };

    const cambiarEstado = (vendedor: Vendedor, activo: boolean) => {
        router.put(
            `/vendedores/${vendedor.id}`,
            { name: vendedor.name, active: activo },
            {
                preserveScroll: true,
                onStart: () => setCambiando(vendedor.id),
                onFinish: () => {
                    setCambiando(null);
                    setPorBaja(null);
                },
            },
        );
    };

    return (
        <AppLayout
            titulo="Vendedores"
            descripcion={`${plural(activos, 'activo')}${deBaja > 0 ? ` · ${deBaja} de baja` : ''} · quienes pueden recibir ventas y publicidad`}
            acciones={
                <>
                    <EnlaceBoton href="/reportes" icono={<ChartColumn className="size-4" aria-hidden="true" />}>
                        Ver reportes
                    </EnlaceBoton>
                    <Boton variante="primario" icono={<Plus className="size-4" aria-hidden="true" />} onClick={() => abrir('nuevo')}>
                        Agregar vendedor
                    </Boton>
                </>
            }
        >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Aparecer indice={0}>
                    <TarjetaFoco className="h-full">
                        <Cifra etiqueta="Vendedores activos" icono={<UserCheck className="size-4" />} valor={activos} formato="numero" detalle={deBaja > 0 ? `${plural(vendedores.length, 'vendedor', 'vendedores')} en el catálogo, ${deBaja} de baja` : 'Todo el catálogo está activo'} />
                    </TarjetaFoco>
                </Aparecer>
                <Aparecer indice={1}>
                    <TarjetaFoco className="h-full">
                        <Cifra etiqueta="Ventas acumuladas" icono={<Users className="size-4" />} valor={totalVentas} formato="numero" detalle="Clientes vendidos entre todos, desde el inicio" />
                    </TarjetaFoco>
                </Aparecer>
                <Aparecer indice={2} className="max-sm:col-span-2">
                    <TarjetaFoco className="h-full">
                        <p className="flex items-center gap-1.5 text-[13px] font-medium text-suave">
                            <Trophy className="size-4 shrink-0 text-tenue" aria-hidden="true" />
                            Con más ventas
                        </p>
                        {mejor ? (
                            <>
                                <p className="mt-1.5 truncate font-titulo text-[1.75rem] leading-none font-semibold tracking-tight">
                                    <GradientText colors={['#34d8a6', '#b4f5df', '#7fd4f5', '#34d8a6']} animationSpeed={7}>
                                        {mejor.name}
                                    </GradientText>
                                </p>
                                <p className="cifras mt-2 text-[13px] leading-snug text-tenue">
                                    {plural(mejor.ventas_count, 'venta')} · {porciento(proporcion(mejor.ventas_count, totalVentas))} del total
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="mt-1.5 font-titulo text-[1.75rem] leading-none font-semibold tracking-tight text-tenue">
                                    <span aria-hidden="true">—</span>
                                </p>
                                <p className="mt-2 text-[13px] leading-snug text-tenue">Aún no hay ventas capturadas</p>
                            </>
                        )}
                    </TarjetaFoco>
                </Aparecer>
            </div>

            <Aparecer indice={3} className="mt-4">
                <Tarjeta relleno="ninguno" titulo="Catálogo" descripcion="Un vendedor de baja deja de aparecer al capturar ventas; sus ventas anteriores siguen contando en los reportes.">
                    {vendedores.length === 0 ? (
                        <EstadoVacio
                            compacto
                            icono={<Users className="size-5" />}
                            titulo="Aún no hay vendedores"
                            descripcion="Agrega al primero para poder asignarle ventas."
                            accion={
                                <Boton variante="primario" onClick={() => abrir('nuevo')}>
                                    Agregar vendedor
                                </Boton>
                            }
                        />
                    ) : (
                        <>
                            <div className={cn('hidden border-y border-borde px-5 py-2.5 text-[11px] font-semibold tracking-wider text-tenue uppercase sm:px-6', REJILLA)} aria-hidden="true">
                                <span>Vendedor</span>
                                <span>Ventas acumuladas</span>
                                <span className="w-56 text-right">Acciones</span>
                            </div>

                            <ul className="max-md:border-t max-md:border-borde">
                                {vendedores.map((vendedor, indice) => {
                                    const ocupado = cambiando === vendedor.id;

                                    return (
                                        <li key={vendedor.id} className={cn('border-b border-borde/70 px-5 py-4 last:border-b-0 sm:px-6 md:py-3.5', REJILLA)}>
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span
                                                    className={cn(
                                                        'flex size-10 shrink-0 items-center justify-center rounded-full border font-titulo text-sm font-semibold',
                                                        !vendedor.active ? 'border-borde bg-superficie-2 text-tenue' : vendedor.is_owner ? 'border-acento/40 bg-acento/10 text-acento' : 'border-borde-fuerte bg-superficie-3 text-texto',
                                                    )}
                                                    aria-hidden="true"
                                                >
                                                    {iniciales(vendedor.name)}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                                        <span className={cn('truncate text-sm font-medium', vendedor.active ? 'text-texto' : 'text-suave')}>{vendedor.name}</span>
                                                        {vendedor.is_owner && (
                                                            <Insignia estado="acento" tamano="sm" sinPunto>
                                                                Dueño
                                                            </Insignia>
                                                        )}
                                                        {!vendedor.active && (
                                                            <Insignia estado="neutral" tamano="sm">
                                                                De baja
                                                            </Insignia>
                                                        )}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-tenue">{vendedor.is_owner ? 'Sus ventas no pagan comisión de vendedor' : vendedor.active ? 'Disponible al capturar ventas' : 'No aparece al capturar ventas'}</p>
                                                </div>
                                            </div>

                                            <div className="min-w-0 max-md:mt-3">
                                                <p className="flex items-baseline justify-between gap-3">
                                                    <span className="cifras text-sm font-semibold text-texto">{vendedor.ventas_count === 0 ? 'Sin ventas' : plural(vendedor.ventas_count, 'venta')}</span>
                                                    <span className="cifras text-xs whitespace-nowrap text-tenue">{totalVentas > 0 ? `${porciento(proporcion(vendedor.ventas_count, totalVentas))} del total` : ''}</span>
                                                </p>
                                                <span className="mt-2 block h-2 overflow-hidden rounded-full bg-superficie-3" aria-hidden="true">
                                                    {vendedor.ventas_count > 0 && (
                                                        <span
                                                            className={cn('block h-full w-full rounded-full transition-transform duration-700 ease-suave', !vendedor.active && 'opacity-50')}
                                                            style={{
                                                                backgroundColor: COLOR_SERIE.ventas,
                                                                transform: `translateX(${listo ? Math.max(1.5, (vendedor.ventas_count / tope) * 100) - 100 : -100}%)`,
                                                                transitionDelay: `${indice * 60}ms`,
                                                            }}
                                                        />
                                                    )}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 max-md:mt-3 md:w-56 md:justify-end">
                                                <Boton tamano="sm" variante="fantasma" icono={<Pencil className="size-3.5" aria-hidden="true" />} onClick={() => abrir(vendedor)} aria-label={`Renombrar a ${vendedor.name}`} className="max-md:h-10 max-md:px-3">
                                                    Renombrar
                                                </Boton>
                                                {vendedor.is_owner ? (
                                                    <span className="flex h-11 items-center gap-1.5 text-xs whitespace-nowrap text-tenue" title="El dueño no se puede dar de baja">
                                                        <Lock className="size-3.5" aria-hidden="true" />
                                                        Siempre activo
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        <span className="text-xs text-suave md:hidden" aria-hidden="true">
                                                            {vendedor.active ? 'Activo' : 'De baja'}
                                                        </span>
                                                        <Interruptor
                                                            activo={vendedor.active}
                                                            ocupado={ocupado}
                                                            etiqueta={`${vendedor.name}: activo`}
                                                            alCambiar={(activo) => (activo ? cambiarEstado(vendedor, true) : setPorBaja(vendedor))}
                                                        />
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                </Tarjeta>
            </Aparecer>

            <Modal
                abierto={edicion !== null}
                alCerrar={cerrar}
                titulo={edicion === 'nuevo' || edicion === null ? 'Agregar vendedor' : `Renombrar a ${edicion.name}`}
                descripcion={edicion === 'nuevo' || edicion === null ? 'Quedará activo y disponible al capturar ventas.' : 'El nombre nuevo se verá también en las ventas y reportes anteriores.'}
                tamano="sm"
                alEnviar={guardar}
                bloqueado={form.processing}
                pie={
                    <>
                        <Boton variante="fantasma" onClick={cerrar} disabled={form.processing}>
                            Cancelar
                        </Boton>
                        <Boton type="submit" variante="primario" cargando={form.processing}>
                            {edicion === 'nuevo' || edicion === null ? 'Agregar' : 'Guardar nombre'}
                        </Boton>
                    </>
                }
            >
                <Campo
                    etiqueta="Nombre"
                    value={form.data.name}
                    onChange={(evento) => form.setData('name', evento.target.value)}
                    error={form.errors.name}
                    ayuda="Como lo conocen en el equipo. Máximo 60 caracteres."
                    maxLength={60}
                    autoComplete="off"
                    autoCapitalize="words"
                    placeholder="Ej. Jorge"
                    required
                    data-autofocus
                />
            </Modal>

            <Confirmar
                abierto={porBaja !== null}
                titulo={`¿Dar de baja a ${porBaja?.name ?? ''}?`}
                textoConfirmar="Dar de baja"
                cargando={porBaja !== null && cambiando === porBaja.id}
                alCancelar={() => setPorBaja(null)}
                alConfirmar={() => porBaja && cambiarEstado(porBaja, false)}
            >
                Ya no aparecerá al capturar ventas. {porBaja && porBaja.ventas_count > 0 ? `Lo que ya vendió (${plural(porBaja.ventas_count, 'venta')}) sigue contando en los reportes` : 'No tiene ventas capturadas'} y puedes reactivarlo cuando quieras.
            </Confirmar>
        </AppLayout>
    );
}
