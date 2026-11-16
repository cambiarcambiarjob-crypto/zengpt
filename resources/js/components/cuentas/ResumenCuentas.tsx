import { memo } from 'react';
import { Cifra, type CifraProps } from '@/components/ui/Cifra';
import { TarjetaFoco } from '@/components/ui/TarjetaFoco';
import { plural } from '@/lib/formato';
import type { Cuenta } from '@/types';

export interface ResumenCuentasProps {
    cuentas: Cuenta[];
    /** false mientras se busca: las cifras cambian a cada tecla y contarlas desde cero distrae. */
    animar?: boolean;
    className?: string;
}

/**
 * Franja de totales de las cuentas que se están viendo (SpotlightCard + CountUp de React Bits): cuántas son,
 * cuántos espacios quedan para vender, cuántos clientes hay y cuánto han dejado.
 */
export const ResumenCuentas = memo(function ResumenCuentas({ cuentas, animar = true, className }: ResumenCuentasProps) {
    const vigentes = cuentas.filter((cuenta) => cuenta.activa);
    const vencidas = cuentas.length - vigentes.length;
    const porVencer = vigentes.filter((cuenta) => cuenta.por_vencer).length;
    const libres = vigentes.reduce((suma, cuenta) => suma + cuenta.libres, 0);
    const conEspacio = vigentes.filter((cuenta) => cuenta.libres > 0).length;
    const clientes = cuentas.reduce((suma, cuenta) => suma + cuenta.ocupados, 0);
    const capacidad = cuentas.reduce((suma, cuenta) => suma + cuenta.capacidad, 0);
    const ingresos = cuentas.reduce((suma, cuenta) => suma + cuenta.ingresos, 0);

    const detalleCuentas = [porVencer > 0 ? `${porVencer} por vencer` : null, vencidas > 0 ? plural(vencidas, 'vencida') : null].filter(Boolean).join(' · ') || 'al corriente';

    const sinCuentas = cuentas.length === 0;

    const celdas: { clave: string; cifra: CifraProps; detalle: string }[] = [
        { clave: 'cuentas', cifra: { etiqueta: 'Cuentas', valor: cuentas.length, formato: 'numero' }, detalle: detalleCuentas },
        { clave: 'libres', cifra: { etiqueta: 'Espacios libres', valor: libres, formato: 'numero', tono: libres > 0 ? 'acento' : 'normal' }, detalle: libres > 0 ? `en ${plural(conEspacio, 'cuenta')}` : 'nada por vender' },
        { clave: 'clientes', cifra: { etiqueta: 'Clientes', valor: clientes, formato: 'numero' }, detalle: `de ${plural(capacidad, 'espacio')}` },
        { clave: 'ingresos', cifra: { etiqueta: 'Ingresos', valor: ingresos }, detalle: 'en total' },
    ];

    return (
        <TarjetaFoco relleno="ninguno" className={className}>
            <div className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-borde">
                {celdas.map(({ clave, cifra, detalle }) => (
                    <div key={clave} className="flex min-w-0 items-end justify-between gap-3 px-5 py-3.5">
                        <Cifra tamano="sm" animar={animar} {...cifra} />
                        {!sinCuentas && <p className="truncate pb-px text-[13px] leading-none text-tenue">{detalle}</p>}
                    </div>
                ))}
            </div>
        </TarjetaFoco>
    );
});
