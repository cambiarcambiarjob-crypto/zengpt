import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const PALABRA = 'snake';
// Fuera del componente: cada clic en el emblema navega al panel y el layout se vuelve a montar.
let clicsEmblema: number[] = [];

/**
 * Activador escondido del juego: código Konami (↑↑↓↓←→←→BA), escribir «snake» fuera de un campo de texto,
 * o 5 clics rápidos en el emblema de ZenGPT (sirve en el celular).
 */
export function useSerpiente() {
    const [abierto, setAbierto] = useState(false);
    const teclas = useRef<string[]>([]);

    useEffect(() => {
        const alPresionar = (ev: KeyboardEvent) => {
            if (abierto) return;
            const destino = ev.target as HTMLElement | null;
            if (destino && (destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName))) return;
            teclas.current = [...teclas.current, ev.key.toLowerCase()].slice(-KONAMI.length);
            const ultimas = teclas.current;
            const konami = ultimas.length === KONAMI.length && ultimas.every((k, i) => k === KONAMI[i]);
            const palabra = ultimas.slice(-PALABRA.length).join('') === PALABRA;
            if (konami || palabra) {
                teclas.current = [];
                setAbierto(true);
            }
        };
        window.addEventListener('keydown', alPresionar);

        return () => window.removeEventListener('keydown', alPresionar);
    }, [abierto]);

    /** Para el onClick del emblema: al quinto clic en menos de 2.5 s abre el juego en vez de navegar. */
    const alClicEmblema = useCallback((ev: MouseEvent) => {
        const ahora = Date.now();
        clicsEmblema = [...clicsEmblema.filter((t) => ahora - t < 2500), ahora];
        if (clicsEmblema.length >= 5) {
            clicsEmblema = [];
            ev.preventDefault();
            setAbierto(true);
        }
    }, []);

    return { abierto, cerrar: useCallback(() => setAbierto(false), []), alClicEmblema };
}
