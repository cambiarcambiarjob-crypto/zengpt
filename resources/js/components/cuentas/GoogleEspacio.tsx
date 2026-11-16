import { router } from '@inertiajs/react';
import { UserPlus, UserX } from 'lucide-react';
import { useState } from 'react';
import { Confirmar } from '@/components/ui/Confirmar';
import type { Cuenta, Espacio } from '@/types';

const BOTON = 'inline-flex h-6 items-center gap-1 rounded-[5px] border px-2 text-[11px] font-medium whitespace-nowrap transition-colors disabled:opacity-60';

/**
 * Invitar al cliente al grupo de Google o sacarlo (o cancelar su invitación), con la sesión de la cuenta en el
 * servidor. Sacar siempre pide confirmación; el cliente sigue en el sistema.
 */
export function GoogleEspacio({ cuenta, espacio }: { cuenta: Cuenta; espacio: Espacio }) {
    const [confirmando, setConfirmando] = useState(false);
    const [trabajando, setTrabajando] = useState(false);
    if (!cuenta.google.conectada) return null;

    const dentro = espacio.google_status === 'miembro' || espacio.google_status === 'invitado';
    const opciones = { preserveScroll: true, preserveState: true, onStart: () => setTrabajando(true), onFinish: () => { setTrabajando(false); setConfirmando(false); } };

    return (
        <>
            {dentro ? (
                <button type="button" disabled={trabajando} onClick={() => setConfirmando(true)} className={`${BOTON} border-borde-fuerte text-suave hover:border-peligro/50 hover:text-peligro`} title="Sacarlo del grupo familiar de Google">
                    <UserX className="size-3" aria-hidden="true" />
                    Sacar de Google
                </button>
            ) : (
                <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => router.post(`/espacios/${espacio.id}/google`, {}, opciones)}
                    className={`${BOTON} border-info/40 bg-info/10 text-info hover:bg-info/20`}
                    title="Google le manda la invitación al grupo familiar desde esta cuenta"
                >
                    <UserPlus className="size-3" aria-hidden="true" />
                    {trabajando ? 'Invitando…' : 'Invitar en Google'}
                </button>
            )}
            <Confirmar
                abierto={confirmando}
                titulo={espacio.google_status === 'invitado' ? '¿Cancelar su invitación en Google?' : '¿Sacarlo del grupo de Google?'}
                textoConfirmar={espacio.google_status === 'invitado' ? 'Cancelar invitación' : 'Sacar del grupo'}
                cargando={trabajando}
                alCancelar={() => setConfirmando(false)}
                alConfirmar={() => router.delete(`/espacios/${espacio.id}/google`, opciones)}
            >
                {espacio.client_email} deja de tener Google One en {cuenta.email}. Sigue en el sistema: si quieres liberar su espacio, hazlo aparte. Ojo: Google solo deja a una persona
                cambiar de grupo familiar una vez cada 12 meses.
            </Confirmar>
        </>
    );
}
