import { router, usePage } from '@inertiajs/react';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import type { Compartido } from '@/types';

type Tipo = 'exito' | 'error';
interface Aviso {
    id: number;
    tipo: Tipo;
    mensaje: string;
}

const DURACION: Record<Tipo, number> = { exito: 4500, error: 8000 };

// Canal mínimo para lanzar avisos desde cualquier parte del cliente (ver `avisar`).
type Oyente = (tipo: Tipo, mensaje: string) => void;
const oyentes = new Set<Oyente>();
let siguienteId = 1;

// Al volver con «atrás/adelante» Inertia restaura las props guardadas (incluido el flash ya visto): no se repite.
let restaurando = false;
if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
        restaurando = true;
    });
    router.on('start', () => {
        restaurando = false;
    });
}

/**
 * Lanza un aviso desde el cliente (sin pasar por el servidor): avisar.exito('Correo copiado').
 * Los mensajes del servidor (props.flash.success / error) se muestran solos: no hace falta llamarlo.
 */
export const avisar = {
    exito: (mensaje: string) => oyentes.forEach((oyente) => oyente('exito', mensaje)),
    error: (mensaje: string) => oyentes.forEach((oyente) => oyente('error', mensaje)),
};

function Tostada({ aviso, alCerrar }: { aviso: Aviso; alCerrar: (id: number) => void }) {
    const temporizador = useRef(0);

    const programar = useCallback(() => {
        window.clearTimeout(temporizador.current);
        temporizador.current = window.setTimeout(() => alCerrar(aviso.id), DURACION[aviso.tipo]);
    }, [aviso.id, aviso.tipo, alCerrar]);

    useEffect(() => {
        programar();

        return () => window.clearTimeout(temporizador.current);
    }, [programar]);

    const esError = aviso.tipo === 'error';

    return (
        <div
            role={esError ? 'alert' : 'status'}
            onMouseEnter={() => window.clearTimeout(temporizador.current)}
            onMouseLeave={programar}
            className={cn(
                'pointer-events-auto flex w-full animate-aviso items-start gap-3 rounded-tarjeta border bg-superficie-2 py-3 pr-2 pl-4 shadow-flotante',
                esError ? 'border-peligro/45' : 'border-exito/40',
            )}
        >
            {esError ? <TriangleAlert className="mt-0.5 size-4.5 shrink-0 text-peligro" aria-hidden="true" /> : <CircleCheck className="mt-0.5 size-4.5 shrink-0 text-exito" aria-hidden="true" />}
            <p className="min-w-0 flex-1 py-0.5 text-sm leading-snug text-texto">{aviso.mensaje}</p>
            <button
                type="button"
                onClick={() => alCerrar(aviso.id)}
                aria-label="Cerrar aviso"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-tenue transition-colors hover:bg-superficie-3 hover:text-texto"
            >
                <X className="size-4" aria-hidden="true" />
            </button>
        </div>
    );
}

/**
 * Zona de avisos: muestra los mensajes flash del servidor (props.flash.success / error) y los de `avisar`,
 * y los retira solos (éxito 4.5 s, error 8 s; se detienen con el cursor encima). Salen arriba en celular y abajo a la
 * derecha en escritorio, para no tapar el título ni sus acciones. AppLayout ya la incluye:
 * no la montes otra vez dentro de una pantalla.
 */
export function Avisos() {
    const { flash } = usePage().props as unknown as Compartido;
    const [avisos, setAvisos] = useState<Aviso[]>([]);

    const agregar = useCallback<Oyente>((tipo, mensaje) => {
        setAvisos((lista) => [...lista.filter((a) => a.mensaje !== mensaje).slice(-2), { id: siguienteId++, tipo, mensaje }]);
    }, []);

    const cerrar = useCallback((id: number) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);

    useEffect(() => {
        oyentes.add(agregar);

        return () => {
            oyentes.delete(agregar);
        };
    }, [agregar]);

    // `flash` es un objeto nuevo en cada respuesta del servidor: cada mensaje se muestra una vez.
    useEffect(() => {
        if (restaurando) return;
        if (flash?.success) agregar('exito', flash.success);
        if (flash?.error) agregar('error', flash.error);
    }, [flash, agregar]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="pointer-events-none fixed inset-x-3 top-3 z-[70] flex flex-col items-end gap-2 sm:inset-x-auto sm:top-auto sm:right-5 sm:bottom-5 sm:w-96 sm:flex-col-reverse" aria-label="Avisos">
            {avisos.map((aviso) => (
                <Tostada key={aviso.id} aviso={aviso} alCerrar={cerrar} />
            ))}
        </div>,
        document.body,
    );
}
