import { X } from 'lucide-react';
import { useEffect, useId, useRef, type FormEventHandler, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Pila de modales abiertos: solo el de arriba atiende Esc y Tab (p. ej. Confirmar sobre un Modal).
const pila: string[] = [];

const ANCHOS = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' } as const;

export interface ModalProps {
    abierto: boolean;
    /** Se llama con Esc, con la «X» o al hacer clic fuera. */
    alCerrar: () => void;
    titulo: ReactNode;
    descripcion?: ReactNode;
    children?: ReactNode;
    /** Botones de acción (abajo, siempre visibles). Si pasas `alEnviar`, un <Boton type="submit"> aquí envía el formulario. */
    pie?: ReactNode;
    /** Convierte el modal en un <form>: recibe el evento de envío (recuerda `e.preventDefault()`). */
    alEnviar?: FormEventHandler<HTMLFormElement>;
    tamano?: keyof typeof ANCHOS;
    /** Impide cerrar (Esc, clic fuera, X) mientras se guarda: pásale `form.processing`. */
    bloqueado?: boolean;
    /** 'alertdialog' para confirmaciones. */
    rol?: 'dialog' | 'alertdialog';
    className?: string;
}

/**
 * Ventana modal accesible: foco atrapado, Esc para cerrar, devuelve el foco al cerrar y bloquea el desplazamiento del fondo.
 * En celular se muestra como hoja inferior. El foco inicial va al elemento con `data-autofocus` o, si no hay, al primer campo
 * (en pantallas táctiles se queda en la ventana para no abrir el teclado de golpe).
 *
 *   const [abierto, setAbierto] = useState(false);
 *   <Modal abierto={abierto} alCerrar={() => setAbierto(false)} titulo="Nueva cuenta" alEnviar={enviar} bloqueado={form.processing}
 *          pie={<><Boton variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton><Boton type="submit" variante="primario" cargando={form.processing}>Guardar</Boton></>}>
 *       <Campo … />
 *   </Modal>
 */
export function Modal({ abierto, alCerrar, titulo, descripcion, children, pie, alEnviar, tamano = 'md', bloqueado = false, rol = 'dialog', className }: ModalProps) {
    const id = useId();
    const panel = useRef<HTMLElement | null>(null);
    const cerrar = useRef(alCerrar);
    const estaBloqueado = useRef(bloqueado);
    cerrar.current = alCerrar;
    estaBloqueado.current = bloqueado;

    useEffect(() => {
        if (!abierto) return undefined;

        const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const nodo = panel.current;
        pila.push(id);

        // Bloquea el desplazamiento del fondo sin que la página «salte» al desaparecer la barra.
        const raiz = document.documentElement;
        const barra = window.innerWidth - raiz.clientWidth;
        const previo = { overflow: raiz.style.overflow, padding: raiz.style.paddingRight };
        if (pila.length === 1) {
            raiz.style.overflow = 'hidden';
            if (barra > 0) raiz.style.paddingRight = `${barra}px`;
        }

        // En pantallas táctiles el foco se queda en la ventana: enfocar un campo abriría el teclado encima del formulario.
        const tactil = window.matchMedia('(pointer: coarse)').matches;
        const inicial =
            nodo?.querySelector<HTMLElement>('[data-autofocus]') ??
            (tactil ? null : nodo?.querySelector<HTMLElement>('[data-cuerpo] input:not([type="hidden"]):not([disabled]), [data-cuerpo] select:not([disabled]), [data-cuerpo] textarea:not([disabled])')) ??
            nodo;
        inicial?.focus({ preventScroll: true });

        const alTeclear = (evento: KeyboardEvent) => {
            if (pila[pila.length - 1] !== id || !nodo) return;

            if (evento.key === 'Escape') {
                evento.stopPropagation();
                if (!estaBloqueado.current) cerrar.current();

                return;
            }

            if (evento.key !== 'Tab') return;

            const lista = Array.from(nodo.querySelectorAll<HTMLElement>(ENFOCABLES)).filter((el) => el.offsetParent !== null || el === document.activeElement);
            if (lista.length === 0) {
                evento.preventDefault();
                nodo.focus();

                return;
            }

            const primero = lista[0];
            const ultimo = lista[lista.length - 1];
            const actual = document.activeElement;

            if (evento.shiftKey && (actual === primero || actual === nodo || !nodo.contains(actual))) {
                evento.preventDefault();
                ultimo.focus();
            } else if (!evento.shiftKey && (actual === ultimo || !nodo.contains(actual))) {
                evento.preventDefault();
                primero.focus();
            }
        };

        document.addEventListener('keydown', alTeclear, true);

        return () => {
            document.removeEventListener('keydown', alTeclear, true);
            const indice = pila.lastIndexOf(id);
            if (indice !== -1) pila.splice(indice, 1);
            if (pila.length === 0) {
                raiz.style.overflow = previo.overflow;
                raiz.style.paddingRight = previo.padding;
            }
            if (anterior?.isConnected) anterior.focus({ preventScroll: true });
        };
    }, [abierto, id]);

    if (!abierto || typeof document === 'undefined') return null;

    const contenido = (
        <>
            <header className="flex shrink-0 items-start gap-4 border-b border-borde px-5 pt-5 pb-4 sm:px-6">
                <div className="min-w-0 flex-1">
                    <h2 id={`${id}-titulo`} className="text-lg leading-snug font-semibold text-texto">
                        {titulo}
                    </h2>
                    {descripcion && (
                        <p id={`${id}-descripcion`} className="mt-1 text-sm leading-relaxed text-suave">
                            {descripcion}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => !bloqueado && alCerrar()}
                    aria-label="Cerrar"
                    disabled={bloqueado}
                    className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-campo text-tenue transition-colors hover:bg-superficie-3 hover:text-texto disabled:opacity-40"
                >
                    <X className="size-4.5" aria-hidden="true" />
                </button>
            </header>
            {children !== undefined && children !== null && (
                <div data-cuerpo className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
                    {children}
                </div>
            )}
            {pie && <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-borde bg-superficie px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">{pie}</footer>}
        </>
    );

    const clases = cn(
        'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-panel border border-borde-fuerte bg-superficie shadow-flotante outline-none',
        'animate-subir sm:max-h-[min(86dvh,56rem)] sm:animate-emerger sm:rounded-panel',
        ANCHOS[tamano],
        className,
    );

    const comunes = {
        role: rol,
        'aria-modal': true,
        'aria-labelledby': `${id}-titulo`,
        'aria-describedby': descripcion ? `${id}-descripcion` : undefined,
        tabIndex: -1,
        className: clases,
    } as const;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
            onMouseDown={(evento) => {
                if (evento.target === evento.currentTarget && !bloqueado) alCerrar();
            }}
        >
            <div className="pointer-events-none absolute inset-0 animate-aparecer bg-black/70" aria-hidden="true" />
            {alEnviar ? (
                <form
                    {...comunes}
                    ref={(nodo) => {
                        panel.current = nodo;
                    }}
                    onSubmit={alEnviar}
                    noValidate
                >
                    {contenido}
                </form>
            ) : (
                <div
                    {...comunes}
                    ref={(nodo) => {
                        panel.current = nodo;
                    }}
                >
                    {contenido}
                </div>
            )}
        </div>,
        document.body,
    );
}
