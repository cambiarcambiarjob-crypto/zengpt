import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Pestanas } from '@/components/ui/Pestanas';
import { Tabla } from '@/components/ui/Tabla';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { dinero, fechaCorta, fechaLarga, numero, plural, rangoFechas } from '@/lib/formato';
import { useMovimientoReducido } from '@/lib/movimiento';
import type { DiaSerie } from '@/types';
import { capitalizar } from './texto';

/**
 * Colores de las tres series. Están en hex porque van a atributos de SVG y se validaron juntos sobre la superficie
 * de las tarjetas (#0f1413): se distinguen también con daltonismo rojo-verde y los tres superan 3:1 de contraste.
 * Ventas usa un jade un paso más hondo que el acento para que 30 barras no «griten».
 */
const COLOR = { ventas: '#1ba981', publicidad: '#d9652e', neto: '#8087ee' } as const;
const SUPERFICIE = '#0f1413';
const REJILLA = '#222b28';
const EJE = '#33403b';

const ANCHO_AVISO = 176;
const MARGEN = { arriba: 12, derecha: 4, abajo: 26 };

type Vista = 'grafica' | 'tabla';

interface Escala {
    min: number;
    max: number;
    marcas: number[];
}

/** Escala en centavos con marcas en números redondos de pesos (0 · 500 · 1,000…) que siempre incluye el cero. */
function escalaLegible(minimo: number, maximo: number): Escala {
    const min = Math.min(0, minimo) / 100;
    const max = Math.max(0, maximo) / 100;
    const bruto = (max - min || 1000) / 4;
    const potencia = 10 ** Math.floor(Math.log10(bruto));
    const paso = [1, 2, 2.5, 5, 10].map((multiplo) => multiplo * potencia).find((candidato) => candidato >= bruto) ?? 10 * potencia;
    const desde = Math.floor(min / paso) * paso;
    const hasta = Math.max(Math.ceil(max / paso) * paso, desde + paso);
    const marcas: number[] = [];

    for (let marca = desde; marca <= hasta + paso / 2; marca += paso) marcas.push(Math.round(marca * 100));

    return { min: Math.round(desde * 100), max: Math.round(hasta * 100), marcas };
}

/** Barra con el extremo del dato redondeado y la base (pegada al eje) recta. `haciaAbajo` = publicidad. */
function trazoBarra(x: number, base: number, extremo: number, ancho: number, haciaAbajo: boolean): string {
    const alto = Math.abs(base - extremo);
    const radio = Math.min(4, ancho / 2, alto);
    const signo = haciaAbajo ? 1 : -1;
    const tope = base + signo * alto;
    const curva = tope - signo * radio;

    return `M${x},${base}V${curva}Q${x},${tope} ${x + radio},${tope}H${x + ancho - radio}Q${x + ancho},${tope} ${x + ancho},${curva}V${base}Z`;
}

function Muestra({ serie }: { serie: keyof typeof COLOR }) {
    return serie === 'neto' ? (
        <span className="h-0.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR.neto }} aria-hidden="true" />
    ) : (
        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: COLOR[serie] }} aria-hidden="true" />
    );
}

export interface GraficaSerieProps {
    /** Un renglón por día, en orden, con los días sin movimiento en cero. */
    serie: DiaSerie[];
    /** Hoy según el negocio (props.negocio.hoy) para marcar la última columna. */
    hoy: string;
    className?: string;
}

/**
 * Últimos 30 días en un SVG propio (sin librerías): ventas como barras hacia arriba, publicidad como barras hacia
 * abajo y el neto como línea, todo sobre el mismo eje de pesos. Al pasar el cursor, tocar o usar las flechas se ve
 * el detalle del día; la vista «Tabla» da los mismos números sin depender del color ni del cursor.
 */
export function GraficaSerie({ serie, hoy, className }: GraficaSerieProps) {
    const reducido = useMovimientoReducido();
    const lienzo = useRef<HTMLDivElement>(null);
    const [vista, setVista] = useState<Vista>('grafica');
    const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
    const [activo, setActivo] = useState<number | null>(null);
    const [listo, setListo] = useState(reducido);

    // El SVG se dibuja al tamaño real del contenedor (texto nítido, sin escalar). El alto lo fija el CSS: no hay saltos.
    useLayoutEffect(() => {
        const elemento = lienzo.current;
        if (!elemento) return undefined;

        const medir = () => setMedida((previa) => (previa.ancho === elemento.clientWidth && previa.alto === elemento.clientHeight ? previa : { ancho: elemento.clientWidth, alto: elemento.clientHeight }));
        medir();
        const observador = new ResizeObserver(medir);
        observador.observe(elemento);

        return () => observador.disconnect();
    }, [vista]);

    // Las barras crecen desde el eje una sola vez, ya con el tamaño medido.
    useEffect(() => {
        if (listo || medida.ancho === 0) return undefined;
        // Dos cuadros: el navegador alcanza a pintar las barras en cero antes de soltarlas.
        let id = requestAnimationFrame(() => {
            id = requestAnimationFrame(() => setListo(true));
        });

        return () => cancelAnimationFrame(id);
    }, [listo, medida.ancho]);

    const totales = useMemo(
        () => serie.reduce((suma, dia) => ({ ventas_count: suma.ventas_count + dia.ventas_count, ventas: suma.ventas + dia.ventas, publicidad: suma.publicidad + dia.publicidad, neto: suma.neto + dia.neto }), { ventas_count: 0, ventas: 0, publicidad: 0, neto: 0 }),
        [serie],
    );
    const sinDatos = totales.ventas === 0 && totales.publicidad === 0;

    const dibujo = useMemo(() => {
        const { ancho, alto } = medida;
        if (ancho === 0 || alto === 0 || serie.length === 0) return null;

        const escala = escalaLegible(Math.min(...serie.map((dia) => Math.min(-dia.publicidad, dia.neto))), Math.max(...serie.map((dia) => Math.max(dia.ventas, dia.neto))));
        const rotulos = escala.marcas.map((marca) => dinero(marca));
        const izquierda = Math.ceil(Math.max(...rotulos.map((rotulo) => rotulo.length)) * 6.4) + 12;
        const anchoTrazo = ancho - izquierda - MARGEN.derecha;
        const altoTrazo = alto - MARGEN.arriba - MARGEN.abajo;
        const paso = anchoTrazo / serie.length;
        const y = (centavos: number) => MARGEN.arriba + ((escala.max - centavos) / (escala.max - escala.min)) * altoTrazo;
        const centro = (indice: number) => izquierda + paso * (indice + 0.5);
        const cero = y(0);
        const barra = Math.min(24, Math.max(2, Math.round(paso * 0.6)));
        const cada = Math.max(1, Math.ceil(64 / paso));

        return {
            ancho,
            alto,
            izquierda,
            paso,
            cero,
            barra,
            centro,
            fondo: MARGEN.arriba + altoTrazo,
            marcas: escala.marcas.map((marca, indice) => ({ valor: marca, y: y(marca), rotulo: rotulos[indice] })),
            dias: serie.map((dia, indice) => {
                const x = centro(indice) - barra / 2;

                return {
                    // Separación de 2 px respecto al eje: las barras de ventas y de publicidad nunca se tocan.
                    ventas: dia.ventas > 0 ? trazoBarra(x, cero - 1, Math.min(y(dia.ventas), cero - 2), barra, false) : null,
                    publicidad: dia.publicidad > 0 ? trazoBarra(x, cero + 1, Math.max(y(-dia.publicidad), cero + 2), barra, true) : null,
                    yNeto: y(dia.neto),
                    conRotulo: (serie.length - 1 - indice) % cada === 0,
                };
            }),
            linea: serie.map((dia, indice) => `${indice === 0 ? 'M' : 'L'}${centro(indice).toFixed(1)},${y(dia.neto).toFixed(1)}`).join(''),
        };
    }, [medida, serie]);

    const indiceEn = (evento: PointerEvent<HTMLDivElement>): number | null => {
        if (!dibujo) return null;
        const caja = evento.currentTarget.getBoundingClientRect();

        return Math.min(serie.length - 1, Math.max(0, Math.floor((evento.clientX - caja.left - dibujo.izquierda) / dibujo.paso)));
    };

    const alTeclear = (evento: KeyboardEvent<HTMLDivElement>) => {
        const ultimo = serie.length - 1;
        const actual = activo ?? ultimo;
        const destino = { ArrowLeft: actual - 1, ArrowDown: actual - 1, ArrowRight: actual + 1, ArrowUp: actual + 1, Home: 0, End: ultimo, PageDown: actual - 7, PageUp: actual + 7 }[evento.key];

        if (evento.key === 'Escape') {
            setActivo(null);
        } else if (destino !== undefined) {
            evento.preventDefault();
            setActivo(Math.min(ultimo, Math.max(0, destino)));
        }
    };

    const diaActivo = activo !== null ? serie[activo] : null;
    const enfocado = serie[activo ?? serie.length - 1];
    const primero = serie[0];
    const ultimo = serie[serie.length - 1];

    return (
        <Tarjeta
            className={className}
            titulo={`Últimos ${serie.length} días`}
            descripcion={primero && ultimo ? `Ventas, publicidad y neto por día · ${rangoFechas(primero.fecha, ultimo.fecha)}` : undefined}
            acciones={
                <Pestanas
                    etiqueta="Vista de los últimos días"
                    activa={vista}
                    alCambiar={(valor) => {
                        setActivo(null);
                        setVista(valor);
                    }}
                    opciones={[
                        { valor: 'grafica', etiqueta: 'Gráfica' },
                        { valor: 'tabla', etiqueta: 'Tabla' },
                    ]}
                />
            }
        >
            {/* Leyenda con el total de cada serie: el color nunca es la única pista. */}
            <ul className="flex flex-wrap gap-x-7 gap-y-2">
                <li className="flex items-center gap-2">
                    <Muestra serie="ventas" />
                    <span className="text-[13px] text-suave">Ventas</span>
                    <span className="cifras text-sm font-semibold text-texto">{dinero(totales.ventas)}</span>
                    <span className="text-xs text-tenue max-sm:hidden">{plural(totales.ventas_count, 'venta')}</span>
                </li>
                <li className="flex items-center gap-2">
                    <Muestra serie="publicidad" />
                    <span className="text-[13px] text-suave">Publicidad</span>
                    <span className="cifras text-sm font-semibold text-texto">{dinero(-totales.publicidad)}</span>
                </li>
                <li className="flex items-center gap-2">
                    <Muestra serie="neto" />
                    <span className="text-[13px] text-suave">Neto</span>
                    <span className={cn('cifras text-sm font-semibold', totales.neto < 0 ? 'text-peligro' : 'text-texto')}>{dinero(totales.neto)}</span>
                </li>
            </ul>

            {vista === 'grafica' ? (
                <div
                    ref={lienzo}
                    role="slider"
                    tabIndex={0}
                    aria-label="Día de la gráfica. Usa las flechas para recorrer los días."
                    aria-orientation="horizontal"
                    aria-valuemin={1}
                    aria-valuemax={serie.length}
                    aria-valuenow={(activo ?? serie.length - 1) + 1}
                    aria-valuetext={enfocado ? `${fechaLarga(enfocado.fecha)}: ${plural(enfocado.ventas_count, 'venta')} por ${dinero(enfocado.ventas)}, publicidad ${dinero(enfocado.publicidad)}, neto ${dinero(enfocado.neto)}` : undefined}
                    className="relative mt-4 h-56 touch-pan-y rounded-campo select-none sm:h-72"
                    onPointerMove={(evento) => setActivo(indiceEn(evento))}
                    onPointerDown={(evento) => setActivo(indiceEn(evento))}
                    onPointerLeave={(evento) => {
                        if (evento.pointerType === 'mouse') setActivo(null);
                    }}
                    onKeyDown={alTeclear}
                    onFocus={(evento) => {
                        if (evento.currentTarget.matches(':focus-visible')) setActivo((previo) => previo ?? serie.length - 1);
                    }}
                    onBlur={() => setActivo(null)}
                >
                    {dibujo && (
                        <svg width={dibujo.ancho} height={dibujo.alto} viewBox={`0 0 ${dibujo.ancho} ${dibujo.alto}`} className="absolute inset-0 block" aria-hidden="true" focusable="false">
                            {/* Rejilla y eje: líneas finas y continuas, sin competir con los datos. */}
                            {dibujo.marcas.map((marca) => (
                                <g key={marca.valor}>
                                    <line x1={dibujo.izquierda} x2={dibujo.ancho - MARGEN.derecha} y1={Math.round(marca.y) + 0.5} y2={Math.round(marca.y) + 0.5} stroke={marca.valor === 0 ? EJE : REJILLA} strokeWidth={1} />
                                    <text x={dibujo.izquierda - 8} y={marca.y} textAnchor="end" dominantBaseline="middle" className="cifras fill-tenue text-[11px]">
                                        {marca.rotulo}
                                    </text>
                                </g>
                            ))}

                            {/* Columna del día señalado. */}
                            {activo !== null && <rect x={dibujo.izquierda + dibujo.paso * activo} y={MARGEN.arriba} width={dibujo.paso} height={dibujo.fondo - MARGEN.arriba} rx={3} fill="#e8eeeb" fillOpacity={0.06} />}

                            {dibujo.dias.map((dia, indice) => {
                                const apagada = activo !== null && activo !== indice;
                                const transicion = `transform 520ms cubic-bezier(0.22, 1, 0.36, 1) ${indice * 9}ms`;

                                return (
                                    <g key={serie[indice].fecha} opacity={apagada ? 0.5 : 1}>
                                        {dia.ventas && <path d={dia.ventas} fill={COLOR.ventas} style={{ transformBox: 'fill-box', transformOrigin: 'center bottom', transform: listo ? 'scaleY(1)' : 'scaleY(0)', transition: transicion }} />}
                                        {dia.publicidad && <path d={dia.publicidad} fill={COLOR.publicidad} style={{ transformBox: 'fill-box', transformOrigin: 'center top', transform: listo ? 'scaleY(1)' : 'scaleY(0)', transition: transicion }} />}
                                    </g>
                                );
                            })}

                            {/* Neto: línea de 2 px con un halo del color de la superficie para que se lea al cruzar las barras. */}
                            {!sinDatos && (
                                <g style={{ opacity: listo ? 1 : 0, transition: 'opacity 420ms ease-out 260ms' }}>
                                    <path d={dibujo.linea} fill="none" stroke={SUPERFICIE} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
                                    <path d={dibujo.linea} fill="none" stroke={COLOR.neto} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                                    <circle cx={dibujo.centro(activo ?? serie.length - 1)} cy={dibujo.dias[activo ?? serie.length - 1].yNeto} r={4.5} fill={COLOR.neto} stroke={SUPERFICIE} strokeWidth={2} />
                                </g>
                            )}

                            {dibujo.dias.map((dia, indice) => {
                                if (!dia.conRotulo) return null;
                                const esHoy = serie[indice].fecha === hoy;
                                const esUltimo = indice === serie.length - 1;

                                return (
                                    <text
                                        key={serie[indice].fecha}
                                        x={esUltimo ? Math.min(dibujo.ancho, dibujo.centro(indice) + 16) : dibujo.centro(indice)}
                                        y={dibujo.alto - 6}
                                        textAnchor={esUltimo ? 'end' : 'middle'}
                                        className={cn('cifras text-[11px]', esHoy ? 'fill-texto font-semibold' : 'fill-tenue')}
                                    >
                                        {esHoy ? 'Hoy' : fechaCorta(serie[indice].fecha, { anio: false })}
                                    </text>
                                );
                            })}
                        </svg>
                    )}

                    {sinDatos && (
                        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-12 text-center text-sm text-tenue">Sin ventas ni publicidad en estos {serie.length} días.</p>
                    )}

                    {dibujo && diaActivo && activo !== null && (
                        <div
                            className="pointer-events-none absolute top-0 z-10 rounded-campo border border-borde-fuerte bg-superficie-2 px-3 py-2.5 shadow-flotante"
                            style={{
                                width: ANCHO_AVISO,
                                left:
                                    dibujo.centro(activo) < dibujo.ancho / 2
                                        ? Math.min(dibujo.centro(activo) + dibujo.paso / 2 + 10, dibujo.ancho - ANCHO_AVISO)
                                        : Math.max(dibujo.centro(activo) - dibujo.paso / 2 - 10 - ANCHO_AVISO, 0),
                            }}
                        >
                            <p className="text-xs font-medium text-suave">{capitalizar(fechaLarga(diaActivo.fecha))}</p>
                            <dl className="mt-1.5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-[13px]">
                                <dt className="flex items-center gap-1.5 text-suave">
                                    <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: COLOR.ventas }} aria-hidden="true" />
                                    Ventas
                                </dt>
                                <dd className="cifras text-right font-semibold text-texto">
                                    {dinero(diaActivo.ventas)} <span className="font-normal text-tenue">· {numero(diaActivo.ventas_count)}</span>
                                </dd>
                                <dt className="flex items-center gap-1.5 text-suave">
                                    <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: COLOR.publicidad }} aria-hidden="true" />
                                    Publicidad
                                </dt>
                                <dd className="cifras text-right font-semibold text-texto">{dinero(-diaActivo.publicidad)}</dd>
                                <dt className="flex items-center gap-1.5 text-suave">
                                    <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: COLOR.neto }} aria-hidden="true" />
                                    Neto
                                </dt>
                                <dd className={cn('cifras text-right font-semibold', diaActivo.neto < 0 ? 'text-peligro' : 'text-texto')}>{dinero(diaActivo.neto)}</dd>
                            </dl>
                        </div>
                    )}
                </div>
            ) : (
                <div tabIndex={0} role="region" aria-label={`Tabla de los últimos ${serie.length} días`} className="mt-4 h-56 overflow-y-auto rounded-campo border border-borde sm:h-72">
                    <Tabla
                        sinMarco
                        densa
                        titulo={`Ventas, publicidad y neto por día, últimos ${serie.length} días`}
                        filas={[...serie].reverse()}
                        clave={(dia) => dia.fecha}
                        columnas={[
                            {
                                clave: 'fecha',
                                titulo: 'Día',
                                clase: 'whitespace-nowrap',
                                celda: (dia) =>
                                    dia.fecha === hoy ? (
                                        'Hoy'
                                    ) : (
                                        <>
                                            <span className="sm:hidden">{fechaCorta(dia.fecha)}</span>
                                            <span className="max-sm:hidden">{capitalizar(fechaLarga(dia.fecha))}</span>
                                        </>
                                    ),
                            },
                            { clave: 'cantidad', titulo: 'Ventas', numerica: true, celda: (dia) => numero(dia.ventas_count), pie: numero(totales.ventas_count), ocultar: 'movil' },
                            { clave: 'ventas', titulo: 'Vendido', numerica: true, celda: (dia) => dinero(dia.ventas), pie: dinero(totales.ventas) },
                            { clave: 'publicidad', titulo: 'Publicidad', numerica: true, celda: (dia) => dinero(-dia.publicidad), pie: dinero(-totales.publicidad) },
                            { clave: 'neto', titulo: 'Neto', numerica: true, celda: (dia) => <span className={dia.neto < 0 ? 'text-peligro' : undefined}>{dinero(dia.neto)}</span>, pie: dinero(totales.neto) },
                        ]}
                    />
                </div>
            )}
        </Tarjeta>
    );
}
