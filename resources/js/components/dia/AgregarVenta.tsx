import { Layers, Plus } from 'lucide-react';
import { useState } from 'react';
import { Aparecer } from '@/components/ui/Aparecer';
import { BarraEspacios } from '@/components/ui/BarraEspacios';
import { EnlaceBoton } from '@/components/ui/Boton';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { diasRestantes, fechaCorta, plural } from '@/lib/formato';
import type { Cuenta } from '@/types';
import { capitalizar } from './utilidades';

/** Cuántas cuentas se muestran antes de «Ver todas» (la lista es un atajo, no la pantalla de cuentas). */
const MAXIMO = 6;

export interface AgregarVentaProps {
    /** Cuentas vigentes con espacio libre (props.conEspacio). */
    cuentas: Cuenta[];
    /** Día con el que se registrará la venta ('AAAA-MM-DD'). */
    fecha: string;
    esHoy: boolean;
    /** Abre el formulario de venta con esa cuenta ya elegida. */
    alElegir: (cuenta: Cuenta) => void;
    className?: string;
}

/**
 * «Agregar venta de este día»: las cuentas vigentes con lugar, compactas. Tocar una abre el formulario del cliente
 * con esa cuenta y la fecha del día en pantalla.
 */
export function AgregarVenta({ cuentas, fecha, esHoy, alElegir, className }: AgregarVentaProps) {
    const [todas, setTodas] = useState(false);
    const libres = cuentas.reduce((suma, cuenta) => suma + cuenta.libres, 0);
    const visibles = todas ? cuentas : cuentas.slice(0, MAXIMO);
    const ocultas = cuentas.length - visibles.length;

    return (
        <Tarjeta
            className={className}
            relleno="ninguno"
            titulo={esHoy ? 'Agregar venta de hoy' : 'Agregar venta de este día'}
            descripcion={
                cuentas.length > 0
                    ? `${plural(libres, 'espacio libre', 'espacios libres')} en ${plural(cuentas.length, 'cuenta vigente', 'cuentas vigentes')} · se registra con fecha ${esHoy ? 'de hoy' : fechaCorta(fecha)}`
                    : 'Cuentas vigentes con espacio para otro cliente'
            }
            acciones={
                cuentas.length > 0 && (
                    <EnlaceBoton href="/cuentas?estado=con_espacio" tamano="sm" variante="fantasma">
                        Ver en Cuentas
                    </EnlaceBoton>
                )
            }
        >
            {cuentas.length === 0 ? (
                <div className="border-t border-borde">
                    <EstadoVacio
                        compacto
                        icono={<Layers className="size-5" />}
                        titulo="No hay espacios libres"
                        descripcion="Ninguna cuenta vigente tiene lugar para otro cliente: da de alta una cuenta para seguir vendiendo."
                        accion={
                            <EnlaceBoton href="/cuentas" icono={<Plus className="size-4" aria-hidden="true" />}>
                                Dar de alta una cuenta
                            </EnlaceBoton>
                        }
                    />
                </div>
            ) : (
                <div className="border-t border-borde p-3 sm:p-4">
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {visibles.map((cuenta, indice) => (
                            <Aparecer como="li" key={cuenta.id} indice={indice}>
                                <button
                                    type="button"
                                    onClick={() => alElegir(cuenta)}
                                    aria-haspopup="dialog"
                                    aria-label={`Agregar venta en ${cuenta.email}: ${plural(cuenta.libres, 'espacio libre', 'espacios libres')}, ${diasRestantes(cuenta.dias_restantes)}`}
                                    className="group flex w-full items-center gap-3 rounded-campo border border-borde bg-superficie-2/50 px-3.5 py-3 text-left transition-[border-color,background-color] duration-150 hover:border-acento/45 hover:bg-superficie-2"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-texto">{cuenta.email}</span>
                                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                                            <BarraEspacios ocupados={cuenta.ocupados} capacidad={cuenta.capacidad} tamano="sm" conTexto />
                                            <span className={cn(cuenta.por_vencer ? 'font-medium text-alerta' : 'text-tenue')}>{capitalizar(diasRestantes(cuenta.dias_restantes))}</span>
                                        </span>
                                    </span>
                                    <span
                                        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-borde-fuerte text-suave transition-colors duration-150 group-hover:border-acento/60 group-hover:bg-acento/12 group-hover:text-acento"
                                        aria-hidden="true"
                                    >
                                        <Plus className="size-4" />
                                    </span>
                                </button>
                            </Aparecer>
                        ))}
                    </ul>
                    {(ocultas > 0 || todas) && cuentas.length > MAXIMO && (
                        <button type="button" onClick={() => setTodas(!todas)} aria-expanded={todas} className="mt-3 rounded-campo px-1.5 py-1 text-[13px] font-medium text-acento transition-colors hover:text-acento-fuerte">
                            {todas ? 'Ver menos' : `Ver ${ocultas === 1 ? 'la otra cuenta' : `las otras ${ocultas} cuentas`} con espacio`}
                        </button>
                    )}
                </div>
            )}
        </Tarjeta>
    );
}
