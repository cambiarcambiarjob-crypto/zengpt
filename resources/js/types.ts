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
    seller_id: number; seller_name: string | null; sold_on: string;
    invite_url: string | null; invite_expires_on: string | null;
    invite_status: 'sin_liga' | 'lista' | 'enviada' | 'aceptada' | 'caducada';
}

export interface Cuenta {
    id: number; email: string; password: string | null; twofa_url: string | null; started_on: string; expires_on: string; dias_restantes: number;
    activa: boolean; por_vencer: boolean; notes: string | null;
    capacidad: number; ocupados: number; libres: number; ingresos: number; espacios: Espacio[];
}

/** Reparto de un periodo: ventas − publicidad = neto; socio 10 %; el resto, mitad vendedor y mitad dueño. */
export interface Totales { ventas_count: number; ventas: number; publicidad: number; neto: number; socio: number; vendedor: number; dueno: number }

export interface FilaVendedor extends Totales { seller_id: number; name: string; is_owner: boolean }

export interface DiaSerie { fecha: string; ventas_count: number; ventas: number; publicidad: number; neto: number }

// Props de cada pantalla
export interface DashboardProps {
    hoy: Totales & { fecha: string };
    mes: Totales & { desde: string; hasta: string };
    historico: Totales;
    porVendedorMes: FilaVendedor[];
    serie: DiaSerie[];
    cuentas: { activas: number; vencidas: number; espacios_ocupados: number; espacios_libres: number; capacidad_total: number; clientes: number };
    conEspacio: Cuenta[];
    porVencer: Cuenta[];
}

export interface CuentasProps {
    cuentas: Cuenta[];
    filtros: { estado: 'activas' | 'vencidas' | 'todas' | 'con_espacio'; q: string };
    vendedores: Vendedor[];
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

export interface ReportesProps { desde: string; hasta: string; filas: FilaVendedor[]; totales: Totales; serie: DiaSerie[] }

export interface VendedoresProps { vendedores: { id: number; name: string; is_owner: boolean; active: boolean; ventas_count: number }[] }
