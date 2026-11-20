import { useForm } from '@inertiajs/react';
import { Ban, CalendarClock, TriangleAlert } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Campo, CampoArea } from '@/components/ui/Campo';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { diasEnPalabras, diasEntre, fechaMedia, plural, sumarDias } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import { cuentaRegresiva, diaDelNegocio, useRestante } from '@/lib/reloj';
import type { Compartido, Cuenta } from '@/types';
import { esFechaIso, sumarMeses } from './utilidades';

export interface ModalCuentaProps {
    /** La cuenta a editar, o null para crear una nueva. */
    cuenta: Cuenta | null;
    alCerrar: () => void;
}

const MAX_NOTAS = 500;

/**
 * Crear o editar una cuenta. Se monta solo mientras está abierto (el formulario nace con los datos correctos).
 * La vigencia la calcula el servidor (inicio + meses de la cuenta); aquí se muestra el resultado antes de guardar.
 * Solo el administrador, al editar, puede fijar otra fecha de vencimiento.
 */
export function ModalCuenta({ cuenta, alCerrar }: ModalCuentaProps) {
    const { negocio, auth } = usePagina();
    const esAdmin = auth.user?.is_admin === true;
    const editando = cuenta !== null;
    const puedeFijar = editando && esAdmin;
    const idFijar = useId();
    const idBloqueo = useId();
    const bloqueoActual = cuenta?.google.bloqueo_hasta ?? null;
    const restanteBloqueo = useRestante(bloqueoActual);

    // Una cuenta «con vencimiento fijado» es la que no vence en inicio + meses (alguien lo cambió a mano).
    const fijadaDeOrigen = cuenta !== null && cuenta.expires_on !== sumarMeses(cuenta.started_on, negocio.meses_cuenta);
    const [fijar, setFijar] = useState(puedeFijar && fijadaDeOrigen);

    const form = useForm({
        email: cuenta?.email ?? '',
        password: cuenta?.password ?? '',
        twofa_url: cuenta?.twofa_url ?? '',
        started_on: cuenta?.started_on ?? negocio.hoy,
        expires_on: puedeFijar && fijadaDeOrigen ? cuenta.expires_on : '',
        notes: cuenta?.notes ?? '',
        // Bloqueo de invitaciones de Google: el día en que se liberan (desde las 0:00 de ese día).
        bloqueo: bloqueoActual !== null,
        google_bloqueo_hasta: bloqueoActual ? diaDelNegocio(bloqueoActual) : sumarDias(negocio.hoy, 7),
        invite_links: Array.from({ length: negocio.capacidad }, (_, i) => {
            const liga = cuenta?.invite_links.find((l) => l.position === i + 1);
            return { url: liga?.url ?? '', expires_on: liga?.expires_on ?? sumarDias(negocio.hoy, 7) };
        }),
    });

    const inicioValido = esFechaIso(form.data.started_on);
    const calculado = inicioValido ? sumarMeses(form.data.started_on, negocio.meses_cuenta) : null;
    const venceEl = fijar && esFechaIso(form.data.expires_on) ? form.data.expires_on : calculado;
    const diasVigencia = venceEl ? diasEntre(negocio.hoy, venceEl) : null;
    // Al guardar sin fijar, el servidor recalcula la vigencia: si la cuenta tenía otra fecha, se avisa antes.
    const cambiaVencimiento = editando && !fijar && calculado !== null && calculado !== cuenta.expires_on;

    const enviar = (evento: FormEvent) => {
        evento.preventDefault();

        form.transform((datos) => ({
            email: datos.email.trim(),
            password: datos.password,
            twofa_url: datos.twofa_url.trim(),
            started_on: datos.started_on,
            notes: datos.notes.trim(),
            invite_links: Object.fromEntries(datos.invite_links.map((l, i) => [String(i + 1), { url: l.url.trim(), expires_on: l.expires_on }])),
            ...(puedeFijar ? { expires_on: fijar ? datos.expires_on : '' } : {}),
            ...(editando ? { google_bloqueo_hasta: datos.bloqueo ? datos.google_bloqueo_hasta : '' } : {}),
        }));

        const opciones = {
            preserveScroll: true,
            preserveState: true,
            onSuccess: (pagina: { props: unknown }) => {
                // Si el servidor contestó con un aviso de error (flash), el formulario se queda abierto.
                if (!(pagina.props as Compartido).flash?.error) alCerrar();
            },
        };

        if (cuenta) form.put(`/cuentas/${cuenta.id}`, opciones);
        else form.post('/cuentas', opciones);
    };

    return (
        <Modal
            abierto
            alCerrar={alCerrar}
            titulo={editando ? 'Editar cuenta' : 'Nueva cuenta'}
            descripcion={editando ? cuenta.email : `Un Gmail con ${plural(negocio.capacidad, 'espacio')} y ${plural(negocio.meses_cuenta, 'mes', 'meses')} de vigencia.`}
            alEnviar={enviar}
            bloqueado={form.processing}
            pie={
                <>
                    <Boton variante="fantasma" onClick={alCerrar} disabled={form.processing}>
                        Cancelar
                    </Boton>
                    <Boton type="submit" variante="primario" cargando={form.processing}>
                        {editando ? 'Guardar cambios' : 'Agregar cuenta'}
                    </Boton>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <Campo
                    etiqueta="Gmail de la cuenta"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="cuenta@gmail.com"
                    maxLength={255}
                    value={form.data.email}
                    onChange={(evento) => form.setData('email', evento.target.value)}
                    error={form.errors.email}
                />

                <Campo
                    etiqueta="Contraseña de la cuenta"
                    opcional
                    type="text"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={255}
                    value={form.data.password}
                    onChange={(evento) => form.setData('password', evento.target.value)}
                    error={form.errors.password}
                />

                <Campo
                    etiqueta="Liga de 2FA (código de verificación)"
                    opcional
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="https://…"
                    maxLength={500}
                    value={form.data.twofa_url}
                    onChange={(evento) => form.setData('twofa_url', evento.target.value)}
                    error={form.errors.twofa_url}
                />

                <div className="flex flex-col gap-2">
                    <Campo
                        etiqueta="Fecha de inicio"
                        type="date"
                        max={negocio.hoy}
                        value={form.data.started_on}
                        onChange={(evento) => form.setData('started_on', evento.target.value)}
                        error={form.errors.started_on}
                    />

                    {/* Altura fija: el texto cambia al mover la fecha, la ventana no «brinca». */}
                    <p className="flex min-h-10 items-center gap-2.5 rounded-campo border border-borde bg-superficie-2/60 px-3 py-2 text-[13px] leading-snug text-suave" aria-live="polite">
                        <CalendarClock className="size-4 shrink-0 text-acento" aria-hidden="true" />
                        {venceEl && diasVigencia !== null ? (
                            <span>
                                {diasVigencia < 0 ? 'Venció el ' : 'Vence el '}
                                <strong className="font-semibold text-texto">{fechaMedia(venceEl)}</strong>
                                <span className={cn(diasVigencia < 0 ? 'text-peligro' : 'text-tenue')}> · {diasEnPalabras(diasVigencia)}</span>
                            </span>
                        ) : (
                            <span>Elige la fecha de inicio para calcular el vencimiento.</span>
                        )}
                    </p>

                    {cambiaVencimiento && (
                        <p className="flex items-start gap-2 text-[13px] leading-snug text-alerta">
                            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                            <span>
                                Hoy vence el {fechaMedia(cuenta.expires_on)}. Al guardar se recalcula desde la fecha de inicio
                                {esAdmin ? '; si quieres conservarla, fija el vencimiento.' : '.'}
                            </span>
                        </p>
                    )}
                </div>

                {puedeFijar && (
                    <div className="flex flex-col gap-3 rounded-campo border border-borde p-3">
                        <div className="flex items-start gap-2.5">
                            <input
                                id={idFijar}
                                type="checkbox"
                                aria-describedby={`${idFijar}-ayuda`}
                                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-acento"
                                checked={fijar}
                                onChange={(evento) => {
                                    setFijar(evento.target.checked);
                                    if (evento.target.checked && form.data.expires_on === '') form.setData('expires_on', cuenta.expires_on);
                                    if (!evento.target.checked) form.clearErrors('expires_on');
                                }}
                            />
                            <div className="min-w-0">
                                <label htmlFor={idFijar} className="cursor-pointer text-sm text-texto">
                                    Fijar otra fecha de vencimiento
                                </label>
                                <p id={`${idFijar}-ayuda`} className="text-[13px] leading-snug text-tenue">
                                    Solo el administrador. Si no, vence a los {plural(negocio.meses_cuenta, 'mes', 'meses')} del inicio.
                                </p>
                            </div>
                        </div>
                        {fijar && (
                            <Campo
                                etiqueta="Fecha de vencimiento"
                                type="date"
                                min={inicioValido ? form.data.started_on : undefined}
                                value={form.data.expires_on}
                                onChange={(evento) => form.setData('expires_on', evento.target.value)}
                                error={form.errors.expires_on}
                            />
                        )}
                    </div>
                )}

                {editando && (
                    <div className={cn('flex flex-col gap-3 rounded-campo border p-3 transition-colors', form.data.bloqueo ? 'border-peligro/40 bg-peligro/6' : 'border-borde')}>
                        <div className="flex items-start gap-2.5">
                            <input
                                id={idBloqueo}
                                type="checkbox"
                                aria-describedby={`${idBloqueo}-ayuda`}
                                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-peligro"
                                checked={form.data.bloqueo}
                                onChange={(evento) => {
                                    form.setData('bloqueo', evento.target.checked);
                                    if (!evento.target.checked) form.clearErrors('google_bloqueo_hasta');
                                }}
                            />
                            <div className="min-w-0">
                                <label htmlFor={idBloqueo} className="flex cursor-pointer items-center gap-1.5 text-sm text-texto">
                                    <Ban className={cn('size-3.5', form.data.bloqueo ? 'text-peligro' : 'text-tenue')} aria-hidden="true" />
                                    Invitaciones bloqueadas por Google
                                </label>
                                <p id={`${idBloqueo}-ayuda`} className="text-[13px] leading-snug text-tenue">
                                    Cuando Google dice «Has alcanzado el límite de invitaciones al grupo familiar». Sus espacios libres salen en rojo con la cuenta regresiva y no se ofrecen para vender.
                                    {bloqueoActual && restanteBloqueo > 0 && <span className="text-peligro"> Ahora: se liberan en {cuentaRegresiva(restanteBloqueo)}.</span>}
                                </p>
                            </div>
                        </div>
                        {form.data.bloqueo && (
                            <Campo
                                etiqueta="Se liberan el"
                                type="date"
                                min={sumarDias(negocio.hoy, 1)}
                                value={form.data.google_bloqueo_hasta}
                                onChange={(evento) => form.setData('google_bloqueo_hasta', evento.target.value)}
                                error={form.errors.google_bloqueo_hasta}
                            />
                        )}
                    </div>
                )}

                <fieldset className="flex flex-col gap-2">
                    <legend className="text-sm font-medium text-texto">
                        Ligas de invitación <span className="font-normal text-tenue">(opcional)</span>
                    </legend>
                    <p className="text-[13px] leading-snug text-tenue">Una por espacio. Cada cliente que agregues toma la liga de su espacio; si una caduca, pega aquí la nueva.</p>
                    {form.data.invite_links.map((liga, i) => {
                        const ocupado = cuenta?.espacios.find((e) => e.position === i + 1);
                        const errores = form.errors as Record<string, string | undefined>;
                        return (
                            <div key={i} className="grid grid-cols-[4.5rem_1fr] items-start gap-2 sm:grid-cols-[4.5rem_1fr_9.5rem]">
                                <span className="pt-2.5 text-[13px] text-suave">
                                    Espacio {i + 1}
                                    {ocupado && <span className="block truncate text-[11px] text-tenue" title={ocupado.client_email}>{ocupado.client_email}</span>}
                                </span>
                                <Campo
                                    etiqueta={`Liga del espacio ${i + 1}`}
                                    ocultarEtiqueta
                                    type="url"
                                    inputMode="url"
                                    autoComplete="off"
                                    spellCheck={false}
                                    placeholder="https://families.google.com/join/…"
                                    maxLength={500}
                                    value={liga.url}
                                    onChange={(evento) => form.setData('invite_links', form.data.invite_links.map((l, j) => (j === i ? { ...l, url: evento.target.value } : l)))}
                                    error={errores[`invite_links.${i + 1}.url`]}
                                />
                                <Campo
                                    etiqueta={`Caducidad de la liga del espacio ${i + 1}`}
                                    ocultarEtiqueta
                                    type="date"
                                    disabled={liga.url.trim() === ''}
                                    value={liga.expires_on}
                                    onChange={(evento) => form.setData('invite_links', form.data.invite_links.map((l, j) => (j === i ? { ...l, expires_on: evento.target.value } : l)))}
                                    error={errores[`invite_links.${i + 1}.expires_on`]}
                                    claseContenedor="col-start-2 sm:col-start-auto"
                                />
                            </div>
                        );
                    })}
                </fieldset>

                <CampoArea
                    etiqueta="Notas"
                    opcional
                    rows={3}
                    maxLength={MAX_NOTAS}
                    placeholder="Dónde se compró, quién la administra, cualquier detalle útil…"
                    value={form.data.notes}
                    onChange={(evento) => form.setData('notes', evento.target.value)}
                    error={form.errors.notes}
                    junto={
                        <span className="cifras text-xs text-tenue" aria-hidden="true">
                            {form.data.notes.length}/{MAX_NOTAS}
                        </span>
                    }
                />
            </div>
        </Modal>
    );
}
