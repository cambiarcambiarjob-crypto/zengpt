import { useForm } from '@inertiajs/react';
import { type FormEvent, useState } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Campo, CampoArea } from '@/components/ui/Campo';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { aNumeroPesos, dinero, fechaCorta, fechaMedia, pesos, sumarDias } from '@/lib/formato';
import type { Compartido, VendedorReporteProps } from '@/types';

export interface ModalPagoProps {
    vendedor: VendedorReporteProps['vendedor'];
    pago: NonNullable<VendedorReporteProps['pago']>;
    hoy: string;
    alCerrar: () => void;
}

/**
 * Registrar un pago: «le pagué lo acumulado hasta el día X». El monto se llena solo con lo que se le debe hasta ese día
 * (su parte acumulada menos lo ya pagado); si le pagas otra cantidad, la diferencia queda para el siguiente pago.
 */
export function ModalPago({ vendedor, pago, hoy, alCerrar }: ModalPagoProps) {
    // Lo que se le debería si se le paga hasta `fecha`: el corte más reciente que no pase de esa fecha.
    const estimado = (fecha: string): number => {
        const cortes = pago.cortes.filter((corte) => corte.fecha <= fecha);

        return cortes.length > 0 ? cortes[cortes.length - 1].por_pagar : pago.ultimo ? pago.ajuste : 0;
    };
    const minimo = pago.ultimo ? sumarDias(pago.ultimo.hasta, 1) : undefined;

    const form = useForm({ hasta: hoy, monto: pesos(Math.max(0, estimado(hoy))), paid_on: hoy, notes: '' });
    const [montoTocado, setMontoTocado] = useState(false);

    const debe = form.data.hasta ? estimado(form.data.hasta) : 0;
    const monto = aNumeroPesos(form.data.monto);
    const diferencia = Number.isFinite(monto) ? debe - Math.round(monto * 100) : 0;

    const enviar = (evento: FormEvent) => {
        evento.preventDefault();
        form.transform((datos) => ({ ...datos, monto: datos.monto.replace(/[$,\s]/g, ''), notes: datos.notes.trim() }));
        form.post(`/reportes/vendedores/${vendedor.id}/pagos`, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: (pagina) => {
                if (!(pagina.props as unknown as Compartido).flash?.error) alCerrar();
            },
        });
    };

    return (
        <Modal
            abierto
            alCerrar={alCerrar}
            titulo={`Pago a ${vendedor.name}`}
            descripcion={pago.ultimo ? `El último pago cubrió hasta el ${fechaMedia(pago.ultimo.hasta)}.` : 'Primer pago: cubre todo lo que ha vendido hasta el día que elijas.'}
            alEnviar={enviar}
            bloqueado={form.processing}
            pie={
                <>
                    <Boton variante="fantasma" onClick={alCerrar} disabled={form.processing}>
                        Cancelar
                    </Boton>
                    <Boton type="submit" variante="primario" cargando={form.processing}>
                        Registrar pago
                    </Boton>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <Campo
                    etiqueta="Le pagas lo acumulado hasta el"
                    type="date"
                    min={minimo}
                    max={hoy}
                    value={form.data.hasta}
                    onChange={(evento) => {
                        const fecha = evento.target.value;
                        form.setData((datos) => ({ ...datos, hasta: fecha, monto: montoTocado || !fecha ? datos.monto : pesos(Math.max(0, estimado(fecha))) }));
                    }}
                    error={form.errors.hasta}
                    ayuda={minimo ? `Desde el ${fechaCorta(minimo)} (lo anterior ya está pagado).` : undefined}
                />

                <p className="flex min-h-11 items-center justify-between gap-3 rounded-campo border border-borde bg-superficie-2/60 px-3 py-2 text-[13px] text-suave" aria-live="polite">
                    <span>Se le debe hasta ese día</span>
                    <strong className={cn('cifras text-base font-semibold', debe > 0 ? 'text-alerta' : debe < 0 ? 'text-peligro' : 'text-texto')}>{dinero(debe)}</strong>
                </p>

                <Campo
                    etiqueta="Monto que le pagaste"
                    inputMode="decimal"
                    prefijo="$"
                    value={form.data.monto}
                    onChange={(evento) => {
                        setMontoTocado(true);
                        form.setData('monto', evento.target.value);
                    }}
                    error={form.errors.monto}
                    ayuda={
                        diferencia > 0
                            ? `Quedan ${dinero(diferencia)} pendientes para el siguiente pago.`
                            : diferencia < 0
                              ? `Le pagas ${dinero(-diferencia)} de más: se descuenta del siguiente pago.`
                              : 'Exacto: queda al corriente hasta ese día.'
                    }
                    className="cifras"
                />

                <Campo etiqueta="Fecha en que le pagaste" type="date" max={hoy} value={form.data.paid_on} onChange={(evento) => form.setData('paid_on', evento.target.value)} error={form.errors.paid_on} />

                <CampoArea
                    etiqueta="Notas"
                    opcional
                    rows={2}
                    maxLength={255}
                    placeholder="Transferencia, efectivo, folio…"
                    value={form.data.notes}
                    onChange={(evento) => form.setData('notes', evento.target.value)}
                    error={form.errors.notes}
                />
            </div>
        </Modal>
    );
}
