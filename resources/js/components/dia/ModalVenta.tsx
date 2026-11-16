import { useForm } from '@inertiajs/react';
import { CalendarDays, CircleAlert } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { CasillaPendiente } from '@/components/ui/CasillaPendiente';
import { Modal } from '@/components/ui/Modal';
import { Selector } from '@/components/ui/Selector';
import { SelectorPrecio } from '@/components/ui/SelectorPrecio';
import { cn } from '@/lib/cn';
import { fechaLarga, plural } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { Compartido, Cuenta, Vendedor } from '@/types';
import { guardarUltimoVendedor, leerUltimoVendedor } from './utilidades';

export interface ModalVentaProps {
    /** Día con el que se registra la venta ('AAAA-MM-DD'): el que está en pantalla. */
    fecha: string;
    esHoy: boolean;
    /** Cuentas vigentes con espacio libre (props.conEspacio, siempre las más recientes). */
    cuentas: Cuenta[];
    /** Cuenta ya elegida al abrir (desde la lista) o null para elegirla en el formulario. */
    cuentaInicial: number | null;
    /** Vendedores activos (props.vendedores). */
    vendedores: Vendedor[];
    alCerrar: () => void;
}

/**
 * Agregar un cliente con la fecha del día en pantalla. Se monta solo mientras está abierto. Pensado para capturar
 * varias ventas seguidas al cerrar el día: recuerda el último vendedor y «Guardar y agregar otra» deja la ventana
 * abierta con la cuenta, el precio y el vendedor listos.
 */
export function ModalVenta({ fecha, esHoy, cuentas, cuentaInicial, vendedores, alCerrar }: ModalVentaProps) {
    const { negocio } = usePagina();
    const [cuentaId, setCuentaId] = useState(() => (cuentaInicial !== null ? String(cuentaInicial) : cuentas.length === 1 ? String(cuentas[0].id) : ''));
    const [errorCuenta, setErrorCuenta] = useState<string | null>(null);
    const [capturadas, setCapturadas] = useState(0);
    const selectorCuenta = useRef<HTMLSelectElement>(null);
    const campoCorreo = useRef<HTMLInputElement>(null);
    const seguir = useRef(false);

    const form = useForm(() => {
        const recordado = leerUltimoVendedor();

        return {
            client_email: '',
            client_phone: '',
            price: '',
            seller_id: vendedores.some((vendedor) => String(vendedor.id) === recordado) ? recordado : vendedores.length === 1 ? String(vendedores[0].id) : '',
            sold_on: fecha,
            pendiente: false,
        };
    });

    // Si la cuenta elegida se llenó (por esta captura o por otra persona) deja de estar en la lista: hay que elegir otra.
    const cuenta = cuentas.find((opcion) => String(opcion.id) === cuentaId) ?? null;

    const enviar = (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();

        // «Guardar y agregar otra» marca `seguir` antes de enviar; Enter y «Guardar venta» cierran al terminar.
        const otra = seguir.current;
        seguir.current = false;

        if (!cuenta) {
            setErrorCuenta('Elige la cuenta donde entra el cliente.');
            selectorCuenta.current?.focus();

            return;
        }

        form.transform((datos) => ({ ...datos, client_email: datos.client_email.trim(), client_phone: datos.client_phone.trim(), sold_on: fecha }));
        form.post(`/cuentas/${cuenta.id}/espacios`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: (pagina) => {
                // «La cuenta ya tiene sus 5 espacios ocupados» y similares llegan como aviso: lo capturado no se pierde.
                if ((pagina.props as unknown as Compartido).flash?.error) return;

                guardarUltimoVendedor(form.data.seller_id);

                if (!otra) {
                    alCerrar();

                    return;
                }

                // Otra venta: se limpian solo los datos del cliente; cuenta, precio y vendedor se quedan.
                setCapturadas((n) => n + 1);
                form.setData((datos) => ({ ...datos, client_email: '', client_phone: '', pendiente: false }));
                campoCorreo.current?.focus();
            },
        });
    };

    const sinCuentas = cuentas.length === 0;

    return (
        <Modal
            abierto
            alCerrar={alCerrar}
            titulo={esHoy ? 'Agregar venta de hoy' : 'Agregar venta de este día'}
            descripcion={
                <>
                    <CalendarDays className="mr-1.5 inline size-4 -translate-y-px text-tenue" aria-hidden="true" />
                    Se registra con fecha <span className="font-medium text-texto">{fechaLarga(fecha, { anio: fecha.slice(0, 4) !== negocio.hoy.slice(0, 4) })}</span>
                    {esHoy && ' (hoy)'}.
                </>
            }
            alEnviar={enviar}
            bloqueado={form.processing}
            pie={
                <>
                    <Boton variante="fantasma" className="sm:mr-auto" onClick={alCerrar} disabled={form.processing}>
                        {capturadas > 0 ? 'Listo' : 'Cancelar'}
                    </Boton>
                    <Boton
                        disabled={form.processing || sinCuentas}
                        onClick={(evento) => {
                            seguir.current = true;
                            evento.currentTarget.form?.requestSubmit();
                        }}
                    >
                        Guardar y agregar otra
                    </Boton>
                    <Boton type="submit" variante="primario" cargando={form.processing} disabled={sinCuentas}>
                        Guardar venta
                    </Boton>
                </>
            }
        >
            <div className="grid gap-4 sm:grid-cols-5">
                {form.errors.sold_on && (
                    <p role="alert" className="flex items-start gap-1.5 text-[13px] leading-snug text-peligro sm:col-span-5">
                        <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                        <span>{form.errors.sold_on}</span>
                    </p>
                )}

                <Selector
                    ref={selectorCuenta}
                    etiqueta="Cuenta"
                    value={cuenta ? cuentaId : ''}
                    onChange={(evento) => {
                        setCuentaId(evento.target.value);
                        setErrorCuenta(null);
                    }}
                    opciones={cuentas.map((opcion) => ({ valor: opcion.id, etiqueta: `${opcion.email} · ${plural(opcion.libres, 'libre')}` }))}
                    marcador={sinCuentas ? 'No hay cuentas con espacio libre' : 'Elige una cuenta con espacio…'}
                    disabled={sinCuentas}
                    error={errorCuenta}
                    ayuda={
                        sinCuentas
                            ? 'Da de alta una cuenta en Cuentas para seguir capturando.'
                            : cuenta
                              ? `${cuenta.libres === 1 ? 'Queda 1 espacio libre' : `Quedan ${cuenta.libres} espacios libres`} de ${cuenta.capacidad}.`
                              : capturadas > 0
                                ? 'La cuenta anterior ya se llenó: elige otra.'
                                : undefined
                    }
                    claseContenedor="sm:col-span-5"
                />

                <Campo
                    ref={campoCorreo}
                    etiqueta="Gmail del cliente"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="cliente@gmail.com"
                    maxLength={255}
                    data-autofocus={cuentaId !== '' ? '' : undefined}
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
                    opciones={vendedores.map((vendedor) => ({ valor: vendedor.id, etiqueta: vendedor.name }))}
                    marcador="Elige un vendedor…"
                    error={form.errors.seller_id}
                    ayuda="Se recuerda el último que usaste."
                    claseContenedor="sm:col-span-5"
                />

                <CasillaPendiente marcada={form.data.pendiente} alCambiar={(valor) => form.setData('pendiente', valor)} className="sm:col-span-5" />

                <p role="status" className={cn('text-[13px] text-suave sm:col-span-5', capturadas === 0 && 'sr-only')}>
                    {capturadas > 0 && `${capturadas === 1 ? 'Venta guardada' : `${capturadas} ventas guardadas`} en esta ventana. Captura la siguiente o cierra con «Listo».`}
                </p>
            </div>
        </Modal>
    );
}
