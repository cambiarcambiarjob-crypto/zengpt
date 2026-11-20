import { router } from '@inertiajs/react';
import { Ban, UserPlus, UserX } from 'lucide-react';
import { useState } from 'react';
import { Confirmar } from '@/components/ui/Confirmar';
import { cn } from '@/lib/cn';
import type { Cuenta, Espacio } from '@/types';

const ETIQUETA = 'inline-flex h-6 items-center rounded-[5px] border px-2 text-[11px] font-medium whitespace-nowrap';
const BOTON = 'inline-flex h-6 items-center gap-1 rounded-[5px] border px-2 text-[11px] font-medium whitespace-nowrap transition-colors disabled:opacity-60';

const ESTADO = {
    miembro: { texto: 'En el grupo', clase: 'border-exito/30 bg-exito/10 text-exito' },
    invitado: { texto: 'Invitación enviada', clase: 'border-alerta/35 bg-alerta/10 text-alerta' },
    fuera: { texto: 'Sin invitar', clase: 'border-borde-fuerte bg-superficie-3 text-suave' },
} as const;

/**
 * Invitación al grupo familiar en cuentas con su sesión de Google abierta en el servidor: el estado según Google
 * y el botón para invitarlo o sacarlo. Sacar pide confirmación, quita al cliente de Google y libera su espacio.
 */
export function GoogleEspacio({ cuenta, espacio, soloSacar = false }: { cuenta: Cuenta; espacio: Espacio; soloSacar?: boolean }) {
    const [confirmando, setConfirmando] = useState(false);
    const [trabajando, setTrabajando] = useState(false);

    const dentro = espacio.google_status === 'miembro' || espacio.google_status === 'invitado';
    const estado = ESTADO[espacio.google_status === 'miembro' ? 'miembro' : espacio.google_status === 'invitado' ? 'invitado' : 'fuera'];
    const opciones = { preserveScroll: true, preserveState: true, onStart: () => setTrabajando(true), onFinish: () => { setTrabajando(false); setConfirmando(false); } };

    // Clientes con liga: el estado lo da su liga; aquí solo «Sacar» cuando ya está en el grupo (o invitado) en Google.
    if (soloSacar && !dentro) return null;

    // Sin invitar y con el bloqueo de Google: no se puede invitar todavía (en vez de «Sin invitar» + «Invitar»).
    if (!soloSacar && !dentro && cuenta.google.bloqueo_hasta) {
        return (
            <span className={cn(ETIQUETA, 'gap-1 border-peligro/40 bg-peligro/10 text-peligro')} title="Invitación inválida por Google: no deja invitar a nadie más a esta cuenta por ahora (límite de invitaciones). Invítalo cuando se libere.">
                <Ban className="size-3" aria-hidden="true" />
                Inválida por Google
            </span>
        );
    }

    return (
        <>
            {!soloSacar && (
                <span className={cn(ETIQUETA, estado.clase)} title="Según la última revisión del grupo en Google">
                    {estado.texto}
                </span>
            )}
            {dentro ? (
                <button type="button" disabled={trabajando} onClick={() => setConfirmando(true)} className={`${BOTON} border-borde-fuerte text-suave hover:border-peligro/50 hover:text-peligro`} title="Lo saca del grupo de Google y libera su espacio">
                    <UserX className="size-3" aria-hidden="true" />
                    Sacar
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
                titulo={`¿Sacar a ${espacio.client_email}?`}
                textoConfirmar="Sacar y liberar espacio"
                cargando={trabajando}
                alCancelar={() => setConfirmando(false)}
                alConfirmar={() => router.delete(`/espacios/${espacio.id}/google`, opciones)}
            >
                {espacio.google_status === 'invitado' ? 'Se cancela su invitación en Google' : `Sale del grupo de Google de ${cuenta.email}`} y se libera su espacio en el sistema (su venta deja de contar).
                Ojo: Google solo deja a una persona cambiar de grupo familiar una vez cada 12 meses.
            </Confirmar>
        </>
    );
}
