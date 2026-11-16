// Utilidades de la pantalla del Día (cierre del día): textos, colores del reparto y el último vendedor usado.
import { aNumeroPesos } from '@/lib/formato';

/** «lunes 16 de noviembre» → «Lunes 16 de noviembre». */
export function capitalizar(texto: string): string {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** «10 %» con espacio duro: el número y el signo nunca quedan en renglones distintos. */
export function porciento(valor: number): string {
    return `${Number.isInteger(valor) ? valor : valor.toFixed(1)} %`;
}

/** true si el texto es una fecha 'AAAA-MM-DD' completa y razonable (un <input type="date"> a medio escribir pasa por años como 0002). */
export function esFechaCompleta(texto: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(texto) && Number(texto.slice(0, 4)) >= 2000;
}

/**
 * Colores de las tres partes del reparto (socio · vendedores · dueño), en ese orden fijo.
 * Elegidos para distinguirse entre sí sobre la superficie oscura también con daltonismo; el significado
 * nunca depende solo del color: cada parte lleva su nombre y su monto al lado.
 */
export const COLORES_REPARTO = { socio: '#3987e5', vendedor: '#c57f38', dueno: '#1aa880' } as const;

export type ParteReparto = keyof typeof COLORES_REPARTO;

/** Texto de un campo de pesos → centavos (0 si está vacío o no es un monto válido). */
export function aCentavos(texto: string): number {
    const valor = aNumeroPesos(texto);

    return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : 0;
}

// Misma clave que usa la pantalla de Cuentas: el vendedor recordado es uno solo en todo el sistema.
const CLAVE_VENDEDOR = 'zengpt:ultimo-vendedor';

/** Último vendedor con el que se capturó un cliente en este navegador («» si no hay o el almacenamiento está bloqueado). */
export function leerUltimoVendedor(): string {
    try {
        return window.localStorage.getItem(CLAVE_VENDEDOR) ?? '';
    } catch {
        return '';
    }
}

export function guardarUltimoVendedor(id: string | number): void {
    try {
        window.localStorage.setItem(CLAVE_VENDEDOR, String(id));
    } catch {
        // Navegación privada o almacenamiento lleno: simplemente no se recuerda.
    }
}
