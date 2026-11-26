import { Bot, ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { AnotarChatgpt, RegistrosChatgpt } from '@/components/chatgpt/ChatgptCorte';
import { capitalizar } from '@/components/reportes/periodos';
import { Aparecer } from '@/components/ui/Aparecer';
import { EnlaceBoton } from '@/components/ui/Boton';
import { Cifra } from '@/components/ui/Cifra';
import { EstadoVacio } from '@/components/ui/EstadoVacio';
import { Tarjeta } from '@/components/ui/Tarjeta';
import AppLayout from '@/layouts/AppLayout';
import { dinero, fechaCorta, fechaLarga, mesLargo, plural } from '@/lib/formato';
import { usePagina } from '@/lib/pagina';
import type { ChatgptProps } from '@/types';

/**
 * ChatGPT de Jorge: en el corte de cada día se anota cuántos se vendieron ($450 o personalizado). Se pagan $400 fijos
 * cada día 6, sin importar cuántos se vendan: ese pago es su costo. El reparto es el mismo de Gemini y ya entra solo en
 * el Día, Reportes, el Panel y el Corte. Aquí se ve el mes: lo vendido por día, los pagos y lo que deja.
 */
export default function ChatgptIndex() {
    const { mes, anterior, siguiente, vendedor, precio, costo_mensual: costoMensual, dia_pago: diaPago, siguiente_pago: siguientePago, pagos, resumen, dias, negocio } = usePagina<ChatgptProps>();
    const nombre = vendedor?.name ?? 'Jorge';
    const titulo = capitalizar(mesLargo(`${mes}-01`));
    const esteMes = siguiente === null;

    // Los días con ventas y los días de pago, juntos y del más reciente al más viejo.
    const porFecha = new Map(dias.map((d) => [d.fecha, d]));
    const fechas = [...new Set([...dias.map((d) => d.fecha), ...pagos])].sort().reverse();

    return (
        <AppLayout
            titulo="ChatGPT"
            ancho="ancho"
            descripcion={`De ${nombre} · ${dinero(precio)} cada uno o personalizado · se pagan ${dinero(costoMensual)} cada día ${diaPago}`}
            acciones={
                <div className="flex items-center gap-1.5">
                    <EnlaceBoton href={`/chatgpt?mes=${anterior}`} variante="fantasma" tamano="sm" soloIcono preserveScroll aria-label="Mes anterior">
                        <ChevronLeft className="size-4" aria-hidden="true" />
                    </EnlaceBoton>
                    <span className="min-w-28 text-center text-sm font-medium text-texto">{titulo}</span>
                    {siguiente ? (
                        <EnlaceBoton href={`/chatgpt?mes=${siguiente}`} variante="fantasma" tamano="sm" soloIcono preserveScroll aria-label="Mes siguiente">
                            <ChevronRight className="size-4" aria-hidden="true" />
                        </EnlaceBoton>
                    ) : (
                        <span className="size-8" aria-hidden="true" />
                    )}
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <Aparecer indice={0} className="xl:col-span-12">
                    <Tarjeta>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
                            <Cifra
                                etiqueta={`Vendidos en ${mesLargo(`${mes}-01`)}`}
                                valor={resumen.vendidos}
                                formato="numero"
                                tamano="lg"
                                icono={<Bot className="size-4" aria-hidden="true" />}
                                detalle={dinero(resumen.ventas)}
                            />
                            <Cifra
                                etiqueta={`Pagos del día ${diaPago}`}
                                valor={resumen.costo}
                                tamano="md"
                                tono={resumen.costo > 0 ? 'alerta' : 'suave'}
                                detalle={pagos.length > 0 ? pagos.map((p) => fechaCorta(p)).join(' · ') : esteMes ? `siguiente: ${fechaCorta(siguientePago)}` : 'sin pago este mes'}
                            />
                            <Cifra etiqueta="Deja ChatGPT" valor={resumen.neto} tamano="md" negativoEnRojo detalle="ventas − pagos, sin publicidad" />
                            <Cifra etiqueta={`Le toca a ${nombre}`} valor={resumen.vendedor} tamano="md" detalle={`socio ${dinero(resumen.socio)} · dueño ${dinero(resumen.dueno)}`} />
                        </div>
                        <p className="mt-4 text-xs leading-relaxed text-tenue">
                            La publicidad de {nombre} se descuenta en su corte junto con Gemini, así que lo que le toca aquí es antes de publicidad. En el Día, Reportes y el Corte ya va todo junto.
                        </p>
                    </Tarjeta>
                </Aparecer>

                <Aparecer indice={1} className="xl:col-span-4">
                    <Tarjeta titulo="Anotar ChatGPT vendidos" descripcion="Lo del corte de un día">
                        <AnotarChatgpt fecha={negocio.hoy} hoy={negocio.hoy} precio={precio} conFecha />
                    </Tarjeta>
                </Aparecer>

                <Aparecer indice={2} className="xl:col-span-8">
                    <Tarjeta titulo="Por día" descripcion={`${titulo}: lo anotado en cada corte y los pagos del día ${diaPago}`}>
                        {fechas.length === 0 ? (
                            <EstadoVacio
                                compacto
                                icono={<Receipt className="size-5" />}
                                titulo="Nada anotado este mes"
                                descripcion="Cuando anotes ChatGPT vendidos en un corte, aquí aparecen por día, junto con los pagos del día 6."
                            />
                        ) : (
                            <ol className="grid gap-4">
                                {fechas.map((fecha) => {
                                    const dia = porFecha.get(fecha);
                                    const esPago = pagos.includes(fecha);

                                    return (
                                        <li key={fecha} className="grid gap-2">
                                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                                <h3 className="font-sans text-sm font-semibold text-texto">{capitalizar(fechaLarga(fecha))}</h3>
                                                <p className="cifras text-[13px] text-suave">
                                                    {dia ? `${plural(dia.vendidos, 'vendido')} · ${dinero(dia.ventas)}` : 'sin ventas anotadas'}
                                                    {esPago && <span className="font-medium text-alerta"> · pago de ChatGPT −{dinero(costoMensual)}</span>}
                                                </p>
                                            </div>
                                            {dia && <RegistrosChatgpt registros={dia.registros} />}
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </Tarjeta>
                </Aparecer>
            </div>
        </AppLayout>
    );
}
