import { CircleCheck, Link2, Pencil, Power, StickyNote, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { BarraEspacios } from '@/components/ui/BarraEspacios';
import { Boton } from '@/components/ui/Boton';
import { estadoDeCuenta, Insignia } from '@/components/ui/Insignia';
import { cn } from '@/lib/cn';
import { diasEnPalabras, diasEntre, dinero, fechaCorta } from '@/lib/formato';
import type { Cuenta, Espacio } from '@/types';
import { AvisoBloqueo, CasillaBloqueada } from './BloqueoGoogle';
import { CasillaLibre, CasillaOcupada } from './CasillaEspacio';
import { Copiable } from './Copiable';
import { GoogleCuenta } from './GoogleCuenta';
import { coincideEspacio } from './utilidades';

export interface TarjetaCuentaProps {
    cuenta: Cuenta;
    /** «Hoy» del negocio (props.negocio.hoy). */
    hoy: string;
    /** Búsqueda aplicada (en minúsculas): resalta al cliente que coincide. */
    busqueda: string;
    alEditar: (cuenta: Cuenta) => void;
    alEliminar: (cuenta: Cuenta) => void;
    alAgregarCliente: (cuenta: Cuenta) => void;
    alEditarCliente: (cuenta: Cuenta, espacio: Espacio) => void;
    alLiberar: (cuenta: Cuenta, espacio: Espacio) => void;
    /** Activar una cuenta que está «por activar». */
    alActivar: (cuenta: Cuenta) => void;
}

const BORDE = { activa: 'border-borde', por_vencer: 'border-alerta/30', vencida: 'border-peligro/25', por_activar: 'border-info/30 border-dashed' } as const;
const TONO_DIAS = { activa: 'text-suave', por_vencer: 'text-alerta', vencida: 'text-peligro', por_activar: 'text-info' } as const;

/**
 * Una cuenta con sus espacios: Gmail copiable, estado, vigencia, ingresos y las casillas (ocupadas o «Agregar cliente»).
 * Va memorizada: escribir en el buscador o abrir un modal no vuelve a pintar las tarjetas.
 */
export const TarjetaCuenta = memo(function TarjetaCuenta({ cuenta, hoy, busqueda, alEditar, alEliminar, alAgregarCliente, alEditarCliente, alLiberar, alActivar }: TarjetaCuentaProps) {
    const estado = estadoDeCuenta(cuenta);
    const vencida = estado === 'vencida';
    const porActivar = estado === 'por_activar';
    const porPosicion = new Map(cuenta.espacios.map((espacio) => [espacio.position, espacio]));
    // Si algún espacio trae una posición fuera de 1…capacidad, igual se muestra (al final).
    const fuera = cuenta.espacios.filter((espacio) => espacio.position < 1 || espacio.position > cuenta.capacidad);
    const tituloId = `cuenta-${cuenta.id}-titulo`;
    // Días de calendario entre «hoy» del negocio y el vencimiento, con las dos fechas que manda el servidor
    // (fechas puras: no dependen de la hora ni de la zona horaria).
    const dias = diasEntre(hoy, cuenta.expires_on);
    // Ligas de invitación capturadas y vigentes (una por espacio).
    const ligas = cuenta.invite_links.filter((liga) => liga.url && (!liga.expires_on || liga.expires_on >= hoy)).length;
    const capacidad = cuenta.invite_links.length;
    const bloqueo = cuenta.google.bloqueo_hasta;

    return (
        <article
            id={`cuenta-${cuenta.id}`}
            tabIndex={-1}
            aria-labelledby={tituloId}
            className={cn(
                '@container rounded-tarjeta border bg-superficie shadow-tarjeta outline-none focus-visible:border-acento/60',
                BORDE[estado],
            )}
        >
            <header className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3 px-4 pt-4 sm:px-5 sm:pt-5">
                <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                        <h2 id={tituloId} className="flex max-w-full min-w-0 font-sans text-base leading-snug font-semibold tracking-normal text-texto">
                            <Copiable texto={cuenta.email} etiqueta="Gmail de la cuenta" className="py-0.5" />
                        </h2>
                        <Insignia estado={estado} />
                        {cuenta.llena && (
                            <span
                                className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[5px] border border-exito/40 bg-exito/12 px-2 text-[11px] font-semibold tracking-wide whitespace-nowrap text-exito uppercase"
                                title="Todos los espacios ocupados, pagados y dentro del grupo"
                            >
                                <CircleCheck className="size-3" aria-hidden="true" />
                                Llena
                            </span>
                        )}
                        {ligas > 0 && (
                            <span
                                className={cn(
                                    'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[5px] border px-2 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase',
                                    ligas >= capacidad ? 'border-info/40 bg-info/12 text-info' : 'border-borde-fuerte bg-superficie-2 text-suave',
                                )}
                                title={ligas >= capacidad ? 'Las 5 ligas de invitación están capturadas y vigentes' : `${ligas} de ${capacidad} ligas de invitación capturadas y vigentes`}
                            >
                                <Link2 className="size-3" aria-hidden="true" />
                                {ligas >= capacidad ? `${capacidad} ligas listas` : `${ligas}/${capacidad} ligas`}
                            </span>
                        )}
                    </div>
                    {porActivar ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                            <Boton variante="primario" tamano="sm" icono={<Power className="size-3.5" aria-hidden="true" />} onClick={() => alActivar(cuenta)} aria-label={`Activar la cuenta ${cuenta.email}`}>
                                Activar
                            </Boton>
                            <p className="min-w-0 flex-1 basis-56 text-[13px] leading-snug text-suave">
                                <span className={cn('font-medium', TONO_DIAS[estado])}>Pendiente de activar</span>
                                <span aria-hidden="true"> · </span>
                                sus meses de vigencia empiezan a correr cuando la actives
                            </p>
                        </div>
                    ) : (
                        <p className="mt-1 text-[13px] leading-snug text-suave">
                            {vencida ? 'Venció el ' : 'Vence el '}
                            <time dateTime={cuenta.expires_on} className="cifras text-texto">
                                {fechaCorta(cuenta.expires_on)}
                            </time>
                            <span aria-hidden="true"> · </span>
                            <span className={cn('font-medium', TONO_DIAS[estado])}>{diasEnPalabras(dias)}</span>
                        </p>
                    )}
                    {(cuenta.password || cuenta.twofa_url) && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-suave">
                            {cuenta.password && (
                                <Copiable texto={cuenta.password} etiqueta="contraseña de la cuenta">
                                    <span className="text-tenue">Contraseña:</span> <span className="cifras text-texto">{cuenta.password}</span>
                                </Copiable>
                            )}
                            {cuenta.twofa_url && (
                                <>
                                    <a href={cuenta.twofa_url} target="_blank" rel="noopener noreferrer" className="text-acento underline-offset-2 hover:underline">
                                        Abrir código 2FA
                                    </a>
                                    <Copiable texto={cuenta.twofa_url} etiqueta="liga de 2FA">
                                        Copiar liga
                                    </Copiable>
                                </>
                            )}
                        </div>
                    )}
                    {cuenta.notes && (
                        <p className="mt-2 flex max-w-2xl items-start gap-1.5 text-[13px] leading-snug text-suave">
                            <StickyNote className="mt-0.5 size-3.5 shrink-0 text-tenue" aria-hidden="true" />
                            <span className="sr-only">Notas: </span>
                            <span className="line-clamp-2 whitespace-pre-line" title={cuenta.notes}>
                                {cuenta.notes}
                            </span>
                        </p>
                    )}
                    <GoogleCuenta cuenta={cuenta} />
                    {!vencida && !porActivar && <AvisoBloqueo cuenta={cuenta} />}
                </div>

                <div className="flex shrink-0 items-center gap-4 sm:gap-5">
                    <div className="sm:text-right">
                        <p className="text-[11px] leading-none font-medium tracking-wider text-tenue uppercase">Ingresos</p>
                        <p className="cifras mt-1.5 font-titulo text-lg leading-none font-semibold text-texto">{dinero(cuenta.ingresos)}</p>
                        {cuenta.pendientes_pago > 0 && <p className="mt-1 text-[11px] font-medium text-alerta">{cuenta.pendientes_pago} por cobrar</p>}
                    </div>
                    <BarraEspacios ocupados={cuenta.ocupados} capacidad={cuenta.capacidad} conTexto />
                    <div className="-mr-1.5 flex items-center gap-0.5">
                        <Boton variante="fantasma" tamano="sm" soloIcono className="pointer-coarse:h-10!" onClick={() => alEditar(cuenta)} title="Editar cuenta" aria-label={`Editar la cuenta ${cuenta.email}`}>
                            <Pencil className="size-4" aria-hidden="true" />
                        </Boton>
                        <Boton
                            variante="fantasma"
                            tamano="sm"
                            soloIcono
                            className="hover:bg-peligro/12! hover:text-peligro! pointer-coarse:h-10!"
                            onClick={() => alEliminar(cuenta)}
                            title="Eliminar cuenta"
                            aria-label={`Eliminar la cuenta ${cuenta.email}`}
                        >
                            <Trash2 className="size-4" aria-hidden="true" />
                        </Boton>
                    </div>
                </div>
            </header>

            <ul aria-label={`Espacios de ${cuenta.email}`} className="grid grid-flow-row-dense grid-cols-2 gap-2.5 p-4 @min-[36rem]:grid-cols-3 @min-[56rem]:grid-cols-5 sm:p-5 sm:pt-4">
                {Array.from({ length: cuenta.capacidad }, (_, indice) => {
                    const espacio = porPosicion.get(indice + 1);

                    if (espacio) {
                        return <CasillaOcupada key={`o${espacio.id}`} cuenta={cuenta} espacio={espacio} hoy={hoy} resaltada={coincideEspacio(espacio, busqueda)} alEditar={alEditarCliente} alLiberar={alLiberar} />;
                    }

                    // Google no deja invitar por ahora: el espacio libre va en rojo con su cuenta regresiva.
                    return bloqueo && !vencida && !porActivar ? (
                        <CasillaBloqueada key={`b${indice}`} cuenta={cuenta} hasta={bloqueo} alAgregar={alAgregarCliente} />
                    ) : (
                        <CasillaLibre key={`l${indice}`} cuenta={cuenta} disponible={!vencida && !porActivar} alAgregar={alAgregarCliente} />
                    );
                })}
                {fuera.map((espacio) => (
                    <CasillaOcupada key={`o${espacio.id}`} cuenta={cuenta} espacio={espacio} hoy={hoy} resaltada={coincideEspacio(espacio, busqueda)} alEditar={alEditarCliente} alLiberar={alLiberar} />
                ))}
            </ul>
        </article>
    );
});
