import { router } from '@inertiajs/react';
import { CircleCheck, Link2, LogIn, MonitorPlay, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { Cuenta } from '@/types';

/** «hace 5 min», «hoy 14:32» o «16 nov 14:32». */
function cuando(iso: string): string {
    const fecha = new Date(iso);
    const minutos = Math.round((Date.now() - fecha.getTime()) / 60000);
    if (minutos < 1) return 'hace un momento';
    if (minutos < 60) return `hace ${minutos} min`;
    const hora = fecha.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
    });

    return new Date().toDateString() === fecha.toDateString() ? `hoy ${hora}` : `${fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} ${hora}`;
}

/**
 * Revisión (solo lectura) del grupo familiar en Google para las cuentas cuya sesión está abierta en el servidor:
 * botón para revisar, cuándo fue la última vez y quién está en Google sin estar dado de alta aquí.
 */
export function GoogleCuenta({ cuenta }: { cuenta: Cuenta }) {
    const [revisando, setRevisando] = useState(false);
    // Sin sesión de Google en el servidor todavía: se conecta una vez por el visor.
    if (!cuenta.google.conectada) {
        return (
            <div className="mt-2.5">
                <a
                    href={`/google/visor/${cuenta.id}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-borde-fuerte bg-superficie-2 px-2.5 text-xs font-medium text-texto transition-colors hover:border-acento/50 hover:text-acento"
                    title="Abre el Chrome de esta cuenta en el servidor para iniciar sesión en Google una vez. Después el sistema revisa, invita y saca solo."
                >
                    <LogIn className="size-3.5" aria-hidden="true" />
                    Conectar con Google (visor)
                </a>
            </div>
        );
    }

    const revisar = () => {
        setRevisando(true);
        router.post(
            `/cuentas/${cuenta.id}/google`,
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => setRevisando(false),
            },
        );
    };

    return (
        <div className="mt-2.5 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                <button
                    type="button"
                    onClick={revisar}
                    disabled={revisando}
                    className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-borde-fuerte bg-superficie-2 px-2.5 text-xs font-medium text-texto transition-colors hover:border-acento/50 hover:text-acento disabled:opacity-60"
                    title="Lee en Google quién está en el grupo familiar y quién tiene invitación pendiente. No cambia nada en Google."
                >
                    <RefreshCw className={cn('size-3.5', revisando && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
                    {revisando ? 'Revisando en Google…' : 'Revisar grupo en Google'}
                </button>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-exito" title="La sesión de Google de esta cuenta está guardada en el servidor: se revisa sola cada 30 minutos">
                    <CircleCheck className="size-3.5" aria-hidden="true" />
                    Conectada a Google
                </span>
                <span className="text-xs text-tenue">{cuenta.google.revisada ? `Revisado ${cuando(cuenta.google.revisada)}` : 'Aún no se ha revisado'}</span>
                {cuenta.google.ligas > 0 && (
                    <span
                        className="inline-flex h-6 items-center gap-1 rounded-[5px] border border-info/40 bg-info/10 px-2 text-[11px] font-medium whitespace-nowrap text-info"
                        title="Invitaciones de Google apartadas en tu correo de ligas: mándalas a clientes. No ocupan espacio aquí."
                    >
                        <Link2 className="size-3" aria-hidden="true" />
                        {cuenta.google.ligas === 1 ? '1 liga por mandar' : `${cuenta.google.ligas} ligas por mandar`}
                    </span>
                )}
                <a
                    href={`/google/visor/${cuenta.id}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 text-xs text-tenue underline-offset-2 transition-colors hover:text-acento hover:underline"
                    title="Abre el Chrome de esta cuenta en el servidor. Solo hace falta si Google cierra la sesión."
                >
                    <MonitorPlay className="size-3.5" aria-hidden="true" />
                    Abrir visor
                </a>
            </div>
            {cuenta.google.extra.length > 0 && (
                <div className="flex max-w-2xl items-start gap-1.5 rounded-[5px] border border-alerta/30 bg-alerta/8 px-2.5 py-1.5 text-xs text-alerta">
                    <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    <span>
                        En Google pero no en el sistema:{' '}
                        {cuenta.google.extra.map((x, i) => (
                            <span key={x.email}>
                                {i > 0 && ', '}
                                <span className="font-medium">{x.email}</span> ({x.tipo === 'miembro' ? 'en el grupo' : 'invitación pendiente'})
                            </span>
                        ))}
                    </span>
                </div>
            )}
        </div>
    );
}
