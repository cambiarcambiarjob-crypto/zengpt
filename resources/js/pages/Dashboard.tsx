// PANTALLA PROVISIONAL del panel: solo comprueba el layout y las piezas base con datos reales.
// El panel definitivo la reemplaza por completo (ver docs/INTERFAZ.md).
import { CalendarDays, Layers } from 'lucide-react';
import { Aparecer } from '@/components/ui/Aparecer';
import { BarraEspacios } from '@/components/ui/BarraEspacios';
import { EnlaceBoton } from '@/components/ui/Boton';
import { Cifra } from '@/components/ui/Cifra';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { InsigniaCuenta } from '@/components/ui/Insignia';
import { Tabla } from '@/components/ui/Tabla';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { TarjetaFoco } from '@/components/ui/TarjetaFoco';
import AppLayout from '@/layouts/AppLayout';
import { dinero, fechaCorta, fechaLarga, plural } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { DashboardProps } from '@/types';

export default function Dashboard() {
    const { hoy, mes, cuentas, conEspacio, porVencer } = usePagina<DashboardProps>();

    return (
        <AppLayout
            titulo="Panel"
            descripcion={<span className="first-letter:uppercase">Hoy es {fechaLarga(hoy.fecha)}</span>}
            acciones={
                <EnlaceBoton href="/dia" variante="primario" icono={<CalendarDays className="size-4" aria-hidden="true" />}>
                    Ventas de hoy
                </EnlaceBoton>
            }
        >
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <Aparecer indice={0}>
                    <TarjetaFoco className="h-full">
                        <Cifra etiqueta="Ventas de hoy" valor={hoy.ventas} detalle={plural(hoy.ventas_count, 'venta')} tono="acento" />
                    </TarjetaFoco>
                </Aparecer>
                <Aparecer indice={1}>
                    <TarjetaFoco className="h-full">
                        <Cifra etiqueta="Neto de hoy" valor={hoy.neto} detalle={`${dinero(hoy.publicidad)} de publicidad`} negativoEnRojo />
                    </TarjetaFoco>
                </Aparecer>
                <Aparecer indice={2}>
                    <TarjetaFoco className="h-full">
                        <Cifra etiqueta="Neto del mes" valor={mes.neto} detalle={plural(mes.ventas_count, 'venta')} negativoEnRojo />
                    </TarjetaFoco>
                </Aparecer>
                <Aparecer indice={3}>
                    <TarjetaFoco className="h-full">
                        <Cifra etiqueta="Espacios libres" valor={cuentas.espacios_libres} formato="numero" detalle={`de ${cuentas.capacidad_total} en ${plural(cuentas.activas, 'cuenta activa', 'cuentas activas')}`} />
                    </TarjetaFoco>
                </Aparecer>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <Tarjeta relleno="ninguno" titulo="Cuentas con espacio" descripcion="Dónde acomodar al siguiente cliente" acciones={<EnlaceBoton href="/cuentas" tamano="sm">Ver cuentas</EnlaceBoton>}>
                    <Tabla
                        sinMarco
                        titulo="Cuentas vigentes con espacios libres"
                        filas={conEspacio}
                        clave={(cuenta) => cuenta.id}
                        columnas={[
                            { clave: 'cuenta', titulo: 'Cuenta', celda: (cuenta) => <span className="font-medium">{cuenta.email}</span> },
                            { clave: 'espacios', titulo: 'Espacios', celda: (cuenta) => <BarraEspacios ocupados={cuenta.ocupados} capacidad={cuenta.capacidad} conTexto /> },
                            { clave: 'vence', titulo: 'Vence', celda: (cuenta) => fechaCorta(cuenta.expires_on), ocultar: 'movil', clase: 'text-suave whitespace-nowrap' },
                        ]}
                        vacio={<EstadoVacio compacto icono={<Layers className="size-5" />} titulo="Todas las cuentas están llenas" descripcion="Agrega una cuenta nueva para seguir vendiendo." />}
                    />
                </Tarjeta>

                <Tarjeta titulo="Por vencer" descripcion="Cuentas a las que les quedan pocos días">
                    {porVencer.length === 0 ? (
                        <EstadoVacio compacto titulo="Nada por vencer" descripcion="Ninguna cuenta vence en los próximos días." />
                    ) : (
                        <ul className="flex flex-col divide-y divide-borde/70">
                            {porVencer.map((cuenta) => (
                                <li key={cuenta.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-texto">{cuenta.email}</p>
                                        <p className="mt-0.5 text-xs text-tenue">{plural(cuenta.ocupados, 'cliente')}</p>
                                    </div>
                                    <InsigniaCuenta cuenta={cuenta} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Tarjeta>
            </div>
        </AppLayout>
    );
}
