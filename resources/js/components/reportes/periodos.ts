import { aFecha, aIso, diasEntre, fechaCorta, fechaLarga, sumarDias } from '@/lib/formato';
import type { DiaSerie } from '@/types';

/** «lunes 16 de noviembre» → «Lunes 16 de noviembre». */
export function capitalizar(texto: string): string {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** «10 %» con espacio duro: el número y el signo nunca quedan en renglones distintos. */
export function porciento(valor: number): string {
    return `${Number.isInteger(valor) ? valor : valor.toFixed(1)} %`;
}

/** Parte entera de un porcentaje (a ÷ b); 0 si no hay base. */
export function proporcion(parte: number, total: number): number {
    return total > 0 ? Math.round((parte / total) * 100) : 0;
}

export type ClaveAtajo = 'hoy' | 'semana' | 'mes' | 'mes_pasado' | 'ultimos_90';

export interface Atajo {
    clave: ClaveAtajo;
    etiqueta: string;
    desde: string;
    hasta: string;
    href: string;
}

/** URL literal del reporte de un rango. `atajo` solo distingue dos atajos que coinciden (un lunes, «Hoy» y «Esta semana»). */
export function urlReporte(desde: string, hasta: string, atajo?: ClaveAtajo): string {
    return `/reportes?desde=${desde}&hasta=${hasta}${atajo ? `&atajo=${atajo}` : ''}`;
}

/** Rangos rápidos calculados desde el «hoy» del negocio (props.negocio.hoy), nunca desde el reloj del navegador. */
export function atajosDePeriodo(hoy: string): Atajo[] {
    const fecha = aFecha(hoy);
    const desdeLunes = (fecha.getDay() + 6) % 7; // la semana empieza en lunes
    const rangos: [ClaveAtajo, string, string, string][] = [
        ['hoy', 'Hoy', hoy, hoy],
        ['semana', 'Esta semana', sumarDias(hoy, -desdeLunes), hoy],
        ['mes', 'Este mes', aIso(new Date(fecha.getFullYear(), fecha.getMonth(), 1)), hoy],
        ['mes_pasado', 'Mes pasado', aIso(new Date(fecha.getFullYear(), fecha.getMonth() - 1, 1)), aIso(new Date(fecha.getFullYear(), fecha.getMonth(), 0))],
        ['ultimos_90', 'Últimos 90 días', sumarDias(hoy, -89), hoy],
    ];

    return rangos.map(([clave, etiqueta, desde, hasta]) => ({ clave, etiqueta, desde, hasta, href: urlReporte(desde, hasta, clave) }));
}

/** Si dos atajos cubren el mismo rango y la URL no dice cuál se eligió, gana el más amplio (así se llega a /reportes: «Este mes»). */
const PRIORIDAD: ClaveAtajo[] = ['mes', 'semana', 'hoy', 'mes_pasado', 'ultimos_90'];

/** Atajo que corresponde al rango en pantalla, o null si es un rango elegido a mano. */
export function atajoActivo(atajos: Atajo[], desde: string, hasta: string, url: string): Atajo | null {
    const coinciden = atajos.filter((atajo) => atajo.desde === desde && atajo.hasta === hasta);
    if (coinciden.length === 0) return null;

    const elegido = new URLSearchParams(url.split('?')[1] ?? '').get('atajo');

    return coinciden.find((atajo) => atajo.clave === elegido) ?? PRIORIDAD.map((clave) => coinciden.find((atajo) => atajo.clave === clave)).find(Boolean) ?? coinciden[0];
}

/** Días que cubre un rango, ambos extremos incluidos. */
export function diasDelRango(desde: string, hasta: string): number {
    return diasEntre(desde, hasta) + 1;
}

export type Agrupacion = 'dia' | 'semana' | 'mes';

/** Un punto de la gráfica: un día, una semana (lunes a domingo) o un mes, recortado al rango del reporte. */
export interface Cubo {
    clave: string;
    desde: string;
    hasta: string;
    dias: number;
    ventas_count: number;
    ventas: number;
    publicidad: number;
    neto: number;
}

function claveDeCubo(fecha: string, agrupacion: Agrupacion): string {
    if (agrupacion === 'dia') return fecha;
    if (agrupacion === 'mes') return fecha.slice(0, 7);

    return sumarDias(fecha, -((aFecha(fecha).getDay() + 6) % 7));
}

/** Junta la serie diaria en días, semanas o meses (la serie llega ordenada y sin huecos). */
export function agrupar(serie: DiaSerie[], agrupacion: Agrupacion): Cubo[] {
    const cubos: Cubo[] = [];

    for (const dia of serie) {
        const clave = claveDeCubo(dia.fecha, agrupacion);
        const ultimo = cubos[cubos.length - 1];

        if (ultimo && ultimo.clave === clave) {
            ultimo.hasta = dia.fecha;
            ultimo.dias += 1;
            ultimo.ventas_count += dia.ventas_count;
            ultimo.ventas += dia.ventas;
            ultimo.publicidad += dia.publicidad;
            ultimo.neto += dia.neto;
        } else {
            cubos.push({ clave, desde: dia.fecha, hasta: dia.fecha, dias: 1, ventas_count: dia.ventas_count, ventas: dia.ventas, publicidad: dia.publicidad, neto: dia.neto });
        }
    }

    return cubos;
}

/** Agrupación que deja la gráfica legible según lo largo del rango. */
export function agrupacionSugerida(dias: number): Agrupacion {
    if (dias <= 62) return 'dia';

    return dias <= 210 ? 'semana' : 'mes';
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;

/** Rótulo corto del eje: «16 nov» (día y semana, por su primer día) o «nov» (mes; con año en enero o al empezar). */
export function rotuloDeCubo(cubo: Cubo, agrupacion: Agrupacion, primero = false): string {
    if (agrupacion !== 'mes') return fechaCorta(cubo.desde, { anio: false });

    const fecha = aFecha(cubo.desde);

    return `${MESES_CORTOS[fecha.getMonth()]}${primero || fecha.getMonth() === 0 ? ` ${fecha.getFullYear()}` : ''}`;
}

/** Título del detalle de un punto: «Lunes 16 de noviembre», «Semana del 9 al 15 nov» o «Noviembre de 2026». */
export function tituloDeCubo(cubo: Cubo, agrupacion: Agrupacion, hoy: string): string {
    if (agrupacion === 'dia') return cubo.desde === hoy ? `Hoy, ${fechaCorta(cubo.desde, { anio: false })}` : capitalizar(fechaLarga(cubo.desde));

    if (agrupacion === 'semana') {
        return cubo.desde === cubo.hasta ? `Semana del ${fechaCorta(cubo.desde, { anio: false })}` : `Semana del ${fechaCorta(cubo.desde, { anio: false })} al ${fechaCorta(cubo.hasta, { anio: false })}`;
    }

    const fecha = aFecha(cubo.desde);

    return `${capitalizar(MESES[fecha.getMonth()])} de ${fecha.getFullYear()}`;
}
