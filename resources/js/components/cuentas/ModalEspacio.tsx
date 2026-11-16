import { useForm } from '@inertiajs/react';
import { UserMinus } from 'lucide-react';
import type { FormEvent } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { CasillaGoogle } from '@/components/ui/CasillaGoogle';
import { CasillaPendiente } from '@/components/ui/CasillaPendiente';
import { Modal } from '@/components/ui/Modal';
import { Selector, type OpcionSelector } from '@/components/ui/Selector';
import { SelectorPrecio } from '@/components/ui/SelectorPrecio';
import { pesos, plural } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { Compartido, Cuenta, Espacio, Vendedor } from '@/types';
import { guardarUltimoVendedor, leerUltimoVendedor } from './utilidades';

export interface ModalEspacioProps {
    cuenta: Cuenta;
    /** El espacio a editar, o null para agregar un cliente al primer espacio libre de la cuenta. */
    espacio: Espacio | null;
    /** Vendedores activos (props.vendedores). */
    vendedores: Vendedor[];
    alCerrar: () => void;
    /** Se llama cuando el servidor guardó (antes de cerrar): sirve para devolver el foco a la cuenta. */
    alGuardar?: (cuenta: Cuenta, eraNuevo: boolean) => void;
    /** Al editar: botón «Liberar espacio» dentro del modal. */
    alLiberar?: (cuenta: Cuenta, espacio: Espacio) => void;
}

/**
 * Agregar o editar al cliente de un espacio. Se monta solo mientras está abierto. Pensado para capturar rápido:
 * el foco cae en el Gmail, el vendedor es el último que se usó en este navegador, la fecha es hoy y Enter guarda.
 */
export function ModalEspacio({ cuenta, espacio, vendedores, alCerrar, alGuardar, alLiberar }: ModalEspacioProps) {
    const { negocio } = usePagina();
    const editando = espacio !== null;

    // Llegó solo desde Google: precio y vendedor se completan después (no son obligatorios).
    const deGoogle = espacio?.origen === 'google';
    const sinPrecio = deGoogle && espacio?.price_cents === 0 && espacio?.seller_id === null;
    const form = useForm(() => {
        const recordado = leerUltimoVendedor();

        return {
            client_email: espacio?.client_email ?? '',
            client_phone: espacio?.client_phone ?? '',
            price: espacio ? (sinPrecio ? '' : pesos(espacio.price_cents) || '0') : '',
            seller_id: espacio
                ? espacio.seller_id
                    ? String(espacio.seller_id)
                    : ''
                : vendedores.some((vendedor) => String(vendedor.id) === recordado)
                  ? recordado
                  : vendedores.length === 1
                    ? String(vendedores[0].id)
                    : '',
            sold_on: espacio?.sold_on ?? negocio.hoy,
            pendiente: espacio ? !espacio.paid_on : false,
            // Si la cuenta tiene ligas por mandar, al cliente se le manda la liga: no se invita su correo.
            invitar_google: !espacio && cuenta.google.conectada && cuenta.google.ligas === 0,
        };
    });

    const opciones: OpcionSelector[] = vendedores.map((vendedor) => ({
        valor: vendedor.id,
        etiqueta: vendedor.name,
    }));
    // Si el vendedor original ya no está activo, se muestra igual: el servidor pedirá elegir uno activo al guardar.
    if (espacio && espacio.seller_id !== null && !vendedores.some((vendedor) => vendedor.id === espacio.seller_id)) {
        opciones.push({
            valor: espacio.seller_id,
            etiqueta: `${espacio.seller_name ?? 'Vendedor'} (inactivo)`,
        });
    }

    const enviar = (evento: FormEvent) => {
        evento.preventDefault();

        form.transform((datos) => ({
            ...datos,
            client_email: datos.client_email.trim(),
            client_phone: datos.client_phone.trim(),
        }));

        const opcionesEnvio = {
            preserveScroll: true,
            preserveState: true,
            onSuccess: (pagina: { props: unknown }) => {
                // «La cuenta ya tiene sus 5 espacios ocupados» y similares llegan como aviso: lo capturado no se pierde.
                if ((pagina.props as Compartido).flash?.error) return;

                guardarUltimoVendedor(form.data.seller_id);
                alGuardar?.(cuenta, !editando);
                alCerrar();
            },
        };

        if (espacio) form.put(`/espacios/${espacio.id}`, opcionesEnvio);
        else form.post(`/cuentas/${cuenta.id}/espacios`, opcionesEnvio);
    };

    return (
        <Modal
            abierto
            alCerrar={alCerrar}
            titulo={editando ? 'Editar cliente' : 'Agregar cliente'}
            descripcion={
                <>
                    <span className="break-all text-texto">{cuenta.email}</span>
                    {editando ? ` · espacio ${espacio.position}` : ` · ${cuenta.libres === 1 ? 'queda 1 espacio libre' : `quedan ${plural(cuenta.libres, 'espacio')} libres`}`}
                </>
            }
            alEnviar={enviar}
            bloqueado={form.processing}
            pie={
                <>
                    {editando && alLiberar && (
                        <Boton
                            variante="fantasma"
                            className="text-peligro! hover:bg-peligro/12! sm:mr-auto"
                            icono={<UserMinus className="size-4" aria-hidden="true" />}
                            disabled={form.processing}
                            onClick={() => alLiberar(cuenta, espacio)}
                        >
                            Liberar espacio
                        </Boton>
                    )}
                    <Boton variante="fantasma" onClick={alCerrar} disabled={form.processing}>
                        Cancelar
                    </Boton>
                    <Boton type="submit" variante="primario" cargando={form.processing}>
                        {editando ? 'Guardar cambios' : 'Agregar cliente'}
                    </Boton>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-5">
                <Campo
                    etiqueta="Gmail del cliente"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="cliente@gmail.com"
                    maxLength={255}
                    value={form.data.client_email}
                    onChange={(evento) => form.setData('client_email', evento.target.value)}
                    error={form.errors.client_email}
                    claseContenedor="sm:col-span-3"
                />

                <Campo
                    etiqueta="Teléfono"
                    opcional
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="614 123 4567"
                    maxLength={30}
                    className="cifras"
                    value={form.data.client_phone}
                    onChange={(evento) => form.setData('client_phone', evento.target.value)}
                    error={form.errors.client_phone}
                    claseContenedor="sm:col-span-2"
                />

                <SelectorPrecio valor={form.data.price} alCambiar={(valor) => form.setData('price', valor)} precios={negocio.precios} error={form.errors.price} className="sm:col-span-5" />

                <Selector
                    etiqueta="Vendedor"
                    value={form.data.seller_id}
                    onChange={(evento) => form.setData('seller_id', evento.target.value)}
                    opciones={opciones}
                    marcador="Elige un vendedor…"
                    error={form.errors.seller_id}
                    ayuda={editando ? undefined : 'Se recuerda el último que usaste.'}
                    claseContenedor="sm:col-span-3"
                />

                {/* La fecha va al final: casi siempre es hoy y así no estorba al tabular. */}
                <Campo
                    etiqueta="Fecha de venta"
                    type="date"
                    max={negocio.hoy}
                    value={form.data.sold_on}
                    onChange={(evento) => form.setData('sold_on', evento.target.value)}
                    error={form.errors.sold_on}
                    claseContenedor="sm:col-span-2"
                />

                <CasillaPendiente marcada={form.data.pendiente} alCambiar={(valor) => form.setData('pendiente', valor)} className="sm:col-span-5" />
                {!editando && cuenta.google.conectada && (
                    <CasillaGoogle
                        marcada={form.data.invitar_google}
                        alCambiar={(valor) => form.setData('invitar_google', valor)}
                        ayuda={
                            cuenta.google.ligas > 0
                                ? `Esta cuenta tiene ${cuenta.google.ligas === 1 ? '1 liga' : `${cuenta.google.ligas} ligas`} por mandar: mándale una al cliente. Marca esto solo si prefieres que Google lo invite a su correo.`
                                : undefined
                        }
                        className="sm:col-span-5"
                    />
                )}
                {deGoogle && (
                    <p className="text-[13px] text-suave sm:col-span-5">Llegó desde el grupo de Google: precio y vendedor son opcionales. Ponlos cuando pague para que cuente en las ventas.</p>
                )}
            </div>
        </Modal>
    );
}
