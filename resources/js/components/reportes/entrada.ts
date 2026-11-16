import { useEffect, useState } from 'react';
import { useMovimientoReducido } from '@/lib/movimiento';

/**
 * false en el primer pintado y true dos cuadros después: sirve para que las barras crezcan desde cero UNA vez
 * (con `transform` + `transition`, sin mover el layout). Con «reducir movimiento» es true desde el inicio.
 * `espera` permite arrancar cuando ya se conoce el tamaño del lienzo.
 */
export function useEntrada(espera = false): boolean {
    const reducido = useMovimientoReducido();
    const [listo, setListo] = useState(reducido);

    useEffect(() => {
        if (listo || espera) return undefined;
        // Dos cuadros: el navegador alcanza a pintar el estado inicial antes de soltar la transición.
        let id = requestAnimationFrame(() => {
            id = requestAnimationFrame(() => setListo(true));
        });

        return () => cancelAnimationFrame(id);
    }, [listo, espera]);

    return listo || reducido;
}
