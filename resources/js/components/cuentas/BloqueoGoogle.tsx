import { router } from '@inertiajs/react';
import { Ban, Plus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { cuentaRegresiva, fechaHora, useRestante } from '@/lib/reloj';
import type { Cuenta } from '@/types';

/**
 * Bloqueo de invitaciones de Google («Has alcanzado el límite de invitaciones al grupo familiar»): Google no deja
 * invitar a nadie más a esa cuenta por unos días. Los espacios libres se pintan de rojo con la cuenta regresiva hasta
 * que se liberan. Lo marca solo el sistema (al invitar o al revisar el grupo desde el visor) o se captura a mano en
 * «Editar cuenta».
 */
export function AvisoBloqueo({ cuenta }: { cuenta: Cuenta }) {
    const hasta = cuenta.google.bloqueo_hasta;
    const restante = useRestante(hasta);
    const [quitando, setQuitando] = useState(false);

    if (!hasta) return null;

    const quitar = () =>
        router.put(`/cuentas/${cuenta.id}/bloqueo`, { accion: 'quitar' }, { preserveScroll: true, preserveState: true, onStart: () => setQuitando(true), onFinish: () => setQuitando(false) });

    return (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-campo border border-peligro/35 bg-peligro/8 px-3 py-2 text-[13px] leading-snug">
            <Ban className="size-4 shrink-0 text-peligro" aria-hidden="true" />
            <p className="min-w-0 flex-1 basis-56">
                <strong className="font-semibold text-peligro">Invitaciones inválidas por Google</strong>
                <span className="text-suave">
                    {restante > 0 ? (
                        <>
                            {' · se liberan en '}
                            <span className="cifras font-semibold text-texto" role="timer" aria-live="off">
                                {cuentaRegresiva(restante)}
                            </span>
                            <span className="text-tenue"> ({fechaHora(hasta)})</span>
                        </>
                    ) : (
                        ' · ya debería dejar invitar: pruébalo'
                    )}
                </span>
            </p>
            <button
                type="button"
                onClick={quitar}
                disabled={quitando}
                className="inline-flex h-7 shrink-0 items-center rounded-[5px] border border-borde-fuerte px-2.5 text-xs font-medium text-suave transition-colors hover:border-exito/50 hover:text-exito disabled:opacity-60 pointer-coarse:h-9"
                title="Google ya deja invitar a esta cuenta: quitar el bloqueo"
            >
                {quitando ? 'Quitando…' : 'Ya se liberó'}
            </button>
        </div>
    );
}

/** Espacio libre en una cuenta bloqueada: rojo, con la cuenta regresiva. Se puede apartar igual para un cliente. */
export function CasillaBloqueada({ cuenta, hasta, alAgregar }: { cuenta: Cuenta; hasta: string; alAgregar: (cuenta: Cuenta) => void }) {
    const restante = useRestante(hasta);

    return (
        <li className="min-w-0">
            <button
                type="button"
                data-libre
                onClick={() => alAgregar(cuenta)}
                aria-label={`Espacio con invitaciones inválidas por Google en ${cuenta.email}${restante > 0 ? `, se libera en ${cuentaRegresiva(restante)}` : ''}. Agregar cliente de todos modos`}
                title="Google no deja invitar por ahora. Puedes apartar el espacio para un cliente e invitarlo cuando se libere."
                className={cn(
                    'group/libre flex h-full min-h-14 w-full flex-col items-center justify-center gap-1 rounded-campo border border-dashed border-peligro/45 bg-peligro/8 px-3 py-2 text-center text-peligro',
                    'transition-[background-color,border-color] duration-150 hover:border-peligro/80 hover:bg-peligro/14 @min-[36rem]:min-h-18',
                )}
            >
                <span className="flex items-center gap-1.5 text-[12px] leading-tight font-semibold">
                    <Ban className="size-3.5 shrink-0" aria-hidden="true" />
                    Invitaciones inválidas por Google
                </span>
                <span className="text-[11px] leading-tight text-suave">
                    {restante > 0 ? (
                        <>
                            se libera en <span className="cifras font-semibold text-texto">{cuentaRegresiva(restante)}</span>
                        </>
                    ) : (
                        'ya debería estar libre'
                    )}
                </span>
                <span className="flex items-center gap-1 text-[11px] leading-tight text-tenue opacity-0 transition-opacity group-hover/libre:opacity-100 group-focus-visible/libre:opacity-100 pointer-coarse:hidden">
                    <Plus className="size-3" aria-hidden="true" />
                    Agregar de todos modos
                </span>
            </button>
        </li>
    );
}
