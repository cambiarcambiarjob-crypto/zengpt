import type { DiaSerie, FilaVendedor, Totales } from '@/types';

type Celda = string | number;

/** Centavos → pesos con dos decimales y sin separadores («1250.50»): Excel y Google Sheets lo leen como número. */
function monto(centavos: number): string {
    const valor = Math.round(centavos);

    return `${valor < 0 ? '-' : ''}${Math.floor(Math.abs(valor) / 100)}.${String(Math.abs(valor) % 100).padStart(2, '0')}`;
}

/**
 * Escapa una celda: comillas si trae comas, comillas o saltos de línea; y un apóstrofo delante de los textos que una
 * hoja de cálculo tomaría por fórmula (un nombre que empiece con «=», «+», «-» o «@»).
 */
function celda(valor: Celda): string {
    if (typeof valor === 'number') return String(valor);

    const seguro = /^[=+\-@\t\r]/.test(valor) && Number.isNaN(Number(valor)) ? `'${valor}` : valor;

    return /[",\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** Texto CSV (separado por comas, saltos CRLF) a partir de renglones de celdas. */
export function aCsv(renglones: Celda[][]): string {
    return renglones.map((renglon) => renglon.map(celda).join(',')).join('\r\n') + '\r\n';
}

/** Descarga un CSV generado en el navegador. Lleva BOM para que Excel respete los acentos. */
export function descargarCsv(nombre: string, renglones: Celda[][]): void {
    const url = URL.createObjectURL(new Blob(['﻿', aCsv(renglones)], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    // El navegador ya tomó el archivo: se libera la memoria un momento después.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface DatosCsvVendedores {
    desde: string;
    hasta: string;
    filas: FilaVendedor[];
    totales: Totales;
    /** Nombre del dueño para rotular su columna («Parte de Leo»). */
    dueno: string;
    porcentajeSocio: number;
}

/** Las filas del reporte por vendedor, con el renglón de totales al final. Montos en pesos. */
export function csvPorVendedor({ desde, hasta, filas, totales, dueno, porcentajeSocio }: DatosCsvVendedores): Celda[][] {
    const renglon = (nombre: string, t: Totales): Celda[] => [desde, hasta, nombre, t.ventas_count, monto(t.ventas), monto(t.publicidad), monto(t.costo), monto(t.neto), monto(t.socio), monto(t.vendedor), monto(t.dueno)];

    return [
        ['Desde', 'Hasta', 'Vendedor', 'Ventas', 'Vendido (MXN)', 'Publicidad (MXN)', 'Costo de cuentas (MXN)', 'Neto (MXN)', `Socio ${porcentajeSocio}% (MXN)`, 'Parte del vendedor (MXN)', `Parte de ${dueno} (MXN)`],
        ...filas.map((fila) => renglon(fila.name, fila)),
        renglon('Total', totales),
    ];
}

/** La serie por día (un renglón por fecha, en orden), con el total al final. Montos en pesos. */
export function csvPorDia(serie: DiaSerie[]): Celda[][] {
    const total = serie.reduce((suma, dia) => ({ n: suma.n + dia.ventas_count, ventas: suma.ventas + dia.ventas, publicidad: suma.publicidad + dia.publicidad, costo: suma.costo + dia.costo, neto: suma.neto + dia.neto }), { n: 0, ventas: 0, publicidad: 0, costo: 0, neto: 0 });

    return [
        ['Fecha', 'Ventas', 'Vendido (MXN)', 'Publicidad (MXN)', 'Costo de cuentas (MXN)', 'Neto (MXN)'],
        ...serie.map((dia): Celda[] => [dia.fecha, dia.ventas_count, monto(dia.ventas), monto(dia.publicidad), monto(dia.costo), monto(dia.neto)]),
        ['Total', total.n, monto(total.ventas), monto(total.publicidad), monto(total.costo), monto(total.neto)],
    ];
}
