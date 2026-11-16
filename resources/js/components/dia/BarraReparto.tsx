import { cn } from '@/lib/cn';
import { dinero } from '@/lib/formato';
import { COLORES_REPARTO, type ParteReparto } from './utilidades';

export interface SegmentoReparto {
    parte: ParteReparto;
    /** Nombre de la parte («Socio», «Vendedores», «Leo»). */
    nombre: string;
    centavos: number;
}

/** Cuadrito de color que une una cifra con su tramo de la barra. */
export function MuestraReparto({ parte, className }: { parte: ParteReparto; className?: string }) {
    return <span className={cn('inline-block size-2.5 shrink-0 rounded-[3px]', className)} style={{ backgroundColor: COLORES_REPARTO[parte] }} aria-hidden="true" />;
}

/**
 * El neto del día partido en sus tres destinos (socio · vendedores · dueño): una barra delgada, proporcional y sin texto,
 * porque los nombres y los montos están justo debajo. Si no hay ganancia que repartir (neto en cero o negativo) queda
 * la pista vacía: una barra no puede dibujar partes negativas.
 */
export function BarraReparto({ segmentos, className }: { segmentos: SegmentoReparto[]; className?: string }) {
    const total = segmentos.reduce((suma, segmento) => suma + segmento.centavos, 0);
    const dibujable = total > 0 && segmentos.every((segmento) => segmento.centavos >= 0);
    const parte = (centavos: number) => `${Math.round((centavos / total) * 100)} %`;

    const descripcion = dibujable
        ? `Reparto del neto: ${segmentos.map((segmento) => `${segmento.nombre} ${dinero(segmento.centavos)} (${parte(segmento.centavos)})`).join(', ')}.`
        : total < 0
          ? 'El neto es negativo: no hay ganancia que repartir.'
          : 'Sin ganancia que repartir.';

    return (
        <div role="img" aria-label={descripcion} className={cn('flex h-2 w-full gap-0.5 overflow-hidden rounded-full', !dibujable && 'bg-superficie-3 inset-ring inset-ring-borde-fuerte', className)}>
            {dibujable &&
                segmentos.map((segmento) =>
                    segmento.centavos > 0 ? (
                        <span
                            key={segmento.parte}
                            title={`${segmento.nombre}: ${dinero(segmento.centavos)} · ${parte(segmento.centavos)}`}
                            className="h-full min-w-1 basis-0 rounded-full transition-[flex-grow] duration-500 ease-suave"
                            style={{ flexGrow: segmento.centavos, backgroundColor: COLORES_REPARTO[segmento.parte] }}
                        />
                    ) : null,
                )}
        </div>
    );
}
