import { CalendarCheck, CalendarRange, History, Plus } from 'lucide-react';
import { CifraPeriodo } from '@/components/panel/CifraPeriodo';
import { GraficaSerie } from '@/components/panel/GraficaSerie';
import { Heroe } from '@/components/panel/Heroe';
import { OpcionesEspacio } from '@/components/panel/OpcionesEspacio';
import { PorVencer } from '@/components/panel/PorVencer';
import { ResumenCuentas } from '@/components/panel/ResumenCuentas';
import { capitalizar } from '@/components/panel/texto';
import { TuParte } from '@/components/panel/TuParte';
import { VendedoresMes } from '@/components/panel/VendedoresMes';
import { Aparecer } from '@/components/ui/Aparecer';
import { EnlaceBoton } from '@/components/ui/Boton';
import AppLayout from '@/layouts/AppLayout';
import { mesLargo, rangoFechas } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { DashboardProps } from '@/types';

/**
 * Panel: lo primero que ven el dueño y el socio. De arriba abajo, en el orden en que lo preguntan:
 * cuánto se ganó (hoy, mi parte, mes, histórico) → cómo están las cuentas → dónde cabe el siguiente cliente
 * → qué está por vencer → cómo van los últimos 30 días → cómo se reparte el mes entre vendedores.
 */
export default function Dashboard() {
    const { hoy, mes, historico, porVendedorMes, serie, cuentas, conEspacio, porVencer, auth, negocio } = usePagina<DashboardProps>();
    const esAdmin = auth.user?.is_admin ?? false;
    const nombre = auth.user?.name ?? '';
    // El nombre del dueño sale del catálogo de vendedores del mes (si no aparece, las tarjetas dicen solo «Dueño»).
    const dueno = porVendedorMes.find((fila) => fila.is_owner)?.name;

    return (
        <AppLayout
            titulo="Panel"
            ancho="ancho"
            acciones={
                <>
                    <EnlaceBoton href="/dia" icono={<CalendarCheck className="size-4" aria-hidden="true" />}>
                        Cerrar el día
                    </EnlaceBoton>
                    <EnlaceBoton href="/cuentas" variante="primario" icono={<Plus className="size-4" aria-hidden="true" />}>
                        Capturar venta
                    </EnlaceBoton>
                </>
            }
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
                <Aparecer indice={0} className="sm:col-span-2 xl:col-span-8">
                    <Heroe className="h-full" nombre={nombre} hoy={hoy} />
                </Aparecer>
                <Aparecer indice={1} className="sm:col-span-2 xl:col-span-4">
                    <TuParte esAdmin={esAdmin} porcentajeSocio={negocio.porcentaje_socio} hoy={hoy} mes={mes} historico={historico} />
                </Aparecer>

                <Aparecer indice={2} className="xl:col-span-4">
                    <CifraPeriodo
                        className="h-full"
                        etiqueta="Ganancia del mes"
                        periodo={`${capitalizar(mesLargo(mes.hasta))} · ${rangoFechas(mes.desde, mes.hasta)}`}
                        icono={<CalendarRange className="size-4" />}
                        totales={mes}
                        nombreDueno={dueno}
                        porcentajeSocio={negocio.porcentaje_socio}
                        esAdmin={esAdmin}
                    />
                </Aparecer>
                <Aparecer indice={3} className="xl:col-span-4">
                    <CifraPeriodo
                        className="h-full"
                        etiqueta="Ganancia histórica"
                        periodo="Desde la primera venta"
                        icono={<History className="size-4" />}
                        totales={historico}
                        nombreDueno={dueno}
                        porcentajeSocio={negocio.porcentaje_socio}
                        esAdmin={esAdmin}
                    />
                </Aparecer>
                <Aparecer indice={4} className="sm:col-span-2 xl:col-span-4">
                    <ResumenCuentas className="h-full" cuentas={cuentas} />
                </Aparecer>

                <Aparecer indice={5} className="sm:col-span-2 xl:col-span-7">
                    <OpcionesEspacio className="h-full" cuentas={conEspacio} />
                </Aparecer>
                <Aparecer indice={6} className="sm:col-span-2 xl:col-span-5">
                    <PorVencer className="h-full" cuentas={porVencer} />
                </Aparecer>

                <Aparecer indice={7} className="sm:col-span-2 xl:col-span-12">
                    <GraficaSerie serie={serie} hoy={negocio.hoy} />
                </Aparecer>
                <Aparecer indice={8} className="sm:col-span-2 xl:col-span-12">
                    <VendedoresMes filas={porVendedorMes} mes={mes} esAdmin={esAdmin} porcentajeSocio={negocio.porcentaje_socio} />
                </Aparecer>
            </div>
        </AppLayout>
    );
}
