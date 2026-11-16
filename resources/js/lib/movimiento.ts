import { useEffect, useState, useSyncExternalStore } from 'react';

const CONSULTA = '(prefers-reduced-motion: reduce)';

function suscribir(alCambiar: () => void): () => void {
    const media = window.matchMedia(CONSULTA);
    media.addEventListener('change', alCambiar);

    return () => media.removeEventListener('change', alCambiar);
}

/** true si la persona pidió «reducir movimiento» en su sistema: muestra la versión estática. */
export function useMovimientoReducido(): boolean {
    return useSyncExternalStore(
        suscribir,
        () => window.matchMedia(CONSULTA).matches,
        () => false,
    );
}

/** true mientras la pestaña está a la vista: úsalo para pausar animaciones continuas (`paused={!visible}`). */
export function usePestanaVisible(): boolean {
    const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);

    useEffect(() => {
        const alCambiar = () => setVisible(!document.hidden);
        document.addEventListener('visibilitychange', alCambiar);

        return () => document.removeEventListener('visibilitychange', alCambiar);
    }, []);

    return visible;
}

/**
 * true cuando el navegador ya pintó y está libre: sirve para montar lo decorativo (fondos WebGL)
 * DESPUÉS de que el contenido útil ya se puede usar.
 */
export function useCuandoLibre(esperaMaxima = 600): boolean {
    const [listo, setListo] = useState(false);

    useEffect(() => {
        if (typeof window.requestIdleCallback === 'function') {
            const id = window.requestIdleCallback(() => setListo(true), { timeout: esperaMaxima });

            return () => window.cancelIdleCallback(id);
        }

        const id = window.setTimeout(() => setListo(true), 120);

        return () => window.clearTimeout(id);
    }, [esperaMaxima]);

    return listo;
}
