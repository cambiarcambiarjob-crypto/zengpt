import { Check, Copy } from 'lucide-react';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { avisar } from '@/components/ui/Avisos';
import { cn } from '@/lib/cn';
import { anunciar, copiarTexto } from './utilidades';

export interface CopiableProps {
    /** Lo que se copia al portapapeles. */
    texto: string;
    /** Qué es, para lectores de pantalla y el título («correo de la cuenta», «teléfono del cliente»). */
    etiqueta: string;
    /** Lo que se ve (por defecto, el mismo texto). */
    children?: ReactNode;
    /** Icono a la izquierda del texto (decorativo). */
    icono?: ReactNode;
    className?: string;
}

/**
 * Texto que se copia con un clic (Gmail de la cuenta, Gmail o teléfono del cliente). La confirmación es inmediata y en el
 * mismo lugar: el icono cambia a una palomita 1.6 s, sin mover nada ni abrir avisos.
 */
export const Copiable = memo(function Copiable({ texto, etiqueta, children, icono, className }: CopiableProps) {
    const [copiado, setCopiado] = useState(false);
    const temporizador = useRef(0);

    useEffect(() => () => window.clearTimeout(temporizador.current), []);

    const copiar = async () => {
        if (!(await copiarTexto(texto))) {
            avisar.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');

            return;
        }

        anunciar(`Copiado: ${texto}`);
        setCopiado(true);
        window.clearTimeout(temporizador.current);
        temporizador.current = window.setTimeout(() => setCopiado(false), 1600);
    };

    return (
        <button
            type="button"
            onClick={copiar}
            title={`Copiar ${texto}`}
            aria-label={`${texto}, copiar ${etiqueta}`}
            className={cn(
                'group/copiar -mx-1 inline-flex max-w-[calc(100%+0.5rem)] min-w-0 items-center gap-1.5 rounded-md px-1 text-left transition-colors duration-150 hover:bg-superficie-3 pointer-coarse:min-h-10',
                copiado && 'text-acento!',
                className,
            )}
        >
            {icono && (
                <span className="shrink-0 text-tenue" aria-hidden="true">
                    {icono}
                </span>
            )}
            <span className="min-w-0 truncate">{children ?? texto}</span>
            <span className="relative size-3.5 shrink-0" aria-hidden="true">
                <Copy className={cn('absolute inset-0 size-3.5 text-tenue transition-[opacity,color] duration-150 group-hover/copiar:text-suave', copiado && 'opacity-0')} />
                <Check className={cn('absolute inset-0 size-3.5 text-acento transition-opacity duration-150', copiado ? 'opacity-100' : 'opacity-0')} />
            </span>
        </button>
    );
});
