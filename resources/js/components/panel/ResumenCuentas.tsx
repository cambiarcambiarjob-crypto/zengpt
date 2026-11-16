import { Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import CountUp from '@/components/reactbits/CountUp';
import { EnlaceBoton } from '@/components/ui/Boton';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { numero, plural, porcentaje } from '@/lib/formato';
import { useMovimientoReducido } from '@/lib/movimiento';
import type { DashboardProps } from '@/types';

interface Dato {
    clave: string;
    etiqueta: string;
    valor: number;
    href: string;
    tono?: 'acento' | 'peligro';
}

/**
 * Estado de las cuentas: cuántas hay vigentes, cuánto de su capacidad está vendida (barra de ocupación),
 * clientes totales y cuentas vencidas. Cada dato lleva a la lista de cuentas ya filtrada.
 */
export function ResumenCuentas({ cuentas, className }: { cuentas: DashboardProps['cuentas']; className?: string }) {
    const reducido = useMovimientoReducido();
    const [listo, setListo] = useState(reducido);
    const proporcion = cuentas.capacidad_total > 0 ? Math.min(1, cuentas.espacios_ocupados / cuentas.capacidad_total) : 0;

    // La barra crece una sola vez al entrar (solo transform: no mueve nada de su lugar).
    useEffect(() => {
        let id = requestAnimationFrame(() => {
            id = requestAnimationFrame(() => setListo(true));
        });

        return () => cancelAnimationFrame(id);
    }, []);

    const datos: Dato[] = [
        { clave: 'activas', etiqueta: 'Cuentas activas', valor: cuentas.activas, href: '/cuentas?estado=activas' },
        { clave: 'libres', etiqueta: 'Espacios libres', valor: cuentas.espacios_libres, href: '/cuentas?estado=con_espacio', tono: cuentas.espacios_libres > 0 ? 'acento' : undefined },
        { clave: 'clientes', etiqueta: 'Clientes totales', valor: cuentas.clientes, href: '/cuentas?estado=todas' },
        { clave: 'vencidas', etiqueta: 'Cuentas vencidas', valor: cuentas.vencidas, href: '/cuentas?estado=vencidas', tono: cuentas.vencidas > 0 ? 'peligro' : undefined },
    ];

    return (
        <Tarjeta
            className={cn('flex flex-col', className)}
            titulo="Cuentas"
            acciones={
                <EnlaceBoton href="/cuentas" tamano="sm" iconoFinal={<ArrowRight className="size-4" aria-hidden="true" />}>
                    Ver cuentas
                </EnlaceBoton>
            }
        >
            <div>
                <div className="flex items-baseline justify-between gap-3">
                    <p id="rotulo-ocupacion" className="text-[13px] font-medium text-suave">
                        Ocupación
                    </p>
                    <p className="cifras text-[13px] text-suave">
                        {cuentas.capacidad_total > 0 ? (
                            <>
                                <span className="font-semibold text-texto">{numero(cuentas.espacios_ocupados)}</span> de {plural(cuentas.capacidad_total, 'espacio')} ·{' '}
                                <span className="font-semibold text-texto">{porcentaje(Math.round(proporcion * 100))}</span>
                            </>
                        ) : (
                            'Sin cuentas activas'
                        )}
                    </p>
                </div>
                <div
                    role="meter"
                    aria-labelledby="rotulo-ocupacion"
                    aria-valuemin={0}
                    aria-valuemax={cuentas.capacidad_total}
                    aria-valuenow={cuentas.espacios_ocupados}
                    aria-valuetext={`${cuentas.espacios_ocupados} de ${cuentas.capacidad_total} espacios ocupados, ${cuentas.espacios_libres} libres`}
                    className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-acento/14"
                >
                    <div
                        className="h-full origin-left rounded-full bg-linear-to-r from-acento-hondo to-acento transition-transform duration-700 ease-suave"
                        style={{ width: `${proporcion * 100}%`, transform: listo ? 'scaleX(1)' : 'scaleX(0)' }}
                    />
                </div>
                <div className="mt-2 flex justify-between text-xs text-tenue">
                    <span>{plural(cuentas.espacios_ocupados, 'ocupado')}</span>
                    <span>{plural(cuentas.espacios_libres, 'libre')}</span>
                </div>
            </div>

            <ul className="mt-auto grid grid-cols-2 gap-2 pt-5 sm:grid-cols-4 xl:grid-cols-2">
                {datos.map((dato) => (
                    <li key={dato.clave} className="min-w-0">
                        <Link
                            href={dato.href}
                            className="flex h-full flex-col rounded-campo border border-borde bg-superficie-2/60 px-3.5 py-3 transition-colors duration-150 hover:border-borde-fuerte hover:bg-superficie-2"
                        >
                            <span className={cn('cifras font-titulo text-2xl leading-tight font-semibold', dato.tono === 'acento' ? 'text-acento' : dato.tono === 'peligro' ? 'text-peligro' : 'text-texto')}>
                                <span className="sr-only">{numero(dato.valor)}</span>
                                <span aria-hidden="true">
                                    <CountUp to={dato.valor} from={0} duration={0.9} easing="expo" separator="," />
                                </span>
                            </span>
                            <span className="mt-1 text-xs leading-snug font-medium text-suave">{dato.etiqueta}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </Tarjeta>
    );
}
