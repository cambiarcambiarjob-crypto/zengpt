import { Link } from '@inertiajs/react';
import type { ComponentProps, MouseEvent } from 'react';
import PillNav from '@/components/reactbits/PillNav';
import { cn } from '@/lib/cn';

export interface OpcionPestana<V extends string = string> {
    valor: V;
    etiqueta: string;
    /** URL literal a la que navega (p. ej. '/cuentas?estado=vencidas'). Si la omites, se llama a `alCambiar`. */
    href?: string;
}

export interface PestanasProps<V extends string = string> {
    opciones: OpcionPestana<V>[];
    /** `valor` de la pestaña activa. */
    activa: V;
    /** Para pestañas sin `href` (estado local de la pantalla). */
    alCambiar?: (valor: V) => void;
    /** Nombre del grupo para lectores de pantalla («Estado de las cuentas»). */
    etiqueta: string;
    tamano?: 'sm' | 'md';
    className?: string;
}

// Enlaces de filtro: navegan con Inertia sin perder el desplazamiento ni el estado de la pantalla.
function EnlacePestana({ href, ...resto }: ComponentProps<'a'>) {
    if (!href || href.startsWith('#')) return <a href={href} {...resto} />;

    return <Link href={href} preserveScroll preserveState {...(resto as Omit<ComponentProps<typeof Link>, 'href'>)} />;
}

/**
 * Pestañas / filtros con la píldora deslizante de PillNav (React Bits) y los colores de la marca.
 *
 *   <Pestanas etiqueta="Estado de las cuentas" activa={filtros.estado} opciones={[
 *       { valor: 'activas', etiqueta: 'Activas', href: '/cuentas?estado=activas' },
 *       { valor: 'con_espacio', etiqueta: 'Con espacio', href: '/cuentas?estado=con_espacio' },
 *       { valor: 'vencidas', etiqueta: 'Vencidas', href: '/cuentas?estado=vencidas' },
 *       { valor: 'todas', etiqueta: 'Todas', href: '/cuentas?estado=todas' },
 *   ]} />
 */
export function Pestanas<V extends string = string>({ opciones, activa, alCambiar, etiqueta, tamano = 'sm', className }: PestanasProps<V>) {
    const items = opciones.map((opcion) => ({ label: opcion.etiqueta, href: opcion.href ?? `#${opcion.valor}` }));
    const actual = opciones.find((opcion) => opcion.valor === activa);

    return (
        <div className={cn('max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
            <PillNav
                items={items}
                activeHref={actual ? (actual.href ?? `#${actual.valor}`) : ''}
                linkComponent={EnlacePestana}
                onItemClick={(_item, indice, evento: MouseEvent<HTMLElement>) => {
                    const opcion = opciones[indice];
                    if (opcion && !opcion.href) {
                        evento.preventDefault();
                        alCambiar?.(opcion.valor);
                    }
                }}
                ariaLabel={etiqueta}
                size={tamano}
                theme="dark"
                surface="solid"
                itemStyle="plain"
                hoverEffect="glide"
                indicator="pill"
                collapse="never"
                intro={false}
                barColor="#151b19"
                textColor="#e8eeeb"
                highlightColor="#34d8a6"
                highlightTextColor="#03140e"
            />
        </div>
    );
}
