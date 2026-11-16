/** Valores que acepta `cn`: cadenas, falsos (se ignoran), listas y objetos { clase: condición }. */
export type Clase = string | number | null | false | undefined | Clase[] | { [clase: string]: unknown };

/**
 * Une clases de Tailwind de forma condicional (equivalente mínimo a clsx, sin dependencias).
 *
 *   cn('px-3', activo && 'bg-acento', { 'opacity-50': deshabilitado }, className)
 *
 * No resuelve conflictos entre utilidades: si necesitas pisar una clase del componente usa el modificador `!` (p. ej. `p-0!`).
 */
export function cn(...clases: Clase[]): string {
    const salida: string[] = [];

    for (const clase of clases) {
        if (!clase && clase !== 0) continue;

        if (typeof clase === 'string' || typeof clase === 'number') {
            salida.push(String(clase));
        } else if (Array.isArray(clase)) {
            const interna = cn(...clase);
            if (interna) salida.push(interna);
        } else {
            for (const [nombre, activa] of Object.entries(clase)) {
                if (activa) salida.push(nombre);
            }
        }
    }

    return salida.join(' ');
}
