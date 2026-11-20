import { router } from '@inertiajs/react';
import { CircleCheck, Link2, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Boton } from '@/components/ui/Boton';
import { cn } from '@/lib/cn';
import type { Cuenta } from '@/types';

const CADA = 5000; // mientras se generan, la tarjeta se actualiza cada 5 s

/**
 * «Generar liga»: una a la vez. Google manda, desde el grupo familiar de la cuenta, una invitación a tu correo de ligas
 * (tal cual). Luego pegas la liga en «Editar cuenta», como siempre, y cuando se use generas la siguiente.
 * Necesita la sesión de Google de la cuenta en el servidor (se conecta una vez con el visor).
 */
export function GenerarLigas({ cuenta }: { cuenta: Cuenta }) {
    const [pidiendo, setPidiendo] = useState(false);
    const progreso = cuenta.google.generando_ligas;
    const generando = progreso?.estado === 'generando';

    // Mientras se generan, se vuelve a pedir la lista de cuentas para ver el avance.
    useEffect(() => {
        if (!generando) return;
        const id = window.setInterval(() => router.reload({ only: ['cuentas'] }), CADA);

        return () => window.clearInterval(id);
    }, [generando]);

    const generar = () =>
        router.post(`/cuentas/${cuenta.id}/ligas`, {}, { preserveScroll: true, preserveState: true, onStart: () => setPidiendo(true), onFinish: () => setPidiendo(false) });

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <Boton
                variante="secundario"
                tamano="sm"
                icono={generando ? <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Link2 className="size-3.5" aria-hidden="true" />}
                onClick={generar}
                disabled={!cuenta.google.conectada || generando || pidiendo}
                cargando={pidiendo}
                title={
                    cuenta.google.conectada
                        ? 'Google te manda UNA invitación a tu correo de ligas; la pegas en «Editar cuenta» y, cuando se use, generas la siguiente.'
                        : 'Primero conecta la cuenta con Google (visor): inicia sesión una vez.'
                }
            >
                {generando ? 'Mandando liga…' : 'Generar liga'}
            </Boton>

            {!cuenta.google.conectada && !progreso && <span className="text-xs text-tenue">Conéctala con el visor para generar la liga</span>}

            {progreso && (
                <span
                    role="status"
                    className={cn(
                        'inline-flex min-w-0 items-center gap-1.5 text-xs',
                        progreso.estado === 'error' ? 'text-peligro' : progreso.estado === 'listo' ? 'text-exito' : 'text-suave',
                    )}
                >
                    {progreso.estado === 'listo' && <CircleCheck className="size-3.5 shrink-0" aria-hidden="true" />}
                    {progreso.estado === 'error' && <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />}
                    <span className="min-w-0">
                        {progreso.estado === 'generando' ? 'Mandando la liga a tu correo de ligas…' : progreso.mensaje}
                    </span>
                </span>
            )}
        </div>
    );
}
