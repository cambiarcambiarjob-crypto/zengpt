import { useForm } from '@inertiajs/react';
import { CalendarClock } from 'lucide-react';
import type { FormEvent } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Modal } from '@/components/ui/Modal';
import { diasEnPalabras, diasEntre, fechaMedia, plural, sumarDias } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { Compartido, Cuenta } from '@/types';
import { esFechaIso, sumarMeses } from './utilidades';

/**
 * Activar una cuenta que estaba «por activar»: desde la fecha de inicio (hoy por omisión) le corren sus meses de
 * vigencia y ya cuenta como activa (aparece en «Activas», en «Con espacio» y acepta clientes).
 */
export function ModalActivar({ cuenta, alCerrar }: { cuenta: Cuenta; alCerrar: () => void }) {
    const { negocio } = usePagina();
    const form = useForm({ started_on: negocio.hoy });
    const vence = esFechaIso(form.data.started_on) ? sumarMeses(form.data.started_on, negocio.meses_cuenta) : null;

    const enviar = (evento: FormEvent) => {
        evento.preventDefault();
        form.put(`/cuentas/${cuenta.id}/activar`, {
            preserveScroll: true,
            onSuccess: (pagina) => {
                if (!(pagina.props as unknown as Compartido).flash?.error) alCerrar();
            },
        });
    };

    return (
        <Modal
            abierto
            alCerrar={alCerrar}
            titulo="Activar cuenta"
            descripcion={cuenta.email}
            alEnviar={enviar}
            bloqueado={form.processing}
            tamano="sm"
            pie={
                <>
                    <Boton variante="fantasma" onClick={alCerrar} disabled={form.processing}>
                        Cancelar
                    </Boton>
                    <Boton type="submit" variante="primario" cargando={form.processing}>
                        Activar
                    </Boton>
                </>
            }
        >
            <div className="flex flex-col gap-3">
                <Campo
                    etiqueta="Fecha de inicio"
                    type="date"
                    max={sumarDias(negocio.hoy, 1)}
                    value={form.data.started_on}
                    onChange={(evento) => form.setData('started_on', evento.target.value)}
                    error={form.errors.started_on}
                    ayuda={`Desde aquí le corren sus ${plural(negocio.meses_cuenta, 'mes', 'meses')} de vigencia.`}
                />
                <p className="flex min-h-10 items-center gap-2.5 rounded-campo border border-borde bg-superficie-2/60 px-3 py-2 text-[13px] leading-snug text-suave" aria-live="polite">
                    <CalendarClock className="size-4 shrink-0 text-acento" aria-hidden="true" />
                    {vence ? (
                        <span>
                            Vence el <strong className="font-semibold text-texto">{fechaMedia(vence)}</strong>
                            <span className="text-tenue"> · {diasEnPalabras(diasEntre(negocio.hoy, vence))}</span>
                        </span>
                    ) : (
                        <span>Elige la fecha de inicio.</span>
                    )}
                </p>
            </div>
        </Modal>
    );
}
