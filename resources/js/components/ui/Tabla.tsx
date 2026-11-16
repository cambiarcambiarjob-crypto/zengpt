import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Columna<T> {
    /** Identificador único de la columna. */
    clave: string;
    /** Encabezado (<th scope="col">). */
    titulo: ReactNode;
    /** Contenido de la celda para cada fila. */
    celda: (fila: T, indice: number) => ReactNode;
    /** Celda del pie (totales). Si alguna columna lo define, la tabla pinta <tfoot>. */
    pie?: ReactNode;
    alinear?: 'izquierda' | 'centro' | 'derecha';
    /** Dinero y conteos: alinea a la derecha y usa cifras tabulares. */
    numerica?: boolean;
    /** Oculta la columna en pantallas chicas: 'movil' (< 640 px) o 'tableta' (< 1024 px). */
    ocultar?: 'movil' | 'tableta';
    /** Clases extra para las celdas de la columna (p. ej. `w-0` o `whitespace-nowrap`). */
    clase?: string;
}

export interface TablaProps<T> {
    columnas: Columna<T>[];
    filas: T[];
    /** Clave estable de cada fila (normalmente su id). */
    clave: (fila: T, indice: number) => string | number;
    /** Descripción de la tabla para lectores de pantalla (<caption> oculto). */
    titulo: string;
    /** Qué mostrar si no hay filas (normalmente un <EstadoVacio compacto … />). */
    vacio?: ReactNode;
    /** Filas más bajas. */
    densa?: boolean;
    /** Clases por fila (p. ej. atenuar las vencidas). */
    claseFila?: (fila: T) => string | undefined;
    /** Quita el marco: para usarla dentro de <Tarjeta relleno="ninguno">. */
    sinMarco?: boolean;
    className?: string;
}

const ALINEAR = { izquierda: 'text-left', centro: 'text-center', derecha: 'text-right' } as const;
const OCULTAR = { movil: 'hidden sm:table-cell', tableta: 'hidden lg:table-cell' } as const;

function clasesCelda<T>(columna: Columna<T>): string {
    return cn(ALINEAR[columna.alinear ?? (columna.numerica ? 'derecha' : 'izquierda')], columna.numerica && 'cifras whitespace-nowrap', columna.ocultar && OCULTAR[columna.ocultar], columna.clase);
}

/**
 * Tabla de datos con encabezados reales, pie de totales opcional y desplazamiento horizontal en celular.
 *
 *   <Tabla titulo="Ventas del día" filas={ventas} clave={(v) => v.id} columnas={[
 *       { clave: 'cliente', titulo: 'Cliente', celda: (v) => v.client_email },
 *       { clave: 'vendedor', titulo: 'Vendedor', celda: (v) => v.seller_name, ocultar: 'movil' },
 *       { clave: 'precio', titulo: 'Precio', numerica: true, celda: (v) => dinero(v.price_cents), pie: dinero(total) },
 *   ]} vacio={<EstadoVacio compacto titulo="Sin ventas todavía" />} />
 */
export function Tabla<T>({ columnas, filas, clave, titulo, vacio, densa = false, claseFila, sinMarco = false, className }: TablaProps<T>) {
    const hayPie = filas.length > 0 && columnas.some((columna) => columna.pie !== undefined);
    const relleno = densa ? 'px-4 py-2' : 'px-4 py-3';

    return (
        <div className={cn('min-w-0 overflow-x-auto', !sinMarco && 'rounded-tarjeta border border-borde bg-superficie shadow-tarjeta', className)}>
            <table className="w-full border-collapse text-sm">
                <caption className="sr-only">{titulo}</caption>
                <thead>
                    <tr className="border-b border-borde">
                        {columnas.map((columna) => (
                            <th key={columna.clave} scope="col" className={cn('px-4 py-2.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-tenue uppercase first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6', clasesCelda(columna))}>
                                {columna.titulo}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filas.length === 0 ? (
                        <tr>
                            <td colSpan={columnas.length} className="p-0">
                                {vacio ?? <p className="px-6 py-10 text-center text-sm text-tenue">Sin datos.</p>}
                            </td>
                        </tr>
                    ) : (
                        filas.map((fila, indice) => (
                            <tr key={clave(fila, indice)} className={cn('border-b border-borde/70 transition-colors duration-100 last:border-b-0 hover:bg-superficie-2/70', claseFila?.(fila))}>
                                {columnas.map((columna) => (
                                    <td key={columna.clave} className={cn(relleno, 'align-middle text-texto first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6', clasesCelda(columna))}>
                                        {columna.celda(fila, indice)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
                {hayPie && (
                    <tfoot>
                        <tr className="border-t border-borde-fuerte bg-superficie-2/60">
                            {columnas.map((columna) => (
                                <td key={columna.clave} className={cn(relleno, 'font-semibold text-texto first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6', clasesCelda(columna))}>
                                    {columna.pie}
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
    );
}
