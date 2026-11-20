import { router } from '@inertiajs/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Boton } from '@/components/ui/Boton';
import { Campo } from '@/components/ui/Campo';
import { Pestanas } from '@/components/ui/Pestanas';
import { cn } from '@/lib/cn';
import { type Atajo, atajoActivo, atajosDePeriodo, urlReporte } from './periodos';

export interface FiltroPeriodoProps {
    /** Rango que muestra el reporte (el servidor ya lo validó y ordenó). */
    desde: string;
    hasta: string;
    /** Hoy según el negocio (props.negocio.hoy): de aquí salen los atajos. */
    hoy: string;
    /** URL actual (usePage().url): distingue dos atajos que cubren el mismo rango. */
    url: string;
    /** true mientras llega el reporte del rango nuevo. */
    cargando?: boolean;
    /** Pantalla a la que navega (por omisión '/reportes'; la de un vendedor usa '/reportes/vendedores/{id}'). */
    base?: string;
    /** Atajos propios de la pantalla, antes de los de siempre (p. ej. «Sin pagar» en la de un vendedor). */
    extras?: Omit<Atajo, 'href'>[];
    className?: string;
}

/**
 * Filtro del reporte: atajos (Hoy, Esta semana, Este mes, Mes pasado, Últimos 90 días) con la píldora de PillNav y un
 * rango a mano con dos fechas. Todo navega a /reportes?desde=…&hasta=… conservando el desplazamiento.
 */
export function FiltroPeriodo({ desde, hasta, hoy, url, cargando = false, base = '/reportes', extras, className }: FiltroPeriodoProps) {
    const atajos = useMemo(
        () => [...(extras ?? []).map((atajo) => ({ ...atajo, href: urlReporte(atajo.desde, atajo.hasta, atajo.clave, base) })), ...atajosDePeriodo(hoy, base)],
        [hoy, base, extras],
    );
    const activo = atajoActivo(atajos, desde, hasta, url);
    const [campos, setCampos] = useState({ desde, hasta });
    const [errores, setErrores] = useState<{ desde?: string; hasta?: string }>({});

    // Al llegar un rango nuevo (por atajo, por el formulario o con «atrás») los campos muestran ese rango.
    useEffect(() => {
        setCampos({ desde, hasta });
        setErrores({});
    }, [desde, hasta]);

    const cambiado = campos.desde !== desde || campos.hasta !== hasta;

    const aplicar = (evento: FormEvent) => {
        evento.preventDefault();

        const faltan = { desde: campos.desde ? undefined : 'Elige la fecha inicial.', hasta: campos.hasta ? undefined : 'Elige la fecha final.' };
        setErrores(faltan);
        if (faltan.desde || faltan.hasta) return;

        // Si las fechas vienen al revés se acomodan (el servidor haría lo mismo).
        const [inicio, fin] = campos.desde <= campos.hasta ? [campos.desde, campos.hasta] : [campos.hasta, campos.desde];
        router.get(base, { desde: inicio, hasta: fin }, { preserveState: true, preserveScroll: true });
    };

    return (
        <div className={cn('flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta xl:flex-row xl:items-end xl:justify-between', className)}>
            <div className="min-w-0">
                <p className="mb-1.5 text-[13px] font-medium text-suave">Periodo</p>
                <Pestanas
                    etiqueta="Periodo del reporte"
                    tamano="sm"
                    activa={activo?.clave ?? ''}
                    opciones={atajos.map((atajo) => ({ valor: atajo.clave, etiqueta: atajo.etiqueta, href: atajo.href }))}
                />
            </div>

            <form onSubmit={aplicar} noValidate className="grid grid-cols-2 items-end gap-3 sm:flex" aria-label="Rango de fechas a la medida">
                <Campo
                    etiqueta="Desde"
                    type="date"
                    value={campos.desde}
                    onChange={(evento) => setCampos((previos) => ({ ...previos, desde: evento.target.value }))}
                    error={errores.desde}
                    claseContenedor="min-w-0 sm:w-44"
                    className="cifras"
                />
                <Campo
                    etiqueta="Hasta"
                    type="date"
                    value={campos.hasta}
                    onChange={(evento) => setCampos((previos) => ({ ...previos, hasta: evento.target.value }))}
                    error={errores.hasta}
                    claseContenedor="min-w-0 sm:w-44"
                    className="cifras"
                />
                <Boton type="submit" variante={cambiado ? 'primario' : 'secundario'} cargando={cargando && cambiado} className="col-span-2 h-11 sm:h-10">
                    Aplicar
                </Boton>
            </form>
        </div>
    );
}
