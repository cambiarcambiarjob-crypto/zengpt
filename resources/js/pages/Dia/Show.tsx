import { router } from '@inertiajs/react';
import { useCallback, useRef, useState } from 'react';
import { AgregarVenta } from '@/components/dia/AgregarVenta';
import { ModalVenta } from '@/components/dia/ModalVenta';
import { NavegadorFecha } from '@/components/dia/NavegadorFecha';
import { PublicidadDia } from '@/components/dia/PublicidadDia';
import { RepartoDia } from '@/components/dia/RepartoDia';
import { ResumenDia } from '@/components/dia/ResumenDia';
import { capitalizar } from '@/components/dia/utilidades';
import { VentasDia } from '@/components/dia/VentasDia';
import ShinyText from '@/components/reactbits/ShinyText';
import { Aparecer } from '@/components/ui/Aparecer';
import { Confirmar } from '@/components/ui/Confirmar';
import { Insignia } from '@/components/ui/Insignia';
import AppLayout from '@/layouts/AppLayout';
import { cn } from '@/lib/cn';
import { diasEnPalabras, diasEntre, fechaLarga } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { DiaProps } from '@/types';

/**
 * El cierre del día. De arriba abajo, en el orden en que se cierra: cuánto quedó (neto y reparto) → qué se vendió →
 * cuánto se gastó en publicidad → qué le toca a cada quien → capturar lo que falte con la fecha de ese día.
 *
 * Al cambiar de día la pantalla no se desmonta (preserveState): el encabezado se queda quieto, las cifras del resumen
 * cuentan del valor anterior al nuevo y solo las secciones con estado propio (publicidad, listas) se rehacen con `key`.
 */
export default function DiaShow() {
    const { fecha, anterior, siguiente, esHoy, ventas, publicidad, reparto, puedeEditarPublicidad, vendedores, conEspacio, auth, negocio } = usePagina<DiaProps>();
    const esAdmin = auth.user?.is_admin ?? false;
    const nombreDueno = reparto.filas.find((fila) => fila.is_owner)?.name ?? vendedores.find((vendedor) => vendedor.is_owner)?.name ?? 'Dueño';

    const [cargando, setCargando] = useState(false);
    // Venta en captura: null = ventana cerrada; cuenta null = se elige dentro de la ventana.
    const [venta, setVenta] = useState<{ cuenta: number | null } | null>(null);
    // Publicidad escrita sin guardar: antes de cambiar de día se pregunta.
    const publicidadPendiente = useRef(false);
    const [destinoPendiente, setDestinoPendiente] = useState<string | null>(null);
    const [version, setVersion] = useState(0);

    const visitar = useCallback((destino: string) => {
        router.get(
            `/dia/${destino}`,
            {},
            {
                preserveState: true,
                preserveScroll: true,
                onStart: () => setCargando(true),
                onFinish: () => setCargando(false),
            },
        );
    }, []);

    const ir = useCallback(
        (destino: string) => {
            if (destino === fecha) return;

            if (publicidadPendiente.current) setDestinoPendiente(destino);
            else visitar(destino);
        },
        [fecha, visitar],
    );

    const alCambiarPendiente = useCallback((pendiente: boolean) => {
        publicidadPendiente.current = pendiente;
    }, []);

    const otroAnio = fecha.slice(0, 4) !== negocio.hoy.slice(0, 4);

    return (
        <AppLayout
            titulo={capitalizar(fechaLarga(fecha, { anio: otroAnio }))}
            descripcion={
                <>
                    {esHoy ? (
                        <Insignia estado="acento" className="mr-2 align-middle">
                            <ShinyText text="Hoy" color="#34d8a6" shineColor="#e8eeeb" speed={2.2} delay={6} />
                        </Insignia>
                    ) : (
                        <Insignia estado="neutral" sinPunto className="mr-2 align-middle">
                            {capitalizar(diasEnPalabras(diasEntre(negocio.hoy, fecha)))}
                        </Insignia>
                    )}
                    Cierre del día: ventas, publicidad y reparto.
                </>
            }
            acciones={<NavegadorFecha fecha={fecha} anterior={anterior} siguiente={siguiente} esHoy={esHoy} hoy={negocio.hoy} alIr={ir} version={version} />}
        >
            <div className={cn('grid grid-cols-1 gap-4 transition-opacity duration-200 xl:grid-cols-12', cargando && 'opacity-60')} aria-busy={cargando || undefined}>
                <Aparecer indice={0} className="xl:col-span-12">
                    <ResumenDia totales={reparto.totales} esHoy={esHoy} nombreDueno={nombreDueno} porcentajeSocio={negocio.porcentaje_socio} esAdmin={esAdmin} />
                </Aparecer>

                <Aparecer key={`ventas-${fecha}`} indice={1} className="xl:col-span-7">
                    <VentasDia className="h-full" ventas={ventas} esHoy={esHoy} hayEspacio={conEspacio.length > 0} accionPrincipal={!puedeEditarPublicidad} alAgregar={() => setVenta({ cuenta: null })} />
                </Aparecer>

                <Aparecer key={`publicidad-${fecha}`} indice={2} className="xl:col-span-5">
                    <PublicidadDia
                        className="h-full"
                        fecha={fecha}
                        publicidad={publicidad}
                        filas={reparto.filas}
                        ventas={reparto.totales.ventas}
                        puedeEditar={puedeEditarPublicidad}
                        alCambiarPendiente={alCambiarPendiente}
                    />
                </Aparecer>

                <Aparecer key={`reparto-${fecha}`} indice={3} className="xl:col-span-12">
                    <RepartoDia
                        filas={reparto.filas}
                        totales={reparto.totales}
                        nombreDueno={nombreDueno}
                        porcentajeSocio={negocio.porcentaje_socio}
                        porcentajeVendedor={negocio.porcentaje_vendedor}
                        esAdmin={esAdmin}
                    />
                </Aparecer>

                <Aparecer key={`agregar-${fecha}`} indice={4} className="xl:col-span-12">
                    <AgregarVenta cuentas={conEspacio} fecha={fecha} esHoy={esHoy} alElegir={(cuenta) => setVenta({ cuenta: cuenta.id })} />
                </Aparecer>
            </div>

            {venta && <ModalVenta fecha={fecha} esHoy={esHoy} cuentas={conEspacio} cuentaInicial={venta.cuenta} vendedores={vendedores} alCerrar={() => setVenta(null)} />}

            <Confirmar
                abierto={destinoPendiente !== null}
                titulo="¿Cambiar de día sin guardar?"
                textoConfirmar="Cambiar sin guardar"
                variante="peligro"
                alCancelar={() => {
                    setDestinoPendiente(null);
                    setVersion((n) => n + 1);
                }}
                alConfirmar={() => {
                    const destino = destinoPendiente;
                    setDestinoPendiente(null);
                    if (destino) visitar(destino);
                }}
            >
                Escribiste montos de publicidad que aún no guardas. Si cambias de día se pierden.
            </Confirmar>
        </AppLayout>
    );
}
