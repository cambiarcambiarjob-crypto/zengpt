import { router } from '@inertiajs/react';
import { Ban, CircleCheck, Plus, Power, SearchX } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Buscador } from '@/components/cuentas/Buscador';
import { ModalActivar } from '@/components/cuentas/ModalActivar';
import { ModalCuenta } from '@/components/cuentas/ModalCuenta';
import { ModalEspacio } from '@/components/cuentas/ModalEspacio';
import { ResumenCuentas } from '@/components/cuentas/ResumenCuentas';
import { TarjetaCuenta } from '@/components/cuentas/TarjetaCuenta';
import { urlCuentas, type EstadoFiltro } from '@/components/cuentas/utilidades';
import { Aparecer } from '@/components/ui/Aparecer';
import { Boton, EnlaceBoton } from '@/components/ui/Boton';
import { Confirmar } from '@/components/ui/Confirmar';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { Tarjeta } from '@/components/ui/Tarjeta';
import AppLayout from '@/layouts/AppLayout';
import { cn } from '@/lib/cn';
import { dinero, plural } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { Cuenta, CuentasProps, Espacio } from '@/types';

// El estado vacío «de bienvenida» trae lo decorativo (Threads, StarBorder, Magnet): solo se descarga si la lista está vacía.
const InvitacionCuenta = lazy(() => import('@/components/cuentas/InvitacionCuenta'));

const ESTADOS: { valor: EstadoFiltro; etiqueta: string }[] = [
    { valor: 'activas', etiqueta: 'Activas' },
    { valor: 'con_espacio', etiqueta: 'Con espacio' },
    { valor: 'por_cobrar', etiqueta: 'Por cobrar' },
    { valor: 'llenas', etiqueta: 'Llenas' },
    { valor: 'bloqueadas', etiqueta: 'Bloqueadas' },
    { valor: 'por_activar', etiqueta: 'Por activar' },
    { valor: 'vencidas', etiqueta: 'Vencidas' },
    { valor: 'todas', etiqueta: 'Todas' },
];

const PAUSA_BUSQUEDA = 260; // ms sin teclear antes de consultar al servidor

/** Tras guardar o borrar, el botón que tenía el foco puede haber desaparecido: se devuelve a la cuenta (o al contenido). */
function recuperarFoco(cuentaId?: number): void {
    window.setTimeout(() => {
        const activo = document.activeElement;
        if (activo && activo !== document.body && activo.isConnected) return;

        const tarjeta = cuentaId !== undefined ? document.getElementById(`cuenta-${cuentaId}`) : null;
        const destino = tarjeta?.querySelector<HTMLElement>('[data-libre]') ?? tarjeta ?? document.getElementById('contenido');
        destino?.focus({ preventScroll: true });
    }, 80);
}

export default function CuentasIndex() {
    const { cuentas, filtros, vendedores, negocio, auth, llenas, bloqueadas, por_activar: porActivar } = usePagina<CuentasProps>();
    const esAdmin = auth.user?.is_admin === true;

    // ── Búsqueda con pausa ────────────────────────────────────────────────────────────────────────────────────────
    const [q, setQ] = useState(filtros.q);
    const [buscando, setBuscando] = useState(false);
    const campoBusqueda = useRef<HTMLInputElement>(null);
    const enCurso = useRef(0);
    // Lo último que se le pidió al servidor (puede ir un paso adelante de las props mientras llega la respuesta).
    const pedido = useRef({ estado: filtros.estado, q: filtros.q });

    // Cualquier visita a la lista (una pestaña, el buscador) actualiza «lo pedido»: así una búsqueda pendiente no pisa
    // el cambio de pestaña ni se repite.
    useEffect(
        () =>
            router.on('start', (evento) => {
                const { url, method } = evento.detail.visit;
                if (method !== 'get' || url.pathname !== '/cuentas') return;

                const estado = url.searchParams.get('estado');
                pedido.current = {
                    estado: ESTADOS.some((opcion) => opcion.valor === estado) ? (estado as EstadoFiltro) : 'activas',
                    q: (url.searchParams.get('q') ?? '').trim(),
                };
            }),
        [],
    );

    // Las props mandan: si la búsqueda cambió por fuera (atrás / adelante del navegador), el campo se pone al día.
    useEffect(() => {
        if (filtros.q !== pedido.current.q) setQ(filtros.q);
        pedido.current = { estado: filtros.estado, q: filtros.q };
    }, [filtros.estado, filtros.q]);

    const buscar = useCallback((texto: string) => {
        const limpio = texto.trim();
        if (limpio === pedido.current.q) return;

        router.get(
            urlCuentas(pedido.current.estado, limpio),
            {},
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['cuentas', 'filtros'],
                onStart: () => {
                    enCurso.current += 1;
                    setBuscando(true);
                },
                onFinish: () => {
                    enCurso.current = Math.max(0, enCurso.current - 1);
                    setBuscando(enCurso.current > 0);
                },
            },
        );
    }, []);

    useEffect(() => {
        if (q.trim() === pedido.current.q) return undefined;

        const id = window.setTimeout(() => buscar(q), PAUSA_BUSQUEDA);

        return () => window.clearTimeout(id);
    }, [q, buscar]);

    const cambiarBusqueda = useCallback(
        (texto: string) => {
            setQ(texto);
            if (texto.trim() === '') buscar(''); // limpiar no espera
        },
        [buscar],
    );

    // ── Diálogos ──────────────────────────────────────────────────────────────────────────────────────────────────
    const [dialogoCuenta, setDialogoCuenta] = useState<{ cuenta: Cuenta | null } | null>(null);
    const [dialogoEspacio, setDialogoEspacio] = useState<{ cuenta: Cuenta; espacio: Espacio | null } | null>(null);
    const [porEliminar, setPorEliminar] = useState<Cuenta | null>(null);
    const [porLiberar, setPorLiberar] = useState<{ cuenta: Cuenta; espacio: Espacio } | null>(null);
    const [procesando, setProcesando] = useState(false);

    // Funciones estables: las tarjetas van memorizadas y no se vuelven a pintar al abrir un diálogo o teclear.
    const nuevaCuenta = useCallback(() => setDialogoCuenta({ cuenta: null }), []);
    const editarCuenta = useCallback((cuenta: Cuenta) => setDialogoCuenta({ cuenta }), []);
    const [porActivarDialogo, setPorActivarDialogo] = useState<Cuenta | null>(null);
    const cerrarCuenta = useCallback(() => setDialogoCuenta(null), []);
    const agregarCliente = useCallback((cuenta: Cuenta) => setDialogoEspacio({ cuenta, espacio: null }), []);
    const editarCliente = useCallback((cuenta: Cuenta, espacio: Espacio) => setDialogoEspacio({ cuenta, espacio }), []);
    const cerrarEspacio = useCallback(() => setDialogoEspacio(null), []);
    const pedirLiberar = useCallback((cuenta: Cuenta, espacio: Espacio) => {
        setDialogoEspacio(null);
        setPorLiberar({ cuenta, espacio });
    }, []);
    const alGuardarCliente = useCallback((cuenta: Cuenta) => recuperarFoco(cuenta.id), []);

    const eliminarCuenta = () => {
        if (!porEliminar) return;

        router.delete(`/cuentas/${porEliminar.id}`, {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setProcesando(true),
            onFinish: () => {
                setProcesando(false);
                setPorEliminar(null);
                recuperarFoco();
            },
        });
    };

    const liberarEspacio = () => {
        if (!porLiberar) return;

        const cuentaId = porLiberar.cuenta.id;
        router.delete(`/espacios/${porLiberar.espacio.id}`, {
            preserveScroll: true,
            preserveState: true,
            onStart: () => setProcesando(true),
            onFinish: () => {
                setProcesando(false);
                setPorLiberar(null);
                recuperarFoco(cuentaId);
            },
        });
    };

    // ── Atajos: «/» enfoca el buscador y «N» abre Nueva cuenta (nunca mientras se escribe o hay un diálogo abierto) ──
    useEffect(() => {
        const alTeclear = (evento: KeyboardEvent) => {
            if (evento.defaultPrevented || evento.ctrlKey || evento.metaKey || evento.altKey || evento.repeat) return;

            const origen = evento.target instanceof HTMLElement ? evento.target : null;
            if (origen && (origen.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(origen.tagName))) return;
            if (document.querySelector('[aria-modal="true"]')) return;

            if (evento.key === '/') {
                evento.preventDefault();
                campoBusqueda.current?.focus();
                campoBusqueda.current?.select();
            } else if (evento.key === 'n' || evento.key === 'N') {
                evento.preventDefault();
                nuevaCuenta();
            }
        };

        document.addEventListener('keydown', alTeclear);

        return () => document.removeEventListener('keydown', alTeclear);
    }, [nuevaCuenta]);

    // ── Barra de filtros fija al desplazar (escritorio): solo pinta su fondo cuando ya quedó pegada ────────────────────
    const centinela = useRef<HTMLDivElement>(null);
    const [pegada, setPegada] = useState(false);

    useEffect(() => {
        const nodo = centinela.current;
        if (!nodo || typeof IntersectionObserver === 'undefined') return undefined;

        const observador = new IntersectionObserver(([entrada]) => setPegada(!entrada.isIntersecting && entrada.boundingClientRect.top < 0));
        observador.observe(nodo);

        return () => observador.disconnect();
    }, []);

    // ── Textos ────────────────────────────────────────────────────────────────────────────────────────────────────
    const qLimpia = q.trim();
    // «Bloqueadas» (invitaciones bloqueadas por Google) solo aparece cuando hay alguna, o si ya estás en ella.
    const opcionesEstado = useMemo(
        () =>
            ESTADOS.filter(
                (opcion) => (opcion.valor !== 'bloqueadas' || bloqueadas > 0 || filtros.estado === 'bloqueadas') && (opcion.valor !== 'por_activar' || porActivar > 0 || filtros.estado === 'por_activar'),
            ).map((opcion) => {
                const cuantas = opcion.valor === 'llenas' ? llenas : opcion.valor === 'bloqueadas' ? bloqueadas : opcion.valor === 'por_activar' ? porActivar : 0;
                return { ...opcion, etiqueta: cuantas > 0 ? `${opcion.etiqueta} · ${cuantas}` : opcion.etiqueta, href: urlCuentas(opcion.valor, qLimpia) };
            }),
        [qLimpia, llenas, bloqueadas, porActivar, filtros.estado],
    );
    const busquedaAplicada = useMemo(() => filtros.q.toLowerCase(), [filtros.q]);

    const total = cuentas.length;
    // Libres = los que se pueden vender hoy (sin contar los de cuentas con el bloqueo de Google).
    const libres = cuentas.reduce((suma, cuenta) => suma + (cuenta.activa && !cuenta.google.bloqueo_hasta ? cuenta.libres : 0), 0);
    const textoLibres = libres === 1 ? '1 espacio libre' : `${plural(libres, 'espacio')} libres`;
    const libresBloqueados = cuentas.reduce((suma, cuenta) => suma + (cuenta.activa && cuenta.google.bloqueo_hasta ? cuenta.libres : 0), 0);

    let descripcion: string;
    if (filtros.q !== '') {
        descripcion = total === 0 ? `Nada coincide con «${filtros.q}»` : `${plural(total, 'cuenta coincide', 'cuentas coinciden')} con «${filtros.q}»`;
    } else if (filtros.estado === 'vencidas') {
        descripcion = total === 0 ? 'Ninguna cuenta vencida' : plural(total, 'cuenta vencida', 'cuentas vencidas');
    } else if (filtros.estado === 'todas') {
        descripcion = total === 0 ? 'Aún no hay cuentas' : `${plural(total, 'cuenta')} en total · ${textoLibres}`;
    } else if (filtros.estado === 'por_cobrar') {
        descripcion = total === 0 ? 'Nadie pendiente de pago' : `${plural(total, 'cuenta')} con clientes pendientes de pago`;
    } else if (filtros.estado === 'llenas') {
        descripcion = total === 0 ? 'Ninguna cuenta llena todavía' : `${plural(total, 'cuenta llena', 'cuentas llenas')}: ${negocio.capacidad} de ${negocio.capacidad}, todos pagados y dentro del grupo`;
    } else if (filtros.estado === 'por_activar') {
        descripcion = total === 0 ? 'Ninguna cuenta pendiente de activar' : `${plural(total, 'cuenta pendiente', 'cuentas pendientes')} de activar · no cuentan como activas hasta que las actives`;
    } else if (filtros.estado === 'bloqueadas') {
        descripcion =
            total === 0
                ? 'Ninguna cuenta con invitaciones bloqueadas por Google'
                : `${plural(total, 'cuenta')} con invitaciones bloqueadas por Google · ${plural(libresBloqueados, 'espacio libre', 'espacios libres')} en espera`;
    } else if (filtros.estado === 'con_espacio') {
        descripcion = total === 0 ? 'Ninguna cuenta con espacio' : `${plural(total, 'cuenta')} con espacio · ${textoLibres}`;
    } else {
        descripcion = total === 0 ? 'Ninguna cuenta activa' : `${plural(total, 'cuenta activa', 'cuentas activas')} · ${textoLibres}`;
        if (libresBloqueados > 0) descripcion += ` · ${plural(libresBloqueados, 'bloqueado', 'bloqueados')} por Google`;
        if (llenas > 0) descripcion += ` · ${plural(llenas, 'llena', 'llenas')} aparte`;
        if (porActivar > 0) descripcion += ` · ${porActivar} por activar`;
    }

    return (
        <AppLayout
            titulo="Cuentas"
            ancho="ancho"
            descripcion={descripcion}
            acciones={
                <Boton variante="primario" icono={<Plus className="size-4" aria-hidden="true" />} onClick={nuevaCuenta} title="Nueva cuenta (tecla N)" aria-keyshortcuts="n">
                    Nueva cuenta
                </Boton>
            }
        >
            <p className="sr-only" role="status">
                {descripcion}
            </p>

            {/* Siempre presente (aunque esté en ceros): al buscar, el campo en el que se escribe no cambia de lugar. */}
            <Aparecer className="mb-4 hidden sm:block lg:mb-1">
                <ResumenCuentas cuentas={cuentas} animar={filtros.q === ''} />
            </Aparecer>

            <div ref={centinela} className="h-px" aria-hidden="true" />
            <div
                className={cn(
                    'z-10 -mx-4 -mt-px mb-4 flex flex-col gap-3 border-b border-transparent px-4 transition-[background-color,border-color] duration-200 sm:-mx-6 sm:px-6',
                    'lg:sticky lg:top-0 lg:-mx-10 lg:mb-1 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-3',
                    pegada && 'lg:border-borde lg:bg-fondo/90 lg:backdrop-blur-md',
                )}
            >
                <Pestanas etiqueta="Estado de las cuentas" activa={filtros.estado} opciones={opcionesEstado} />
                <Buscador ref={campoBusqueda} valor={q} alCambiar={cambiarBusqueda} alConfirmar={() => buscar(q)} buscando={buscando} className="w-full lg:w-80 xl:w-96" />
            </div>

            {total > 0 ? (
                <ul className="flex flex-col gap-4" aria-label="Cuentas" aria-busy={buscando || undefined}>
                    {cuentas.map((cuenta, indice) => (
                        <Aparecer como="li" key={cuenta.id} indice={indice}>
                            <TarjetaCuenta
                                cuenta={cuenta}
                                hoy={negocio.hoy}
                                busqueda={busquedaAplicada}
                                alEditar={editarCuenta}
                                alEliminar={setPorEliminar}
                                alAgregarCliente={agregarCliente}
                                alEditarCliente={editarCliente}
                                alLiberar={pedirLiberar}
                                alActivar={setPorActivarDialogo}
                            />
                        </Aparecer>
                    ))}
                </ul>
            ) : filtros.q !== '' ? (
                <Tarjeta className="animate-entrada">
                    <EstadoVacio
                        icono={<SearchX className="size-5" />}
                        titulo={`Sin resultados para «${filtros.q}»`}
                        descripcion={
                            filtros.estado === 'todas'
                                ? 'Ninguna cuenta ni cliente coincide. Revisa el correo o el teléfono; puedes buscar solo una parte.'
                                : `No está en «${ESTADOS.find((opcion) => opcion.valor === filtros.estado)?.etiqueta}». Prueba en todas las cuentas.`
                        }
                        accion={
                            <>
                                {filtros.estado !== 'todas' && (
                                    <EnlaceBoton href={urlCuentas('todas', filtros.q)} preserveState preserveScroll>
                                        Buscar en todas
                                    </EnlaceBoton>
                                )}
                                <Boton variante="fantasma" onClick={() => cambiarBusqueda('')}>
                                    Limpiar búsqueda
                                </Boton>
                            </>
                        }
                    />
                </Tarjeta>
            ) : filtros.estado === 'llenas' ? (
                <Tarjeta className="animate-entrada">
                    <EstadoVacio
                        icono={<CircleCheck className="size-5" />}
                        titulo="Ninguna cuenta llena todavía"
                        descripcion={`Cuando una cuenta tenga sus ${plural(negocio.capacidad, 'espacio')} ocupados, todos pagados y dentro del grupo, se pasa sola aquí para no ocupar lugar en «Activas».`}
                    />
                </Tarjeta>
            ) : filtros.estado === 'por_activar' ? (
                <Tarjeta className="animate-entrada">
                    <EstadoVacio
                        icono={<Power className="size-5" />}
                        titulo="Ninguna cuenta pendiente de activar"
                        descripcion="Al agregar una cuenta que todavía no vas a usar, marca «Pendiente de activar»: queda aquí y no cuenta como activa hasta que la actives."
                    />
                </Tarjeta>
            ) : filtros.estado === 'bloqueadas' ? (
                <Tarjeta className="animate-entrada">
                    <EstadoVacio
                        icono={<Ban className="size-5" />}
                        titulo="Ninguna cuenta bloqueada por Google"
                        descripcion={'Cuando Google diga «Has alcanzado el límite de invitaciones al grupo familiar», la cuenta aparece aquí con sus espacios libres en rojo y la cuenta regresiva hasta que se liberan.'}
                    />
                </Tarjeta>
            ) : filtros.estado === 'vencidas' ? (
                <Tarjeta className="animate-entrada">
                    <EstadoVacio icono={<CircleCheck className="size-5" />} titulo="Ninguna cuenta vencida" descripcion="Cuando una cuenta cumpla su vigencia aparecerá aquí, con sus clientes, para que la renueves o la des de baja." />
                </Tarjeta>
            ) : (
                // Alto reservado: la invitación llega en diferido sin mover nada.
                <section className="relative isolate flex min-h-96 flex-col justify-center overflow-hidden rounded-tarjeta border border-borde bg-superficie shadow-tarjeta" aria-label="Sin cuentas">
                    <Suspense fallback={null}>
                        {filtros.estado === 'con_espacio' ? (
                            <InvitacionCuenta
                                titulo="Todas las cuentas están llenas"
                                descripcion="No queda ningún espacio libre. Agrega una cuenta nueva para seguir acomodando clientes."
                                alCrear={nuevaCuenta}
                                secundaria={
                                    <EnlaceBoton href="/cuentas" variante="fantasma" tamano="sm" preserveState preserveScroll>
                                        Ver las cuentas activas
                                    </EnlaceBoton>
                                }
                            />
                        ) : (
                            <InvitacionCuenta
                                titulo={filtros.estado === 'todas' ? 'Aún no hay cuentas' : 'No hay cuentas activas'}
                                descripcion={`Cada cuenta es un Gmail con ${plural(negocio.capacidad, 'espacio')} para clientes y ${plural(negocio.meses_cuenta, 'mes', 'meses')} de vigencia. Agrega una para empezar a vender.`}
                                alCrear={nuevaCuenta}
                                secundaria={
                                    filtros.estado === 'activas' ? (
                                        <EnlaceBoton href="/cuentas?estado=todas" variante="fantasma" tamano="sm" preserveState preserveScroll>
                                            Ver todas las cuentas
                                        </EnlaceBoton>
                                    ) : undefined
                                }
                            />
                        )}
                    </Suspense>
                </section>
            )}

            {dialogoCuenta && <ModalCuenta cuenta={dialogoCuenta.cuenta} alCerrar={cerrarCuenta} />}

            {porActivarDialogo && <ModalActivar cuenta={porActivarDialogo} alCerrar={() => setPorActivarDialogo(null)} />}

            {dialogoEspacio && (
                <ModalEspacio cuenta={dialogoEspacio.cuenta} espacio={dialogoEspacio.espacio} vendedores={vendedores} alCerrar={cerrarEspacio} alGuardar={alGuardarCliente} alLiberar={pedirLiberar} />
            )}

            <Confirmar
                abierto={porEliminar !== null}
                titulo="¿Eliminar la cuenta?"
                textoConfirmar="Eliminar cuenta"
                cargando={procesando}
                alCancelar={() => setPorEliminar(null)}
                alConfirmar={eliminarCuenta}
            >
                {porEliminar && (
                    <>
                        Se eliminará <strong className="font-semibold break-all text-texto">{porEliminar.email}</strong>
                        {porEliminar.ocupados === 0
                            ? '. No tiene clientes.'
                            : esAdmin
                              ? ` junto con ${porEliminar.ocupados === 1 ? 'su cliente' : `sus ${porEliminar.ocupados} clientes`}: ${porEliminar.ocupados === 1 ? 'su venta' : 'sus ventas'} (${dinero(porEliminar.ingresos)}) ${porEliminar.ocupados === 1 ? 'dejará' : 'dejarán'} de contar en los reportes. No se puede deshacer.`
                              : `. Tiene ${plural(porEliminar.ocupados, 'cliente')}: solo el administrador puede eliminar cuentas con clientes.`}
                    </>
                )}
            </Confirmar>

            <Confirmar
                abierto={porLiberar !== null}
                titulo="¿Liberar el espacio?"
                textoConfirmar="Liberar espacio"
                cargando={procesando}
                alCancelar={() => setPorLiberar(null)}
                alConfirmar={liberarEspacio}
            >
                {porLiberar && (
                    <>
                        Se quitará a <strong className="font-semibold break-all text-texto">{porLiberar.espacio.client_email}</strong> de {porLiberar.cuenta.email}. Su venta de{' '}
                        {dinero(porLiberar.espacio.price_cents)} dejará de contar en los reportes y el espacio quedará libre.
                    </>
                )}
            </Confirmar>
        </AppLayout>
    );
}
