import { router, useForm } from '@inertiajs/react';
import { Bot, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Boton, EnlaceBoton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Confirmar } from '@/components/ui/Confirmar';
import { SelectorPrecio } from '@/components/ui/SelectorPrecio';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { dinero, plural } from '@/lib/formato';
import type { ChatgptCorte, RegistroChatgpt } from '@/types';

/**
 * Anotar ChatGPT vendidos en un corte: cuántos y a qué precio cada uno ($450 o personalizado). Con `conFecha` se elige
 * el día; si no, es el de `fecha`. El servidor recibe el precio en PESOS.
 */
export function AnotarChatgpt({ fecha, hoy, precio, conFecha = false, className }: { fecha: string; hoy: string; precio: number; conFecha?: boolean; className?: string }) {
    const form = useForm({
        sold_on: fecha,
        quantity: '1',
        price: String(precio / 100),
    });
    const cantidad = Math.max(0, Number.parseInt(form.data.quantity, 10) || 0);
    const total = Math.round(cantidad * (Number(form.data.price) || 0) * 100);

    const enviar = (evento: FormEvent) => {
        evento.preventDefault();
        form.post('/chatgpt', {
            preserveScroll: true,
            onSuccess: () => form.setData('quantity', '1'),
        });
    };

    return (
        <form onSubmit={enviar} className={cn('grid content-start gap-3', className)} noValidate>
            {conFecha && <Campo etiqueta="Día del corte" type="date" max={hoy} value={form.data.sold_on} onChange={(e) => form.setData('sold_on', e.target.value)} error={form.errors.sold_on} />}
            <Campo
                etiqueta="¿Cuántos se vendieron?"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={form.data.quantity}
                onChange={(e) => form.setData('quantity', e.target.value)}
                error={form.errors.quantity ?? (conFecha ? null : form.errors.sold_on)}
            />
            <SelectorPrecio
                valor={form.data.price}
                alCambiar={(pesos) => form.setData('price', pesos)}
                precios={[precio / 100]}
                conReposicion={false}
                etiqueta="Precio de cada uno"
                error={form.errors.price}
            />
            <Boton type="submit" variante="primario" cargando={form.processing} disabled={cantidad < 1}>
                Anotar {cantidad > 0 ? plural(cantidad, 'ChatGPT', 'ChatGPT') : 'ChatGPT'} · {dinero(total)}
            </Boton>
        </form>
    );
}

/** Lo anotado en un corte, con la opción de quitar un registro equivocado. */
export function RegistrosChatgpt({ registros, className }: { registros: RegistroChatgpt[]; className?: string }) {
    const [porQuitar, setPorQuitar] = useState<RegistroChatgpt | null>(null);
    const [quitando, setQuitando] = useState(false);

    if (registros.length === 0) return null;

    const quitar = () => {
        if (!porQuitar) return;
        router.delete(`/chatgpt/${porQuitar.id}`, {
            preserveScroll: true,
            onStart: () => setQuitando(true),
            onFinish: () => {
                setQuitando(false);
                setPorQuitar(null);
            },
        });
    };

    return (
        <>
            <ul className={cn('divide-y divide-borde rounded-campo border border-borde', className)} aria-label="ChatGPT anotados">
                {registros.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0">
                            <strong className="cifras font-semibold text-texto">{r.quantity}</strong>
                            <span className="text-suave"> × </span>
                            <span className="cifras text-texto">{dinero(r.price_cents)}</span>
                            <span className="cifras text-suave"> = {dinero(r.total)}</span>
                            {r.registrado_por && <span className="block text-xs text-tenue sm:inline"> · anotó {r.registrado_por}</span>}
                        </span>
                        <Boton
                            variante="fantasma"
                            tamano="sm"
                            soloIcono
                            className="hover:bg-peligro/12! hover:text-peligro!"
                            onClick={() => setPorQuitar(r)}
                            title="Quitar este registro"
                            aria-label={`Quitar ${r.quantity} ChatGPT de ${dinero(r.price_cents)}`}
                        >
                            <Trash2 className="size-4" aria-hidden="true" />
                        </Boton>
                    </li>
                ))}
            </ul>
            <Confirmar abierto={porQuitar !== null} titulo="¿Quitar este registro de ChatGPT?" textoConfirmar="Quitar" cargando={quitando} alCancelar={() => setPorQuitar(null)} alConfirmar={quitar}>
                {porQuitar && (
                    <>
                        Se quitan {plural(porQuitar.quantity, 'ChatGPT', 'ChatGPT')} de {dinero(porQuitar.price_cents)} ({dinero(porQuitar.total)}) y deja de contar en el reparto de ese día.
                    </>
                )}
            </Confirmar>
        </>
    );
}

/** Tarjeta del corte del Día: ChatGPT de Jorge ese día (lo anotado, el pago si es día 6 y el formulario). */
export function ChatgptDia({ fecha, hoy, chatgpt, className }: { fecha: string; hoy: string; chatgpt: ChatgptCorte; className?: string }) {
    const vendidos = chatgpt.registros.reduce((suma, r) => suma + r.quantity, 0);
    const total = chatgpt.registros.reduce((suma, r) => suma + r.total, 0);

    return (
        <Tarjeta
            className={className}
            titulo={
                <span className="flex items-center gap-2">
                    <Bot className="size-4 text-acento" aria-hidden="true" />
                    ChatGPT{chatgpt.vendedor ? ` de ${chatgpt.vendedor}` : ''}
                </span>
            }
            descripcion={vendidos > 0 ? `${plural(vendidos, 'vendido')} en este corte · ${dinero(total)}` : 'Anota cuántos se vendieron en este corte'}
            acciones={
                <EnlaceBoton href="/chatgpt" variante="fantasma" tamano="sm">
                    Ver el mes
                </EnlaceBoton>
            }
        >
            {chatgpt.pago > 0 && (
                <p className="mb-4 rounded-campo border border-alerta/30 bg-alerta/8 px-3 py-2 text-[13px] leading-snug text-suave">
                    Hoy es día de pago de ChatGPT: <strong className="cifras text-texto">{dinero(chatgpt.pago)}</strong>. Ya se descuenta del neto de {chatgpt.vendedor ?? 'Jorge'} en este corte.
                </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
                <AnotarChatgpt fecha={fecha} hoy={hoy} precio={chatgpt.precio} />
                <RegistrosChatgpt registros={chatgpt.registros} className="self-start" />
            </div>
        </Tarjeta>
    );
}
