import { usePage } from '@inertiajs/react';
import type { Compartido } from '@/types';

/**
 * Props de la pantalla + props compartidas (auth, flash, negocio), ya tipadas.
 *
 *   const { cuentas, filtros, negocio, auth } = usePagina<CuentasProps>();
 */
export function usePagina<T extends object = Record<string, never>>(): T & Compartido {
    return usePage().props as unknown as T & Compartido;
}

/** Usuario en sesión (dentro de AppLayout siempre existe). */
export function useUsuario() {
    return usePagina().auth.user;
}
