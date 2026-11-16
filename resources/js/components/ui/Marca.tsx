import { cn } from '@/lib/cn';

/**
 * Emblema de ZenGPT: un anillo de cinco segmentos (los 5 espacios de una cuenta), cuatro ocupados y uno libre.
 * `className` controla el tamaño (size-8 por defecto) y el color con `text-…` (jade por defecto).
 */
export function Emblema({ className, titulo }: { className?: string; titulo?: string }) {
    const radio = 9;
    const circunferencia = 2 * Math.PI * radio;
    const arco = circunferencia / 5;
    const hueco = 3.4;

    return (
        <svg viewBox="0 0 24 24" fill="none" className={cn('size-8 shrink-0 text-acento', className)} role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
            {[0, 1, 2, 3, 4].map((i) => (
                <circle
                    key={i}
                    cx="12"
                    cy="12"
                    r={radio}
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeDasharray={`${arco - hueco} ${circunferencia - (arco - hueco)}`}
                    strokeOpacity={i === 4 ? 0.28 : 1}
                    transform={`rotate(${-90 + hueco * 3.2 + i * 72} 12 12)`}
                />
            ))}
            <circle cx="12" cy="12" r="2.4" fill="currentColor" />
        </svg>
    );
}

/** Emblema + nombre «ZenGPT» con la tipografía de marca. Para el nombre animado usa ShinyText (ver AppLayout o Login). */
export function Marca({ className, tamano = 'md' }: { className?: string; tamano?: 'md' | 'lg' }) {
    return (
        <span className={cn('inline-flex items-center gap-2.5', className)}>
            <Emblema className={tamano === 'lg' ? 'size-10' : 'size-8'} />
            <span className={cn('font-titulo font-semibold tracking-tight text-texto', tamano === 'lg' ? 'text-2xl' : 'text-lg')}>
                Zen<span className="text-acento">GPT</span>
            </span>
        </span>
    );
}
