import { router } from '@inertiajs/react';
import { Check, Copy, ExternalLink, Link2, Mail, MessageCircle, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { avisar } from '@/components/ui/Avisos';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { fechaCorta, sumarDias } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { Espacio } from '@/types';
import { copiarTexto } from './utilidades';

/** Días que dura una liga de invitación de Google (se puede cambiar al guardarla). */
const DIAS_LIGA = 7;

const ESTADOS: Record<Espacio['invite_status'], { texto: string; clase: string }> = {
    sin_liga: { texto: 'Sin invitar', clase: 'border-borde-fuerte bg-superficie-3 text-suave' },
    lista: { texto: 'Liga lista', clase: 'border-info/35 bg-info/10 text-info' },
    enviada: { texto: 'Invitación enviada', clase: 'border-alerta/35 bg-alerta/10 text-alerta' },
    aceptada: { texto: 'En el grupo', clase: 'border-exito/30 bg-exito/10 text-exito' },
    caducada: { texto: 'Liga caducada', clase: 'border-peligro/35 bg-peligro/10 text-peligro' },
};

/** Mensaje para el cliente con su liga personal al grupo familiar. */
function mensaje(espacio: Espacio): string {
    const vence = espacio.invite_expires_on ? ` La liga vence el ${fechaCorta(espacio.invite_expires_on)}.` : '';

    return `¡Hola! Ya está listo tu Google One Pro por 12 meses 🎉\n\nAcepta tu invitación aquí: ${espacio.invite_url}\n\nEntra con tu cuenta ${espacio.client_email} y acepta unirte al grupo familiar.${vence}`;
}

/** wa.me con el número en formato internacional (a 10 dígitos de México se les antepone 52). */
function ligaWhatsApp(telefono: string, texto: string): string {
    let digitos = telefono.replace(/\D/g, '');
    if (digitos.length === 10) digitos = `52${digitos}`;

    return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

/** Insignia del estado de la invitación + botón que abre el diálogo para guardarla, enviarla y marcarla. */
export function InvitacionEspacio({ espacio }: { espacio: Espacio }) {
    const [abierto, setAbierto] = useState(false);
    const estado = ESTADOS[espacio.invite_status];

    return (
        <>
            <button
                type="button"
                onClick={() => setAbierto(true)}
                className={cn('inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium whitespace-nowrap transition-opacity hover:opacity-80', estado.clase)}
                title="Invitación al grupo familiar"
            >
                <Link2 className="size-3" aria-hidden="true" />
                {estado.texto}
            </button>
            {abierto && <DialogoInvitacion espacio={espacio} alCerrar={() => setAbierto(false)} />}
        </>
    );
}

function DialogoInvitacion({ espacio, alCerrar }: { espacio: Espacio; alCerrar: () => void }) {
    const { negocio } = usePagina();
    const [liga, setLiga] = useState(espacio.invite_url ?? '');
    const [vence, setVence] = useState(espacio.invite_expires_on ?? sumarDias(negocio.hoy, DIAS_LIGA));
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [enviando, setEnviando] = useState(false);

    const guardada = espacio.invite_url !== null && liga.trim() === espacio.invite_url;

    const mandar = (datos: Record<string, string | null>, alTerminar?: () => void) => {
        setEnviando(true);
        router.put(`/espacios/${espacio.id}/invitacion`, datos, {
            preserveScroll: true,
            preserveState: true,
            onError: (e) => setErrores(e),
            onSuccess: () => {
                setErrores({});
                alTerminar?.();
            },
            onFinish: () => setEnviando(false),
        });
    };

    const guardar = (evento?: { preventDefault: () => void }) => {
        evento?.preventDefault();
        mandar({ invite_url: liga.trim() || null, invite_expires_on: liga.trim() ? vence : null });
    };

    const copiar = async () => {
        if (await copiarTexto(mensaje(espacio))) {
            avisar.exito('Mensaje copiado: pégalo en el chat del cliente.');
            if (espacio.invite_status === 'lista') mandar({ accion: 'enviada' });
        }
    };

    return (
        <Modal
            abierto
            alCerrar={alCerrar}
            titulo="Invitación al grupo familiar"
            descripcion={espacio.client_email}
            alEnviar={guardar}
            pie={
                <>
                    <Boton variante="fantasma" onClick={alCerrar}>
                        Cerrar
                    </Boton>
                    <Boton type="submit" cargando={enviando} disabled={guardada && vence === espacio.invite_expires_on}>
                        Guardar liga
                    </Boton>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <Campo
                    etiqueta="Liga de invitación de este cliente"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="https://families.google.com/join/…"
                    maxLength={500}
                    value={liga}
                    onChange={(e) => setLiga(e.target.value)}
                    error={errores.invite_url}
                    ayuda="Una liga por cliente: al abrirla entra directo al grupo familiar. Guardar una liga nueva reinicia el estado."
                />
                <Campo etiqueta="La liga caduca el" type="date" value={vence} min={negocio.hoy} onChange={(e) => setVence(e.target.value)} error={errores.invite_expires_on} />

                {guardada && (
                    <div className="flex flex-col gap-3 rounded-campo border border-borde bg-superficie-2/60 p-3">
                        <p className="text-[13px] text-suave">
                            Estado: <span className="font-medium text-texto">{ESTADOS[espacio.invite_status].texto}</span>
                        </p>
                        <button
                            type="button"
                            disabled={enviando || espacio.invite_status === 'caducada'}
                            onClick={() => {
                                setEnviando(true);
                                router.post(`/espacios/${espacio.id}/invitacion/correo`, {}, { preserveScroll: true, preserveState: true, onFinish: () => setEnviando(false) });
                            }}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-campo bg-gradient-to-br from-[#22c55e] to-[#15803d] px-4 text-[15px] font-semibold text-white shadow-[0_6px_20px_-6px_rgba(34,197,94,0.6)] transition-[opacity,transform] hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
                        >
                            <Mail className="size-4" aria-hidden="true" />
                            {espacio.invite_status === 'enviada' ? 'Reenviar invitación por correo' : 'Enviar invitación por correo'}
                        </button>
                        <p className="-mt-1 text-xs text-tenue">Le llega a {espacio.client_email} con el botón verde «Adquiere Google One Pro por 12 meses» y los beneficios.</p>
                        <div className="flex flex-wrap gap-2">
                            {espacio.client_phone && (
                                <a
                                    href={ligaWhatsApp(espacio.client_phone, mensaje(espacio))}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => espacio.invite_status === 'lista' && mandar({ accion: 'enviada' })}
                                    className="inline-flex h-9 items-center gap-2 rounded-campo bg-[#25d366] px-3 text-sm font-semibold text-[#062b14] transition-opacity hover:opacity-90"
                                >
                                    <MessageCircle className="size-4" aria-hidden="true" />
                                    Enviar por WhatsApp
                                </a>
                            )}
                            <Boton variante="secundario" tamano="sm" icono={<Copy className="size-4" />} onClick={copiar}>
                                Copiar mensaje
                            </Boton>
                            <a href={espacio.invite_url ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 px-2 text-sm text-acento hover:underline">
                                <ExternalLink className="size-4" aria-hidden="true" />
                                Probar liga
                            </a>
                        </div>
                        <div className="flex flex-wrap gap-2 border-t border-borde pt-3">
                            {espacio.invite_status !== 'enviada' && espacio.invite_status !== 'aceptada' && (
                                <Boton variante="fantasma" tamano="sm" icono={<Send className="size-4" />} onClick={() => mandar({ accion: 'enviada' })}>
                                    Marcar enviada
                                </Boton>
                            )}
                            {espacio.invite_status !== 'aceptada' && (
                                <Boton variante="fantasma" tamano="sm" icono={<Check className="size-4" />} onClick={() => mandar({ accion: 'aceptada' }, alCerrar)}>
                                    Ya está en el grupo
                                </Boton>
                            )}
                            {(espacio.invite_status === 'enviada' || espacio.invite_status === 'aceptada') && (
                                <Boton variante="fantasma" tamano="sm" icono={<RotateCcw className="size-4" />} onClick={() => mandar({ accion: 'reiniciar' })}>
                                    Reiniciar estado
                                </Boton>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
