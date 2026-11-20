// Contrato de datos entre el servidor (Laravel + Inertia) y las pantallas. Todo el dinero va en centavos.

export interface Usuario { id: number; name: string; username: string; role: 'admin' | 'socio'; is_admin: boolean }

export interface Compartido {
    auth: { user: Usuario | null };
    flash: { success?: string | null; error?: string | null };
    negocio: { hoy: string; capacidad: number; precios: number[]; porcentaje_socio: number; porcentaje_vendedor: number; meses_cuenta: number };
    [key: string]: unknown;
}

export interface Vendedor { id: number; name: string; is_owner: boolean }

export interface Espacio {
    id: number; account_id: number; account_email: string | null; position: number;
    client_email: string; client_phone: string | null; price_cents: number;
    seller_id: number | null; seller_name: string | null; sold_on: string; paid_on: string | null;
    invite_url: string | null; invite_expires_on: string | null;
    invite_status: 'sin_liga' | 'lista' | 'enviada' | 'aceptada' | 'caducada';
    /** Lo que dice Google en la última revisión del grupo (null = nunca se revisó). */
    google_status: 'miembro' | 'invitado' | 'ausente' | null;
    /** 'google' = se dio de alta solo al encontrarlo en el grupo de Google (llega sin precio ni vendedor). */
    origen: 'google' | null;
}

export interface Cuenta {
    id: number; email: string; password: string | null; twofa_url: string | null;
    invite_links: { position: number; url: string | null; expires_on: string | null }[]; started_on: string; expires_on: string; dias_restantes: number;
    activa: boolean; por_vencer: boolean; notes: string | null;
    /** Comprada pero sin usar todavía: no cuenta como activa (ni vencida) hasta que se activa. */
    por_activar: boolean;
    capacidad: number; ocupados: number; libres: number; ingresos: number; espacios: Espacio[];
    /** Clientes que deben dinero: sin pagar y con precio (los «Sin precio» no cuentan). */
    pendientes_pago: number;
    /** Vigente, los 5 espacios ocupados, nadie con dinero por cobrar y todos dentro del grupo: va en la pestaña «Llenas». */
    llena: boolean;
    /** Sincronización con el grupo familiar de Google (solo cuentas con sesión abierta en el servidor). */
    google: {
        conectada: boolean; revisada: string | null; ligas: number; extra: { email: string; tipo: 'miembro' | 'invitado' }[];
        /** Google no deja invitar hasta este momento (ISO 8601; «límite de invitaciones»). null = sin bloqueo. */
        bloqueo_hasta: string | null;
    };
}

/** Reparto de un periodo: ventas − publicidad − costo de cuentas = neto; socio 10 %; el resto, mitad vendedor y mitad dueño. */
export interface Totales { ventas_count: number; ventas: number; publicidad: number; costo: number; neto: number; socio: number; vendedor: number; dueno: number }

export interface FilaVendedor extends Totales { seller_id: number; name: string; is_owner: boolean }

export interface DiaSerie { fecha: string; ventas_count: number; ventas: number; publicidad: number; costo: number; neto: number }

// Props de cada pantalla
export interface DashboardProps {
    hoy: Totales & { fecha: string };
    mes: Totales & { desde: string; hasta: string };
    historico: Totales;
    porVendedorMes: FilaVendedor[];
    serie: DiaSerie[];
    /** espacios_libres = los que se pueden vender hoy; espacios_bloqueados = libres en cuentas con el bloqueo de Google. */
    cuentas: { activas: number; vencidas: number; espacios_ocupados: number; espacios_libres: number; espacios_bloqueados: number; capacidad_total: number; clientes: number; pendientes_pago: number; pendiente_monto: number };
    conEspacio: Cuenta[];
    porVencer: Cuenta[];
}

export interface CuentasProps {
    cuentas: Cuenta[];
    filtros: { estado: 'activas' | 'llenas' | 'bloqueadas' | 'por_activar' | 'vencidas' | 'todas' | 'con_espacio' | 'por_cobrar'; q: string };
    vendedores: Vendedor[];
    /** Cuántas cuentas vigentes están llenas (para la pestaña «Llenas»). */
    llenas: number;
    /** Cuántas cuentas vigentes tienen el bloqueo de invitaciones de Google (pestaña «Bloqueadas»). */
    bloqueadas: number;
    /** Cuántas cuentas están pendientes de activar (pestaña «Por activar»). */
    por_activar: number;
}

export interface DiaProps {
    fecha: string; anterior: string; siguiente: string | null; esHoy: boolean;
    ventas: Espacio[];
    publicidad: { seller_id: number; name: string; amount_cents: number }[];
    reparto: { filas: FilaVendedor[]; totales: Totales };
    puedeEditarPublicidad: boolean;
    vendedores: Vendedor[];
    conEspacio: Cuenta[];
}

/** Lo que el dueño le debe HOY a un vendedor: su parte acumulada menos lo ya pagado (no depende del periodo elegido). */
export interface EstadoPago {
    pendiente: number;
    /** Primer día sin pagar (el siguiente al último pago, o su primer movimiento); null si nunca ha tenido movimiento. */
    desde: string | null;
    /** Cambios en días ya pagados (ventas o publicidad capturadas después del pago); ya va incluido en `pendiente`. */
    ajuste: number;
    ultimo: { hasta: string; paid_on: string; amount_cents: number } | null;
}

export interface ReportesProps {
    desde: string; hasta: string; filas: FilaVendedor[]; totales: Totales; serie: DiaSerie[];
    /** Por pagar a cada vendedor (sin el dueño). */
    pagos: (EstadoPago & { seller_id: number; name: string; active: boolean })[];
}

/** Reparto de un vendedor más `parte`: lo que le toca a él (al dueño, la parte del dueño). */
export interface RepartoVendedor extends Totales { parte: number }

export interface DiaVendedor extends RepartoVendedor {
    fecha: string;
    /** El pago que ya cubre ese día, o null si sigue por pagar. */
    pago: { id: number; paid_on: string } | null;
}

export interface PagoVendedor {
    id: number;
    /** Primer día que cubre (null = desde el inicio). */
    desde: string | null;
    hasta: string; paid_on: string; amount_cents: number; notes: string | null; registrado_por: string | null;
    /** Solo el último pago se puede deshacer. */
    puede_borrar: boolean;
}

export interface VendedorReporteProps {
    vendedor: { id: number; name: string; is_owner: boolean; active: boolean };
    vendedores: Vendedor[];
    desde: string; hasta: string;
    hoyVendedor: RepartoVendedor;
    periodo: RepartoVendedor;
    /** Días del periodo con movimiento. */
    dias: DiaVendedor[];
    /** null para el dueño (a él no se le registran pagos). `cortes`: cuánto se le debería si se le paga hasta cada día sin pagar. */
    pago: (EstadoPago & { cortes: { fecha: string; por_pagar: number }[] }) | null;
    pagos: PagoVendedor[];
    /** Administrador y no es el dueño. */
    puedePagar: boolean;
}

export interface VendedoresProps { vendedores: { id: number; name: string; is_owner: boolean; active: boolean; ventas_count: number }[] }
