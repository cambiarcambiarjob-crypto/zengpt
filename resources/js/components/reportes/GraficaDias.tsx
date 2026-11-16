import { ChartColumn } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { EnlaceBoton } from '@/components/ui/Boton';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Pestanas } from '@/components/ui/Pestanas';
import { Tarjeta } from '@/components/ui/Tarjeta';
import { cn } from '@/lib/cn';
import { dinero, fechaCorta, plural } from '@/lib/formato';
import type { DiaSerie } from '@/types';
import { COLOR_SERIE } from './colores';
import { useEntrada } from './entrada';
import { agrupacionSugerida, agrupar, rotuloDeCubo, tituloDeCubo, type Agrupacion } from './periodos';


// En hex porque van a atributos de SVG (son los tokens superficie, borde y borde-fuerte).
const SUPERFICIE = '#0f1413';
const REJILLA = '#222b28';
const EJE = '#33403b';

const ANCHO_AVISO = 190;
const MARGEN = { arriba: 12, derecha: 4, abajo: 26 };
const NOMBRE_AGRUPACION: Record<Agrupacion, string> = { dia: 'día', semana: 'semana', mes: 'mes' };

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
    // Sin ningún movimiento se dibuja una rejilla de referencia en lugar de un eje vacío.
    const hasta = min === 0 && max === 0 ? paso * 4 : Math.max(Math.ceil(max / paso) * paso, desde + paso);
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

function Muestra({ serie }: { serie: keyof typeof COLOR_SERIE }) {
    return serie === 'neto' ? (
        <span className="h-0.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_SERIE.neto }} aria-hidden="true" />
    ) : (
        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: COLOR_SERIE[serie] }} aria-hidden="true" />
    );
}

export interface GraficaDiasProps {
    /** Un renglón por día del reporte, en orden y con los días sin movimiento en cero (el servidor manda como máximo un año). */
    serie: DiaSerie[];
    /** Inicio del rango pedido: si la serie empieza después, la gráfica avisa que solo cubre el último año. */
    desde: string;
    /** Hoy según el negocio (props.negocio.hoy). */
    hoy: string;
    className?: string;
}

/**
 * Gráfica del periodo en un SVG propio (sin librerías): ventas como barras hacia arriba, publicidad como barras hacia
 * abajo y el neto como línea, todo sobre el mismo eje de pesos. En rangos largos se agrupa sola por semana o por mes
 * (se puede cambiar). El detalle de cada punto sale con el cursor, al tocar o con las flechas; los mismos números están
 * en la tabla «Por día» de abajo, así que nada depende del color ni del cursor.
 */
export function GraficaDias({ serie, desde, hoy, className }: GraficaDiasProps) {
    const lienzo = useRef<HTMLDivElement>(null);
    const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
    const [activo, setActivo] = useState<number | null>(null);
    const listo = useEntrada(medida.ancho === 0);

    // La agrupación elegida a mano vale solo para el rango en el que se eligió; al cambiar de rango vuelve la sugerida.
    const rango = serie.length > 0 ? `${serie[0].fecha}/${serie[serie.length - 1].fecha}` : '';
    const [eleccion, setEleccion] = useState<{ rango: string; valor: Agrupacion } | null>(null);
    const agrupacion = eleccion?.rango === rango ? eleccion.valor : agrupacionSugerida(serie.length);
    const cubos = useMemo(() => agrupar(serie, agrupacion), [serie, agrupacion]);
    const unSoloDia = serie.length < 2;
    const sinDatos = serie.every((dia) => dia.ventas === 0 && dia.publicidad === 0);

    const opciones = useMemo(() => {
        const lista: { valor: Agrupacion; etiqueta: string }[] = [{ valor: 'dia', etiqueta: 'Día' }];
        if (serie.length > 13) lista.push({ valor: 'semana', etiqueta: 'Semana' });
        if (serie.length > 59) lista.push({ valor: 'mes', etiqueta: 'Mes' });

        return lista;
    }, [serie.length]);

    // El SVG se dibuja al tamaño real del contenedor (texto nítido, sin escalar). El alto lo fija el CSS: no hay saltos.
    useLayoutEffect(() => {
        const elemento = lienzo.current;
        if (!elemento) return undefined;

        const medir = () => setMedida((previa) => (previa.ancho === elemento.clientWidth && previa.alto === elemento.clientHeight ? previa : { ancho: elemento.clientWidth, alto: elemento.clientHeight }));
        medir();
        const observador = new ResizeObserver(medir);
        observador.observe(elemento);

        return () => observador.disconnect();
    }, [unSoloDia]);

    const dibujo = useMemo(() => {
        const { ancho, alto } = medida;
        if (ancho === 0 || alto === 0 || cubos.length === 0) return null;

        const escala = escalaLegible(Math.min(...cubos.map((cubo) => Math.min(-cubo.publicidad, cubo.neto))), Math.max(...cubos.map((cubo) => Math.max(cubo.ventas, cubo.neto))));
        const rotulos = escala.marcas.map((marca) => dinero(marca));
        const izquierda = Math.ceil(Math.max(...rotulos.map((rotulo) => rotulo.length)) * 6.4) + 12;
        const anchoTrazo = ancho - izquierda - MARGEN.derecha;
        const altoTrazo = alto - MARGEN.arriba - MARGEN.abajo;
        const paso = anchoTrazo / cubos.length;
        const y = (centavos: number) => MARGEN.arriba + ((escala.max - centavos) / (escala.max - escala.min)) * altoTrazo;
        const centro = (indice: number) => izquierda + paso * (indice + 0.5);
        const cero = y(0);
        const barra = Math.min(24, Math.max(1.5, Math.round(paso * 0.6)));
        const cada = Math.max(1, Math.ceil((agrupacion === 'mes' ? 72 : 64) / paso));

        return {
            ancho,
            alto,
            izquierda,
            paso,
            centro,
            fondo: MARGEN.arriba + altoTrazo,
            marcas: escala.marcas.map((marca, indice) => ({ valor: marca, y: y(marca), rotulo: rotulos[indice] })),
            puntos: cubos.map((cubo, indice) => {
                const x = centro(indice) - barra / 2;

                return {
                    // Separación de 2 px respecto al eje: las barras de ventas y de publicidad nunca se tocan.
                    ventas: cubo.ventas > 0 ? trazoBarra(x, cero - 1, Math.min(y(cubo.ventas), cero - 2), barra, false) : null,
                    publicidad: cubo.publicidad > 0 ? trazoBarra(x, cero + 1, Math.max(y(-cubo.publicidad), cero + 2), barra, true) : null,
                    yNeto: y(cubo.neto),
                    conRotulo: (cubos.length - 1 - indice) % cada === 0,
                };
            }),
            linea: cubos.map((cubo, indice) => `${indice === 0 ? 'M' : 'L'}${centro(indice).toFixed(1)},${y(cubo.neto).toFixed(1)}`).join(''),
        };
    }, [medida, cubos, agrupacion]);

    const ultimoIndice = cubos.length - 1;
    // Al cambiar de rango o de agrupación puede quedar marcado un punto que ya no existe.
    const marcado = activo !== null && activo <= ultimoIndice ? activo : null;

    const indiceEn = (evento: PointerEvent<HTMLDivElement>): number | null => {
        if (!dibujo) return null;
        const caja = evento.currentTarget.getBoundingClientRect();

        return Math.min(ultimoIndice, Math.max(0, Math.floor((evento.clientX - caja.left - dibujo.izquierda) / dibujo.paso)));
    };

    const alTeclear = (evento: KeyboardEvent<HTMLDivElement>) => {
        const actual = marcado ?? ultimoIndice;
        const salto = Math.max(2, Math.round(cubos.length / 8));
        const destino = { ArrowLeft: actual - 1, ArrowDown: actual - 1, ArrowRight: actual + 1, ArrowUp: actual + 1, Home: 0, End: ultimoIndice, PageDown: actual - salto, PageUp: actual + salto }[evento.key];

        if (evento.key === 'Escape') {
            setActivo(null);
        } else if (destino !== undefined) {
            evento.preventDefault();
            setActivo(Math.min(ultimoIndice, Math.max(0, destino)));
        }
    };

    const cuboActivo = marcado !== null ? cubos[marcado] : null;
    const enfocado = cubos[marcado ?? ultimoIndice];
    const recortada = serie.length > 0 && serie[0].fecha > desde;
    const titulo = `Ventas por ${NOMBRE_AGRUPACION[agrupacion]}`;

    return (
        <Tarjeta
            className={className}
            titulo={titulo}
            descripcion={recortada ? `Ventas, publicidad y neto · la gráfica cubre el último año del periodo (desde el ${fechaCorta(serie[0].fecha, { anio: true })})` : 'Ventas, publicidad y neto del periodo sobre el mismo eje de pesos'}
            acciones={
                opciones.length > 1 ? (
                    <Pestanas
                        etiqueta="Agrupar la gráfica por"
                        activa={agrupacion}
                        alCambiar={(valor) => {
                            setActivo(null);
                            setEleccion({ rango, valor });
                        }}
                        opciones={opciones}
                    />
                ) : undefined
            }
        >
            {unSoloDia ? (
                <EstadoVacio
                    compacto
                    icono={<ChartColumn className="size-5" />}
                    titulo="Un solo día no hace gráfica"
                    descripcion="Elige un periodo de dos días o más para ver cómo se movieron las ventas."
                    accion={
                        serie[0] ? (
                            <EnlaceBoton href={`/dia/${serie[0].fecha}`} tamano="sm">
                                Ver el detalle de ese día
                            </EnlaceBoton>
                        ) : undefined
                    }
                />
            ) : (
                <>
                    {/* Leyenda: cada serie con su marca (barra o línea); el color nunca es la única pista. */}
                    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-suave">
                        <li className="flex items-center gap-2">
                            <Muestra serie="ventas" />
                            Ventas
                        </li>
                        <li className="flex items-center gap-2">
                            <Muestra serie="publicidad" />
                            Publicidad
                        </li>
                        <li className="flex items-center gap-2">
                            <Muestra serie="neto" />
                            Neto
                        </li>
                    </ul>

                    <div
                        ref={lienzo}
                        role="slider"
                        tabIndex={0}
                        aria-label={`Punto de la gráfica por ${NOMBRE_AGRUPACION[agrupacion]}. Usa las flechas para recorrerla.`}
                        aria-orientation="horizontal"
                        aria-valuemin={1}
                        aria-valuemax={cubos.length}
                        aria-valuenow={(marcado ?? ultimoIndice) + 1}
                        aria-valuetext={enfocado ? `${tituloDeCubo(enfocado, agrupacion, hoy)}: ${plural(enfocado.ventas_count, 'venta')} por ${dinero(enfocado.ventas)}, publicidad ${dinero(enfocado.publicidad)}, neto ${dinero(enfocado.neto)}` : undefined}
                        className="relative mt-4 h-60 touch-pan-y rounded-campo select-none sm:h-80"
                        onPointerMove={(evento) => setActivo(indiceEn(evento))}
                        onPointerDown={(evento) => setActivo(indiceEn(evento))}
                        onPointerLeave={(evento) => {
                            if (evento.pointerType === 'mouse') setActivo(null);
                        }}
                        onKeyDown={alTeclear}
                        onFocus={(evento) => {
                            if (evento.currentTarget.matches(':focus-visible')) setActivo((previo) => previo ?? ultimoIndice);
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

                                {/* Columna del punto marcado. */}
                                {marcado !== null && <rect x={dibujo.izquierda + dibujo.paso * marcado} y={MARGEN.arriba} width={dibujo.paso} height={dibujo.fondo - MARGEN.arriba} rx={3} fill="#e8eeeb" fillOpacity={0.06} />}

                                {dibujo.puntos.map((punto, indice) => {
                                    const apagada = marcado !== null && marcado !== indice;
                                    // Las barras crecen desde el eje, escalonadas en menos de un tercio de segundo aunque sean 365.
                                    const transicion = `transform 520ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.round((indice / cubos.length) * 280)}ms`;

                                    return (
                                        <g key={cubos[indice].clave} opacity={apagada ? 0.5 : 1}>
                                            {punto.ventas && (
                                                <path d={punto.ventas} fill={COLOR_SERIE.ventas} style={{ transformBox: 'fill-box', transformOrigin: 'center bottom', transform: listo ? 'scaleY(1)' : 'scaleY(0)', transition: transicion }} />
                                            )}
                                            {punto.publicidad && (
                                                <path d={punto.publicidad} fill={COLOR_SERIE.publicidad} style={{ transformBox: 'fill-box', transformOrigin: 'center top', transform: listo ? 'scaleY(1)' : 'scaleY(0)', transition: transicion }} />
                                            )}
                                        </g>
                                    );
                                })}

                                {/* Neto: línea de 2 px con un halo del color de la superficie para que se lea al cruzar las barras. */}
                                {!sinDatos && (
                                    <g style={{ opacity: listo ? 1 : 0, transition: 'opacity 420ms ease-out 260ms' }}>
                                        <path d={dibujo.linea} fill="none" stroke={SUPERFICIE} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
                                        <path d={dibujo.linea} fill="none" stroke={COLOR_SERIE.neto} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                                        <circle cx={dibujo.centro(marcado ?? ultimoIndice)} cy={dibujo.puntos[marcado ?? ultimoIndice].yNeto} r={4.5} fill={COLOR_SERIE.neto} stroke={SUPERFICIE} strokeWidth={2} />
                                    </g>
                                )}

                                {dibujo.puntos.map((punto, indice) => {
                                    if (!punto.conRotulo) return null;
                                    const cubo = cubos[indice];
                                    const esHoy = agrupacion === 'dia' && cubo.desde === hoy;
                                    const esUltimo = indice === ultimoIndice;
                                    const esPrimero = indice === 0;

                                    return (
                                        <text
                                            key={cubo.clave}
                                            x={esUltimo ? Math.min(dibujo.ancho, dibujo.centro(indice) + 18) : esPrimero ? Math.max(dibujo.izquierda, dibujo.centro(indice) - 18) : dibujo.centro(indice)}
                                            y={dibujo.alto - 6}
                                            textAnchor={esUltimo ? 'end' : esPrimero ? 'start' : 'middle'}
                                            className={cn('cifras text-[11px]', esHoy ? 'fill-texto font-semibold' : 'fill-tenue')}
                                        >
                                            {esHoy ? 'Hoy' : rotuloDeCubo(cubo, agrupacion, esPrimero)}
                                        </text>
                                    );
                                })}
                            </svg>
                        )}

                        {sinDatos && <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-12 text-center text-sm text-tenue">Sin ventas ni publicidad en este periodo.</p>}

                        {dibujo && cuboActivo && marcado !== null && (
                            <div
                                className="pointer-events-none absolute top-0 z-10 rounded-campo border border-borde-fuerte bg-superficie-2 px-3 py-2.5 shadow-flotante"
                                style={{
                                    width: ANCHO_AVISO,
                                    left: dibujo.centro(marcado) < dibujo.ancho / 2 ? Math.min(dibujo.centro(marcado) + dibujo.paso / 2 + 10, dibujo.ancho - ANCHO_AVISO) : Math.max(dibujo.centro(marcado) - dibujo.paso / 2 - 10 - ANCHO_AVISO, 0),
                                }}
                            >
                                <p className="text-xs font-medium text-texto">{tituloDeCubo(cuboActivo, agrupacion, hoy)}</p>
                                <p className="text-xs text-tenue">
                                    {cuboActivo.ventas_count === 0 ? 'Sin ventas' : plural(cuboActivo.ventas_count, 'venta')}
                                    {agrupacion !== 'dia' && ` · ${plural(cuboActivo.dias, 'día')}`}
                                </p>
                                <dl className="mt-1.5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-[13px]">
                                    <dt className="flex items-center gap-1.5 text-suave">
                                        <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: COLOR_SERIE.ventas }} aria-hidden="true" />
                                        Ventas
                                    </dt>
                                    <dd className="cifras text-right font-semibold text-texto">{dinero(cuboActivo.ventas)}</dd>
                                    <dt className="flex items-center gap-1.5 text-suave">
                                        <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: COLOR_SERIE.publicidad }} aria-hidden="true" />
                                        Publicidad
                                    </dt>
                                    <dd className="cifras text-right font-semibold text-texto">{dinero(-cuboActivo.publicidad)}</dd>
                                    <dt className="flex items-center gap-1.5 text-suave">
                                        <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: COLOR_SERIE.neto }} aria-hidden="true" />
                                        Neto
                                    </dt>
                                    <dd className={cn('cifras text-right font-semibold', cuboActivo.neto < 0 ? 'text-peligro' : 'text-texto')}>{dinero(cuboActivo.neto)}</dd>
                                </dl>
                            </div>
                        )}
                    </div>
                </>
            )}
        </Tarjeta>
    );
}
