// Reloj compartido para las cuentas regresivas (bloqueo de invitaciones de Google): UN solo intervalo para toda la
// pantalla, y solo mientras haya algún contador a la vista. Cada minuto basta (los contadores no muestran segundos).
import { useSyncExternalStore } from 'react';

const ZONA = 'America/Chihuahua';
const CADA = 30_000;

const oyentes = new Set<() => void>();
let ahora = Date.now();
let intervalo: ReturnType<typeof setInterval> | null = null;

function suscribir(oyente: () => void): () => void {
    oyentes.add(oyente);
    if (intervalo === null) {
        ahora = Date.now();
        intervalo = setInterval(() => {
            ahora = Date.now();
            oyentes.forEach((avisar) => avisar());
        }, CADA);
    }

    return () => {
        oyentes.delete(oyente);
        if (oyentes.size === 0 && intervalo !== null) {
            clearInterval(intervalo);
            intervalo = null;
        }
    };
}

const sinSuscripcion = () => () => {};

/** Milisegundos que faltan para `hasta` (ISO 8601), 0 si ya pasó o no hay fecha. Se actualiza solo. */
export function useRestante(hasta: string | null): number {
    const momento = useSyncExternalStore(hasta ? suscribir : sinSuscripcion, () => ahora, () => ahora);
    if (!hasta) return 0;

    return Math.max(0, new Date(hasta).getTime() - Math.max(momento, Date.now()));
}

/** cuentaRegresiva(6 días 23 h) → «6 d 23 h» · «23 h 5 min» · «5 min» · «menos de 1 min». */
export function cuentaRegresiva(ms: number): string {
    const minutos = Math.ceil(ms / 60_000);
    if (minutos <= 1) return 'menos de 1 min';

    const dias = Math.floor(minutos / 1440);
    const horas = Math.floor((minutos % 1440) / 60);
    const mins = minutos % 60;

    if (dias > 0) return horas > 0 ? `${dias} d ${horas} h` : `${dias} d`;
    if (horas > 0) return mins > 0 ? `${horas} h ${mins} min` : `${horas} h`;

    return `${mins} min`;
}

/** «27 nov, 0:30» en la hora del negocio. */
export function fechaHora(iso: string): string {
    const partes = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
    const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? '';

    return `${valor('day')} ${valor('month').replace('.', '')}, ${Number(valor('hour')) % 24}:${valor('minute')}`;
}

/** 'AAAA-MM-DD' del momento `iso` en el calendario del negocio. */
export function diaDelNegocio(iso: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
