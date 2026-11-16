import { Link } from '@inertiajs/react';
import { Plus, Receipt } from 'lucide-react';
import Magnet from '@/components/reactbits/Magnet';
import { Boton, EnlaceBoton } from '@/components/ui/Boton';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Tabla, type Columna } from '@/components/ui/Tabla';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { dinero, plural } from '@/lib/formato';
import type { Espacio } from '@/types';

export interface VentasDiaProps {
    ventas: Espacio[];
    esHoy: boolean;
    /** Hay al menos una cuenta vigente con espacio: se puede agregar una venta desde aquí. */
    hayEspacio: boolean;
    /** true = «Agregar venta» es la acción principal de la pantalla (el socio no captura publicidad). */
    accionPrincipal: boolean;
    alAgregar: () => void;
    className?: string;
}

function Cuenta({ venta }: { venta: Espacio }) {
    if (!venta.account_email) return <span className="text-tenue">Sin cuenta</span>;

    return (
        <Link
            href={`/cuentas?estado=todas&q=${encodeURIComponent(venta.account_email)}`}
            className="break-all text-suave underline decoration-borde-fuerte underline-offset-4 transition-colors hover:text-acento hover:decoration-acento/60"
            title="Ver la cuenta"
        >
            {venta.account_email}
        </Link>
    );
}

/** Ventas capturadas con la fecha del día: a quién, en qué cuenta, quién vendió y cuánto. El pie suma el total. */
export function VentasDia({ ventas, esHoy, hayEspacio, accionPrincipal, alAgregar, className }: VentasDiaProps) {
    const total = ventas.reduce((suma, venta) => suma + venta.price_cents, 0);

    const columnas: Columna<Espacio>[] = [
        {
            clave: 'cliente',
            titulo: 'Cliente',
            celda: (venta) => (
                <>
                    <span className="block font-medium break-all text-texto">{venta.client_email}</span>
                    {venta.client_phone && <span className="cifras block text-xs text-tenue">{venta.client_phone}</span>}
                    {/* Celular: cuenta y vendedor bajan aquí (sus columnas se ocultan). */}
                    <span className="mt-0.5 block text-xs text-tenue sm:hidden">
                        {venta.seller_name ?? 'Sin vendedor'}
                        {venta.account_email && <span className="break-all"> · {venta.account_email}</span>}
                    </span>
                </>
            ),
            pie: (
                <>
                    Total <span className="font-normal text-tenue">· {plural(ventas.length, 'venta')}</span>
                </>
            ),
        },
        { clave: 'cuenta', titulo: 'Cuenta', celda: (venta) => <Cuenta venta={venta} />, ocultar: 'movil' },
        { clave: 'vendedor', titulo: 'Vendedor', celda: (venta) => venta.seller_name ?? <span className="text-tenue">Sin vendedor</span>, ocultar: 'movil', clase: 'whitespace-nowrap' },
        { clave: 'precio', titulo: 'Precio', numerica: true, celda: (venta) => dinero(venta.price_cents), pie: dinero(total, { mxn: true }) },
    ];

    const botonAgregar = hayEspacio ? (
        <Boton variante={accionPrincipal ? 'primario' : 'secundario'} tamano="sm" icono={<Plus className="size-4" aria-hidden="true" />} onClick={alAgregar}>
            Agregar venta
        </Boton>
    ) : null;

    return (
        <Tarjeta
            className={cn('flex flex-col', className)}
            relleno="ninguno"
            titulo={esHoy ? 'Ventas de hoy' : 'Ventas del día'}
            descripcion={ventas.length > 0 ? `${plural(ventas.length, 'cliente')} · ${dinero(total)}` : 'Clientes capturados con esta fecha'}
            acciones={ventas.length > 0 ? botonAgregar : undefined}
        >
            {ventas.length === 0 ? (
                <div className="flex flex-1 items-center justify-center border-t border-borde">
                    <EstadoVacio
                        compacto
                        icono={<Receipt className="size-5" />}
                        titulo={esHoy ? 'Aún no hay ventas hoy' : 'Sin ventas este día'}
                        descripcion={
                            hayEspacio
                                ? 'Cuando captures un cliente con esta fecha aparecerá aquí y entrará al reparto.'
                                : 'No hay cuentas vigentes con espacio libre: da de alta una cuenta para capturar la venta.'
                        }
                        accion={
                            <Magnet padding={36} magnetStrength={4}>
                                {hayEspacio ? (
                                    <Boton variante={accionPrincipal ? 'primario' : 'secundario'} icono={<Plus className="size-4" aria-hidden="true" />} onClick={alAgregar}>
                                        Agregar venta
                                    </Boton>
                                ) : (
                                    <EnlaceBoton href="/cuentas" icono={<Plus className="size-4" aria-hidden="true" />}>
                                        Dar de alta una cuenta
                                    </EnlaceBoton>
                                )}
                            </Magnet>
                        }
                    />
                </div>
            ) : (
                <Tabla className="border-t border-borde" sinMarco titulo={esHoy ? 'Ventas de hoy' : 'Ventas del día'} filas={ventas} clave={(venta) => venta.id} columnas={columnas} />
            )}
        </Tarjeta>
    );
}
