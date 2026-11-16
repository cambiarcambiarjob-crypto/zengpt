import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { EnvolturaCampo, idsDescripcion, TEXTO_CONTROL } from './Campo';

export interface SelectorPrecioProps {
    /** Precio en PESOS como texto («200», «350.50» o «» si aún no se elige): es lo que va en el campo `price` del formulario. */
    valor: string;
    /** Recibe el precio en PESOS como texto. */
    alCambiar: (pesos: string) => void;
    /** Precios sugeridos en pesos (por defecto 200, 400 y 500; usa `negocio.precios`). */
    precios?: number[];
    etiqueta?: ReactNode;
    error?: string | null;
    ayuda?: ReactNode;
    deshabilitado?: boolean;
    className?: string;
}

const OPCION =
    'flex h-11 cursor-pointer items-center justify-center rounded-campo border border-borde-fuerte bg-superficie-2 px-2 text-sm font-medium text-suave transition-[background-color,border-color,color,box-shadow] duration-150 ' +
    'hover:border-tenue/60 hover:text-texto peer-checked:border-acento peer-checked:bg-acento/12 peer-checked:text-acento peer-checked:shadow-[0_0_0_1px_var(--color-acento)] ' +
    'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-acento peer-disabled:cursor-not-allowed peer-disabled:opacity-55 sm:h-10';

/**
 * Precio de un espacio: botones con los precios sugeridos y «Otro» para capturar uno personalizado. Devuelve PESOS.
 *
 *   <SelectorPrecio valor={form.data.price} alCambiar={(pesos) => form.setData('price', pesos)} precios={negocio.precios} error={form.errors.price} />
 */
export function SelectorPrecio({ valor, alCambiar, precios = [200, 400, 500], etiqueta = 'Precio', error, ayuda, deshabilitado = false, className }: SelectorPrecioProps) {
    const id = useId();
    const entrada = useRef<HTMLInputElement>(null);
    const esReposicion = valor !== '' && Number(valor) === 0;
    const esSugerido = esReposicion || (valor !== '' && precios.includes(Number(valor)));
    const [otro, setOtro] = useState(valor !== '' && !esSugerido);
    const enfocarOtro = useRef(false);

    // Si el formulario se reinicia desde fuera (form.reset()), «Otro» se cierra.
    useEffect(() => {
        if (valor === '' && otro && !enfocarOtro.current && document.activeElement !== entrada.current) setOtro(false);
    }, [valor, otro]);

    useEffect(() => {
        if (otro && enfocarOtro.current) {
            enfocarOtro.current = false;
            entrada.current?.focus();
        }
    }, [otro]);

    return (
        <EnvolturaCampo id={`${id}-otro`} etiqueta={etiqueta} error={error} ayuda={ayuda} className={className}>
            <div role="radiogroup" aria-label={typeof etiqueta === 'string' ? etiqueta : 'Precio'} className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {precios.map((precio) => (
                    <label key={precio} className="relative">
                        <input
                            type="radio"
                            name={`${id}-precio`}
                            className="peer sr-only"
                            checked={!otro && Number(valor) === precio && valor !== ''}
                            disabled={deshabilitado}
                            onChange={() => {
                                setOtro(false);
                                alCambiar(String(precio));
                            }}
                        />
                        <span className={cn(OPCION, 'cifras')}>${precio}</span>
                    </label>
                ))}
                <label className="relative">
                    <input
                        type="radio"
                        name={`${id}-precio`}
                        className="peer sr-only"
                        checked={!otro && esReposicion}
                        disabled={deshabilitado}
                        onChange={() => {
                            setOtro(false);
                            alCambiar('0');
                        }}
                    />
                    <span className={OPCION} title="Cuenta como cliente, pero con $0: no suma a las ventas">
                        Reposición
                    </span>
                </label>
                <label className="relative">
                    <input
                        type="radio"
                        name={`${id}-precio`}
                        className="peer sr-only"
                        checked={otro}
                        disabled={deshabilitado}
                        onChange={() => {
                            enfocarOtro.current = true;
                            setOtro(true);
                            alCambiar('');
                        }}
                    />
                    <span className={OPCION}>Otro</span>
                </label>
            </div>
            {otro && (
                <div
                    className={cn(
                        'flex min-h-11 animate-aparecer items-center gap-2 rounded-campo border bg-superficie-2 px-3 transition-[border-color,box-shadow] duration-150 sm:min-h-10',
                        'focus-within:border-acento focus-within:shadow-[0_0_0_3px_rgb(52_216_166/0.18)]',
                        error ? 'border-peligro/70' : 'border-borde-fuerte',
                    )}
                >
                    <span className="text-tenue" aria-hidden="true">
                        $
                    </span>
                    <input
                        ref={entrada}
                        id={`${id}-otro`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        placeholder="Precio personalizado"
                        aria-label="Precio personalizado en pesos"
                        aria-invalid={error ? true : undefined}
                        aria-describedby={idsDescripcion(`${id}-otro`, error, ayuda)}
                        disabled={deshabilitado}
                        value={valor}
                        onChange={(evento) => alCambiar(evento.target.value)}
                        className={cn('cifras h-full min-w-0 flex-1 self-stretch bg-transparent py-2 outline-none placeholder:text-tenue', TEXTO_CONTROL)}
                    />
                    <span className="text-xs text-tenue" aria-hidden="true">
                        MXN
                    </span>
                </div>
            )}
        </EnvolturaCampo>
    );
}
