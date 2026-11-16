import { CircleAlert } from 'lucide-react';
import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Caja de un control (input, select…): mismo alto, borde y foco en todo el sistema. */
export const CAJA_CONTROL =
    'flex min-h-11 w-full items-center gap-2 rounded-campo border bg-superficie-2 px-3 text-texto transition-[border-color,box-shadow,background-color] duration-150 ' +
    'focus-within:border-acento focus-within:shadow-[0_0_0_3px_rgb(52_216_166/0.18)] sm:min-h-10';

/** Texto dentro del control: 16 px en celular (iOS no hace zoom al enfocar) y 14 px en escritorio. */
export const TEXTO_CONTROL = 'text-base sm:text-sm';

export interface EnvolturaCampoProps {
    id: string;
    etiqueta: ReactNode;
    /** Mensaje de validación del servidor (`form.errors.campo`). Se anuncia a lectores de pantalla. */
    error?: string | null;
    /** Texto de ayuda bajo el control (se oculta cuando hay error). */
    ayuda?: ReactNode;
    /** Añade «(opcional)» junto a la etiqueta. */
    opcional?: boolean;
    /** Deja la etiqueta solo para lectores de pantalla. */
    ocultarEtiqueta?: boolean;
    /** Contenido a la derecha de la etiqueta (un enlace, un contador…). */
    junto?: ReactNode;
    className?: string;
    children: ReactNode;
}

/** ids para enlazar el control con su error y su ayuda (`aria-describedby`). */
export function idsDescripcion(id: string, error?: string | null, ayuda?: ReactNode): string | undefined {
    if (error) return `${id}-error`;

    return ayuda ? `${id}-ayuda` : undefined;
}

/** Etiqueta + control + error/ayuda. La usan Campo, CampoArea, Selector y SelectorPrecio; sirve para controles propios. */
export function EnvolturaCampo({ id, etiqueta, error, ayuda, opcional, ocultarEtiqueta, junto, className, children }: EnvolturaCampoProps) {
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <div className={cn('flex items-baseline justify-between gap-3', ocultarEtiqueta && 'sr-only')}>
                <label htmlFor={id} className="text-[13px] font-medium text-suave">
                    {etiqueta}
                    {opcional && <span className="ml-1.5 font-normal text-tenue">(opcional)</span>}
                </label>
                {junto}
            </div>
            {children}
            {error ? (
                <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-[13px] leading-snug text-peligro">
                    <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </p>
            ) : ayuda ? (
                <p id={`${id}-ayuda`} className="text-[13px] leading-snug text-tenue">
                    {ayuda}
                </p>
            ) : null}
        </div>
    );
}

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
    etiqueta: ReactNode;
    error?: string | null;
    ayuda?: ReactNode;
    opcional?: boolean;
    ocultarEtiqueta?: boolean;
    junto?: ReactNode;
    /** Adorno a la izquierda dentro de la caja («$», un icono…). */
    prefijo?: ReactNode;
    /** Adorno o botón a la derecha dentro de la caja (unidad, «mostrar contraseña»…). */
    sufijo?: ReactNode;
    /** Clases del contenedor (etiqueta + caja + error). `className` va al <input>. */
    claseContenedor?: string;
    ref?: Ref<HTMLInputElement>;
}

/**
 * Campo de texto con etiqueta real y error junto al control.
 *
 *   <Campo etiqueta="Gmail del cliente" type="email" value={form.data.client_email}
 *          onChange={(e) => form.setData('client_email', e.target.value)} error={form.errors.client_email} />
 */
export function Campo({ etiqueta, error, ayuda, opcional, ocultarEtiqueta, junto, prefijo, sufijo, claseContenedor, className, id, ref, ...resto }: CampoProps) {
    const propio = useId();
    const campoId = id ?? propio;

    return (
        <EnvolturaCampo id={campoId} etiqueta={etiqueta} error={error} ayuda={ayuda} opcional={opcional} ocultarEtiqueta={ocultarEtiqueta} junto={junto} className={claseContenedor}>
            <div className={cn(CAJA_CONTROL, error ? 'border-peligro/70' : 'border-borde-fuerte hover:border-tenue/60', resto.disabled && 'opacity-60')}>
                {prefijo && <span className="shrink-0 text-tenue">{prefijo}</span>}
                <input
                    ref={ref}
                    id={campoId}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={idsDescripcion(campoId, error, ayuda)}
                    className={cn('h-full min-w-0 flex-1 self-stretch bg-transparent py-2 outline-none placeholder:text-tenue', TEXTO_CONTROL, className)}
                    {...resto}
                />
                {sufijo && <span className="-mr-1 flex shrink-0 items-center text-tenue">{sufijo}</span>}
            </div>
        </EnvolturaCampo>
    );
}

export interface CampoAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    etiqueta: ReactNode;
    error?: string | null;
    ayuda?: ReactNode;
    opcional?: boolean;
    ocultarEtiqueta?: boolean;
    junto?: ReactNode;
    claseContenedor?: string;
    ref?: Ref<HTMLTextAreaElement>;
}

/** Igual que Campo, pero de varias líneas (notas de una cuenta). */
export function CampoArea({ etiqueta, error, ayuda, opcional, ocultarEtiqueta, junto, claseContenedor, className, id, ref, rows = 3, ...resto }: CampoAreaProps) {
    const propio = useId();
    const campoId = id ?? propio;

    return (
        <EnvolturaCampo id={campoId} etiqueta={etiqueta} error={error} ayuda={ayuda} opcional={opcional} ocultarEtiqueta={ocultarEtiqueta} junto={junto} className={claseContenedor}>
            <textarea
                ref={ref}
                id={campoId}
                rows={rows}
                aria-invalid={error ? true : undefined}
                aria-describedby={idsDescripcion(campoId, error, ayuda)}
                className={cn(
                    'w-full resize-y rounded-campo border bg-superficie-2 px-3 py-2.5 text-texto outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-tenue',
                    'focus:border-acento focus:shadow-[0_0_0_3px_rgb(52_216_166/0.18)]',
                    error ? 'border-peligro/70' : 'border-borde-fuerte hover:border-tenue/60',
                    TEXTO_CONTROL,
                    className,
                )}
                {...resto}
            />
        </EnvolturaCampo>
    );
}
