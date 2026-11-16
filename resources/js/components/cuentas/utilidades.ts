// Utilidades de la pantalla de Cuentas: URL de los filtros, vigencia calculada y el último vendedor usado.
import { aFecha, aIso } from '@/lib/formato';
import type { CuentasProps, Espacio } from '@/types';

export type EstadoFiltro = CuentasProps['filtros']['estado'];

/** URL literal de la lista con sus filtros. Los valores por defecto no se escriben: «/cuentas», «/cuentas?estado=vencidas&q=ana». */
export function urlCuentas(estado: EstadoFiltro, q: string): string {
    const partes: string[] = [];
    const busqueda = q.trim();

    if (estado !== 'activas') partes.push(`estado=${estado}`);
    if (busqueda !== '') partes.push(`q=${encodeURIComponent(busqueda)}`);

    return partes.length > 0 ? `/cuentas?${partes.join('&')}` : '/cuentas';
}

/** true si el texto es una fecha 'AAAA-MM-DD' completa (un <input type="date"> a medio escribir manda «»). */
export function esFechaIso(texto: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(texto);
}

/**
 * Suma meses sin desbordar el mes (igual que `addMonthsNoOverflow` en el servidor):
 * 30 nov + 3 meses → 28 feb (o 29 en bisiesto), no 2 de marzo.
 */
export function sumarMeses(iso: string, meses: number): string {
    const fecha = aFecha(iso);
    const destino = new Date(fecha.getFullYear(), fecha.getMonth() + meses, 1);
    const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
    destino.setDate(Math.min(fecha.getDate(), ultimoDia));

    return aIso(destino);
}

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

/** ¿El cliente del espacio coincide con lo buscado (correo o teléfono)? Sirve para resaltarlo dentro de su cuenta. */
export function coincideEspacio(espacio: Espacio, busqueda: string): boolean {
    if (busqueda === '') return false;

    return espacio.client_email.toLowerCase().includes(busqueda) || (espacio.client_phone ?? '').toLowerCase().includes(busqueda);
}

/** Copia texto al portapapeles (con respaldo para contextos sin la API moderna). Devuelve si se pudo. */
export async function copiarTexto(texto: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(texto);

            return true;
        }
    } catch {
        // Sin permiso: se intenta el respaldo.
    }

    const activo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(area);
    area.select();

    let copiado = false;
    try {
        copiado = document.execCommand('copy');
    } catch {
        copiado = false;
    }

    area.remove();
    activo?.focus({ preventScroll: true });

    return copiado;
}

let regionAnuncios: HTMLElement | null = null;

/** Anuncia un mensaje breve a los lectores de pantalla sin mostrar nada (p. ej. «Copiado: ana@gmail.com»). */
export function anunciar(mensaje: string): void {
    if (!regionAnuncios || !regionAnuncios.isConnected) {
        regionAnuncios = document.createElement('div');
        regionAnuncios.setAttribute('role', 'status');
        regionAnuncios.setAttribute('aria-live', 'polite');
        regionAnuncios.className = 'sr-only';
        document.body.appendChild(regionAnuncios);
    }

    // Vaciar primero hace que el mismo mensaje dos veces seguidas se vuelva a leer.
    const region = regionAnuncios;
    region.textContent = '';
    window.setTimeout(() => {
        region.textContent = mensaje;
    }, 30);
}
