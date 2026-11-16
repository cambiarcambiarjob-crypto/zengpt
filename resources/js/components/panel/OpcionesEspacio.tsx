import { Link } from '@inertiajs/react';
import { ArrowRight, ChevronRight, Layers, Plus } from 'lucide-react';
import Magnet from '@/components/reactbits/Magnet';
import { Aparecer } from '@/components/ui/Aparecer';
import { BarraEspacios } from '@/components/ui/BarraEspacios';
import { EnlaceBoton } from '@/components/ui/Boton';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Insignia } from '@/components/ui/Insignia';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { diasRestantes, fechaCorta, plural } from '@/lib/formato';
import type { Cuenta } from '@/types';
import { capitalizar } from './texto';

/** Cuántas cuentas se listan antes de mandar a la pantalla de cuentas (el panel no debe crecer sin fin). */
const MAXIMO = 6;

const CAPTURAR = '/cuentas?estado=con_espacio';

/**
 * «Las opciones que tengo»: cuentas vigentes con espacio libre, con su barra de espacios y cuánto les queda de vigencia.
 * Cada renglón lleva a capturar en esa cuenta (la lista de cuentas con espacio, ya buscando su Gmail).
 */
export function OpcionesEspacio({ cuentas, className }: { cuentas: Cuenta[]; className?: string }) {
    const libres = cuentas.reduce((suma, cuenta) => suma + cuenta.libres, 0);
    const visibles = cuentas.slice(0, MAXIMO);
    const restantes = cuentas.length - visibles.length;

    return (
        <Tarjeta
            className={cn('flex flex-col', className)}
            relleno="ninguno"
            titulo="Opciones que tengo"
            descripcion={cuentas.length > 0 ? `${plural(libres, 'espacio libre', 'espacios libres')} en ${plural(cuentas.length, 'cuenta vigente', 'cuentas vigentes')}` : 'Cuentas vigentes con espacio para otro cliente'}
            acciones={
                cuentas.length > 0 && (
                    <EnlaceBoton href={CAPTURAR} tamano="sm" iconoFinal={<ArrowRight className="size-4" aria-hidden="true" />}>
                        Ir a capturar
                    </EnlaceBoton>
                )
            }
        >
            {cuentas.length === 0 ? (
                <EstadoVacio
                    className="my-auto"
                    compacto
                    icono={<Layers className="size-5" />}
                    titulo="No hay espacios libres"
                    descripcion="Ninguna cuenta vigente tiene lugar para otro cliente: da de alta una cuenta para seguir vendiendo."
                    accion={
                        <Magnet padding={36} magnetStrength={4}>
                            <EnlaceBoton href="/cuentas" variante="primario" icono={<Plus className="size-4" aria-hidden="true" />}>
                                Dar de alta una cuenta
                            </EnlaceBoton>
                        </Magnet>
                    }
                />
            ) : (
                <>
                    <ul className="border-t border-borde">
                        {visibles.map((cuenta, indice) => (
                            <Aparecer como="li" key={cuenta.id} indice={indice} className="border-b border-borde/70 last:border-b-0">
                                <Link
                                    href={`${CAPTURAR}&q=${encodeURIComponent(cuenta.email)}`}
                                    aria-label={`Capturar en ${cuenta.email}: ${plural(cuenta.libres, 'espacio libre', 'espacios libres')}, ${diasRestantes(cuenta.dias_restantes)}`}
                                    className="group flex items-center gap-3 px-5 py-3 transition-colors duration-100 hover:bg-superficie-2/70 focus-visible:-outline-offset-2 sm:gap-4 sm:px-6"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-texto">{cuenta.email}</span>
                                        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:mt-0.5">
                                            {/* Celular: la barra baja al segundo renglón para que el Gmail se lea completo. */}
                                            <BarraEspacios ocupados={cuenta.ocupados} capacidad={cuenta.capacidad} tamano="sm" conTexto className="sm:hidden" />
                                            <span className={cuenta.por_vencer ? 'font-medium text-alerta' : 'text-tenue'}>{capitalizar(diasRestantes(cuenta.dias_restantes))}</span>
                                            <span className="text-tenue max-sm:hidden" aria-hidden="true">
                                                · {fechaCorta(cuenta.expires_on)}
                                            </span>
                                        </span>
                                    </span>
                                    <BarraEspacios ocupados={cuenta.ocupados} capacidad={cuenta.capacidad} conTexto className="max-sm:hidden" />
                                    <Insignia estado="libre" sinPunto className="cifras min-w-[4.25rem] justify-center">
                                        {plural(cuenta.libres, 'libre')}
                                    </Insignia>
                                    <ChevronRight className="size-4 shrink-0 text-tenue transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-acento max-sm:hidden" aria-hidden="true" />
                                </Link>
                            </Aparecer>
                        ))}
                    </ul>
                    {restantes > 0 && (
                        <p className="mt-auto border-t border-borde px-5 py-3 text-[13px] sm:px-6">
                            <Link href={CAPTURAR} className="font-medium text-acento hover:text-acento-fuerte">
                                Ver {restantes === 1 ? 'la otra cuenta' : `las otras ${restantes} cuentas`} con espacio
                            </Link>
                        </p>
                    )}
                </>
            )}
        </Tarjeta>
    );
}
