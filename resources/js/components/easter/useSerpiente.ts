import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';

export type Juego = 'snake' | 'zombies' | 'menu';

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const PALABRAS: Record<string, Juego> = { snake: 'snake', zombies: 'zombies' };
// Fuera del componente: cada clic en el emblema navega al panel y el layout se vuelve a montar.
let clicsEmblema: number[] = [];

/**
 * Activadores escondidos de los juegos: código Konami o escribir «snake» → Snake; escribir «zombies» → Zombies
 * (fuera de un campo de texto); 5 clics rápidos en el emblema → menú secreto con los dos (sirve en el celular).
 */
export function useSerpiente() {
    const [juego, setJuego] = useState<Juego | null>(null);
    const teclas = useRef<string[]>([]);

    useEffect(() => {
        const alPresionar = (ev: KeyboardEvent) => {
            if (juego) return;
            const destino = ev.target as HTMLElement | null;
            if (destino && (destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName))) return;
            teclas.current = [...teclas.current, ev.key.toLowerCase()].slice(-KONAMI.length);
            const ultimas = teclas.current;
            if (ultimas.length === KONAMI.length && ultimas.every((k, i) => k === KONAMI[i])) {
                teclas.current = [];
                setJuego('snake');
                return;
            }
            const texto = ultimas.join('');
            for (const [palabra, destinoJuego] of Object.entries(PALABRAS)) {
                if (texto.endsWith(palabra)) {
                    teclas.current = [];
                    setJuego(destinoJuego);
                    return;
                }
            }
        };
        window.addEventListener('keydown', alPresionar);

        return () => window.removeEventListener('keydown', alPresionar);
    }, [juego]);

    /** Para el onClick del emblema: al quinto clic en menos de 2.5 s abre el menú en vez de navegar. */
    const alClicEmblema = useCallback((ev: MouseEvent) => {
        const ahora = Date.now();
        clicsEmblema = [...clicsEmblema.filter((t) => ahora - t < 2500), ahora];
        if (clicsEmblema.length >= 5) {
            clicsEmblema = [];
            ev.preventDefault();
            setJuego('menu');
        }
    }, []);

    return { juego, abrir: setJuego, cerrar: useCallback(() => setJuego(null), []), alClicEmblema };
}
