import type { ReactNode } from 'react';
import CountUp from '@/components/reactbits/CountUp';
import { cn } from '@/lib/cn';
import { dinero, numero, porcentaje } from '@/lib/formato';

export type FormatoCifra = 'dinero' | 'numero' | 'porcentaje';
export type TonoCifra = 'normal' | 'acento' | 'exito' | 'alerta' | 'peligro' | 'suave';

const TONOS: Record<TonoCifra, string> = {
    normal: 'text-texto',
    acento: 'text-acento',
    exito: 'text-exito',
    alerta: 'text-alerta',
    peligro: 'text-peligro',
    suave: 'text-suave',
};

const TAMANOS = { sm: 'text-xl', md: 'text-[1.75rem]', lg: 'text-4xl', xl: 'text-5xl sm:text-6xl' } as const;

export interface CifraProps {
    /** Qué es el número («Ventas de hoy»). */
    etiqueta: ReactNode;
    /** El valor. Con formato 'dinero' va en CENTAVOS, tal como llega del servidor. */
    valor: number;
    /** dinero («$1,250») · numero («1,234») · porcentaje («10%»). */
    formato?: FormatoCifra;
    /** Línea pequeña bajo el número («3 ventas», «−$200 de publicidad»). */
    detalle?: ReactNode;
    /** Icono de lucide-react junto a la etiqueta. */
    icono?: ReactNode;
    tono?: TonoCifra;
    tamano?: keyof typeof TAMANOS;
    /** false = número fijo, sin conteo (listas largas o valores que cambian muy seguido). */
    animar?: boolean;
    /** Pone los negativos en rojo (neto del día, ganancias). */
    negativoEnRojo?: boolean;
    className?: string;
}

function textoFinal(valor: number, formato: FormatoCifra): string {
    if (formato === 'dinero') return dinero(valor);

    return formato === 'porcentaje' ? porcentaje(valor) : numero(valor);
}

/**
 * Número grande con etiqueta y conteo animado (CountUp de React Bits). Cifras tabulares: no «baila» al contar.
 * Con «reducir movimiento» muestra el valor final directo. El lector de pantalla siempre lee el valor final.
 *
 *   <Cifra etiqueta="Ventas de hoy" valor={hoy.ventas} formato="dinero" detalle={plural(hoy.ventas_count, 'venta')} />
 */
export function Cifra({ etiqueta, valor, formato = 'dinero', detalle, icono, tono = 'normal', tamano = 'md', animar = true, negativoEnRojo = false, className }: CifraProps) {
    const final = textoFinal(valor, formato);
    const negativo = valor < 0;
    const absoluto = Math.abs(valor);
    const conCentavos = formato === 'dinero' && Math.round(absoluto) % 100 !== 0;
    const decimales = formato === 'dinero' ? (conCentavos ? 2 : 0) : formato === 'porcentaje' && !Number.isInteger(valor) ? 1 : 0;

    return (
        <div className={cn('min-w-0', className)}>
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-suave">
                {icono && (
                    <span className="shrink-0 text-tenue" aria-hidden="true">
                        {icono}
                    </span>
                )}
                <span className="truncate">{etiqueta}</span>
            </p>
            <p className={cn('cifras mt-1.5 font-titulo leading-none font-semibold tracking-tight whitespace-nowrap', TAMANOS[tamano], negativoEnRojo && negativo ? 'text-peligro' : TONOS[tono])}>
                <span className="sr-only">{final}</span>
                <span aria-hidden="true">
                    {animar ? (
                        <CountUp
                            to={formato === 'dinero' ? absoluto / 100 : absoluto}
                            from={0}
                            duration={0.9}
                            easing="expo"
                            separator=","
                            decimals={decimales}
                            prefix={`${negativo ? '−' : ''}${formato === 'dinero' ? '$' : ''}`}
                            suffix={formato === 'porcentaje' ? '%' : ''}
                        />
                    ) : (
                        final
                    )}
                </span>
            </p>
            {detalle && <p className="mt-2 text-[13px] leading-snug text-tenue">{detalle}</p>}
        </div>
    );
}
