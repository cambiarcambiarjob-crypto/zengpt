// Formato de dinero, números y fechas para toda la interfaz (español de México).
// El dinero llega del servidor en CENTAVOS; las fechas, como texto 'AAAA-MM-DD' (día del negocio, sin hora).

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

const MENOS = '−'; // signo menos tipográfico: mismo ancho que las cifras tabulares

function miles(entero: number): string {
    return String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface OpcionesDinero {
    /** Añade « MXN» al final. Úsalo solo donde ayude (totales, encabezados). */
    mxn?: boolean;
    /** Muestra «+» en los positivos (para diferencias). */
    signo?: boolean;
    /** Fuerza los dos decimales aunque sean .00 (columnas que mezclan montos con y sin centavos). */
    decimales?: boolean;
}

/** dinero(125000) → «$1,250» · dinero(125050) → «$1,250.50» · dinero(-35000) → «−$350». */
export function dinero(centavos: number | null | undefined, opciones: OpcionesDinero = {}): string {
    const valor = Math.round(Number(centavos) || 0);
    const absoluto = Math.abs(valor);
    const pesos = Math.floor(absoluto / 100);
    const resto = absoluto % 100;
    const conDecimales = opciones.decimales || resto !== 0;
    const prefijo = valor < 0 ? MENOS : opciones.signo && valor > 0 ? '+' : '';

    return `${prefijo}$${miles(pesos)}${conDecimales ? `.${String(resto).padStart(2, '0')}` : ''}${opciones.mxn ? ' MXN' : ''}`;
}

/** Centavos → pesos como texto para rellenar un formulario: 20000 → «200», 20050 → «200.50», 0 → «». */
export function pesos(centavos: number | null | undefined): string {
    const valor = Math.round(Number(centavos) || 0);
    if (valor === 0) return '';

    return valor % 100 === 0 ? String(valor / 100) : (valor / 100).toFixed(2);
}

/** numero(1234) → «1,234». */
export function numero(valor: number | null | undefined): string {
    const n = Math.round(Number(valor) || 0);

    return `${n < 0 ? MENOS : ''}${miles(Math.abs(n))}`;
}

/** porcentaje(10) → «10%» · porcentaje(12.5) → «12.5%». */
export function porcentaje(valor: number): string {
    return `${Number.isInteger(valor) ? valor : valor.toFixed(1)}%`;
}

/** plural(1, 'cliente') → «1 cliente» · plural(3, 'cliente') → «3 clientes» · plural(2, 'vendedor', 'vendedores'). */
export function plural(cantidad: number, singular: string, pluralizado?: string): string {
    return `${numero(cantidad)} ${cantidad === 1 ? singular : (pluralizado ?? `${singular}s`)}`;
}

/** Convierte 'AAAA-MM-DD' en un Date LOCAL (sin el corrimiento de zona horaria de `new Date('AAAA-MM-DD')`). */
export function aFecha(iso: string): Date {
    const [anio, mes, dia] = iso.slice(0, 10).split('-').map(Number);

    return new Date(anio, (mes || 1) - 1, dia || 1);
}

/** Date local → 'AAAA-MM-DD'. */
export function aIso(fecha: Date): string {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

/** sumarDias('2026-11-16', -1) → '2026-11-15'. */
export function sumarDias(iso: string, dias: number): string {
    const fecha = aFecha(iso);
    fecha.setDate(fecha.getDate() + dias);

    return aIso(fecha);
}

/** Días de `desde` a `hasta` (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
    return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000);
}

/** fechaLarga('2026-11-16') → «lunes 16 de noviembre» · con { anio: true } → «lunes 16 de noviembre de 2026». */
export function fechaLarga(iso: string, opciones: { anio?: boolean } = {}): string {
    const fecha = aFecha(iso);
    const base = `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;

    return opciones.anio ? `${base} de ${fecha.getFullYear()}` : base;
}

/**
 * fechaCorta('2026-11-16') → «16 nov». El año aparece solo si no es el año en curso («16 nov 2025»);
 * con { anio: true } siempre, con { anio: false } nunca.
 */
export function fechaCorta(iso: string, opciones: { anio?: boolean } = {}): string {
    const fecha = aFecha(iso);
    const conAnio = opciones.anio ?? fecha.getFullYear() !== new Date().getFullYear();

    return `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}${conAnio ? ` ${fecha.getFullYear()}` : ''}`;
}

/** fechaMedia('2026-11-16') → «16 de noviembre de 2026». */
export function fechaMedia(iso: string): string {
    const fecha = aFecha(iso);

    return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

/** mesLargo('2026-11-16') → «noviembre de 2026». */
export function mesLargo(iso: string): string {
    const fecha = aFecha(iso);

    return `${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

/** rangoFechas('2026-11-01', '2026-11-16') → «1 – 16 nov» · entre meses → «28 oct – 16 nov». */
export function rangoFechas(desde: string, hasta: string): string {
    if (desde === hasta) return fechaCorta(desde);

    const a = aFecha(desde);
    const b = aFecha(hasta);

    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
        return `${a.getDate()} – ${fechaCorta(hasta)}`;
    }

    return `${fechaCorta(desde, { anio: a.getFullYear() !== b.getFullYear() ? true : undefined })} – ${fechaCorta(hasta)}`;
}

/** Fecha respecto a hoy (props.negocio.hoy): «hoy», «ayer», «mañana» o la fecha corta. */
export function fechaRelativa(iso: string, hoy: string): string {
    const diferencia = diasEntre(hoy, iso);

    if (diferencia === 0) return 'hoy';
    if (diferencia === -1) return 'ayer';
    if (diferencia === 1) return 'mañana';

    return fechaCorta(iso);
}

/** diasEnPalabras(5) → «en 5 días» · 1 → «mañana» · 0 → «hoy» · -1 → «ayer» · -3 → «hace 3 días». */
export function diasEnPalabras(dias: number): string {
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'mañana';
    if (dias === -1) return 'ayer';

    return dias > 0 ? `en ${numero(dias)} días` : `hace ${numero(-dias)} días`;
}

/**
 * Vigencia de una cuenta en palabras a partir de `cuenta.dias_restantes`:
 * 12 → «vence en 12 días» · 1 → «vence mañana» · 0 → «vence hoy» · -1 → «venció ayer» · -4 → «venció hace 4 días».
 */
export function diasRestantes(dias: number): string {
    return `${dias >= 0 ? 'vence' : 'venció'} ${diasEnPalabras(dias)}`;
}

/** Versión breve para insignias: 12 → «12 días» · 1 → «1 día» · 0 → «hoy» · negativos → «vencida». */
export function diasRestantesCorto(dias: number): string {
    if (dias < 0) return 'vencida';
    if (dias === 0) return 'hoy';

    return dias === 1 ? '1 día' : `${numero(dias)} días`;
}

/** iniciales('Leo') → «L» · iniciales('Juan Pérez') → «JP». */
export function iniciales(nombre: string): string {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);

    return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '')).toUpperCase();
}

/** Texto de un input de pesos → número (NaN si no es un monto válido). Acepta «1,250.50» y «$400». */
export function aNumeroPesos(texto: string): number {
    const limpio = texto.replace(/[$,\s]/g, '');

    return limpio === '' ? Number.NaN : Number(limpio);
}
