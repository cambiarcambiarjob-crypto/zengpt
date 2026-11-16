import { Link, type InertiaLinkProps } from '@inertiajs/react';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '@/lib/cn';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma';
export type TamanoBoton = 'sm' | 'md' | 'lg';

const BASE =
    'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-campo font-medium ' +
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] ' +
    'disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55';

const VARIANTES: Record<VarianteBoton, string> = {
    primario: 'bg-acento font-semibold text-sobre-acento shadow-[0_6px_20px_-8px_rgb(52_216_166/0.55)] hover:bg-acento-fuerte',
    secundario: 'border border-borde-fuerte bg-superficie-2 text-texto hover:border-tenue/60 hover:bg-superficie-3',
    peligro: 'border border-peligro/40 bg-peligro/12 text-peligro hover:border-peligro/60 hover:bg-peligro/20',
    fantasma: 'text-suave hover:bg-superficie-2 hover:text-texto',
};

const TAMANOS: Record<TamanoBoton, string> = {
    sm: 'h-8 px-3 text-[13px]',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-5 text-[15px]',
};

/** Clases de un botón, por si necesitas dárselas a otro elemento (un <a>, un <label>…). */
export function estilosBoton(opciones: { variante?: VarianteBoton; tamano?: TamanoBoton; anchoCompleto?: boolean; soloIcono?: boolean } = {}): string {
    const { variante = 'secundario', tamano = 'md', anchoCompleto = false, soloIcono = false } = opciones;

    return cn(BASE, VARIANTES[variante], TAMANOS[tamano], anchoCompleto && 'w-full', soloIcono && 'aspect-square px-0!');
}

/** Indicador de carga (círculo que gira). Hereda el color del texto. */
export function Cargador({ className }: { className?: string }) {
    return (
        <svg className={cn('size-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** primario = acción principal (una por vista) · secundario (por defecto) · peligro = borrar · fantasma = acción discreta. */
    variante?: VarianteBoton;
    tamano?: TamanoBoton;
    /** Muestra el indicador de carga y deshabilita el botón sin cambiar su tamaño (usa `form.processing`). */
    cargando?: boolean;
    /** Icono a la izquierda del texto (p. ej. <Plus className="size-4" /> de lucide-react). */
    icono?: ReactNode;
    /** Icono a la derecha del texto. */
    iconoFinal?: ReactNode;
    anchoCompleto?: boolean;
    /** Botón cuadrado solo con icono: pasa el icono como children y un `aria-label`. */
    soloIcono?: boolean;
    ref?: Ref<HTMLButtonElement>;
}

/** Botón del sistema. `type="button"` por defecto: en formularios pon `type="submit"`. */
export function Boton({
    variante = 'secundario',
    tamano = 'md',
    cargando = false,
    icono,
    iconoFinal,
    anchoCompleto = false,
    soloIcono = false,
    className,
    children,
    disabled,
    type = 'button',
    ...resto
}: BotonProps) {
    return (
        <button
            type={type}
            disabled={disabled || cargando}
            aria-busy={cargando || undefined}
            className={cn(estilosBoton({ variante, tamano, anchoCompleto, soloIcono }), className)}
            {...resto}
        >
            <span className={cn('inline-flex items-center justify-center gap-2', cargando && 'opacity-0')}>
                {icono}
                {children}
                {iconoFinal}
            </span>
            {cargando && (
                <span className="absolute inset-0 flex items-center justify-center">
                    <Cargador />
                    <span className="sr-only">Procesando…</span>
                </span>
            )}
        </button>
    );
}

export interface EnlaceBotonProps extends Omit<InertiaLinkProps, 'size'> {
    variante?: VarianteBoton;
    tamano?: TamanoBoton;
    icono?: ReactNode;
    iconoFinal?: ReactNode;
    anchoCompleto?: boolean;
    soloIcono?: boolean;
}

/** Enlace de Inertia con aspecto de botón: <EnlaceBoton href="/cuentas" variante="primario">Ver cuentas</EnlaceBoton>. */
export function EnlaceBoton({ variante = 'secundario', tamano = 'md', icono, iconoFinal, anchoCompleto = false, soloIcono = false, className, children, ...resto }: EnlaceBotonProps) {
    return (
        <Link className={cn(estilosBoton({ variante, tamano, anchoCompleto, soloIcono }), className)} {...resto}>
            {icono}
            {children}
            {iconoFinal}
        </Link>
    );
}
