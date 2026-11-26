<?php

namespace App\Http\Controllers;

use App\Models\ChatgptSale;
use App\Services\Chatgpt;
use App\Support\Hoy;
use App\Support\Reparto;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Apartado ChatGPT (solo los vende Jorge): en el corte de cada día se anota cuántos se vendieron y a qué precio ($450 o
 * personalizado). Se pagan $400 fijos cada día 6 y eso es su costo; el reparto es el mismo de Gemini. Las ventas y el
 * pago entran solos en el Día, Reportes, el Panel y el Corte (App\Services\Chatgpt). Administrador y socio.
 */
class ChatgptController extends Controller
{
    public function index(Request $request): Response
    {
        $hoy = Hoy::carbon();
        $mes = preg_match('/^\d{4}-\d{2}$/', (string) $request->query('mes')) === 1 ? Carbon::parse($request->query('mes').'-01') : $hoy->copy()->startOfMonth();
        if ($mes->greaterThan($hoy)) {
            $mes = $hoy->copy()->startOfMonth();
        }
        $desde = $mes->copy()->startOfMonth()->toDateString();
        $hasta = min($mes->copy()->endOfMonth()->toDateString(), Hoy::fecha());

        $registros = ChatgptSale::query()->with('creator:id,name')
            ->whereDate('sold_on', '>=', $desde)->whereDate('sold_on', '<=', $hasta)->orderByDesc('sold_on')->orderByDesc('id')->get();
        $pagos = Chatgpt::pagos($desde, $hasta);

        $vendidos = (int) $registros->sum('quantity');
        $ventas = (int) $registros->sum(fn (ChatgptSale $r): int => $r->total());
        $costo = count($pagos) * Chatgpt::costoMensual();

        $dias = $registros->groupBy(fn (ChatgptSale $r): string => $r->sold_on->toDateString())
            ->map(fn ($grupo, string $fecha): array => [
                'fecha' => $fecha,
                'vendidos' => (int) $grupo->sum('quantity'),
                'ventas' => (int) $grupo->sum(fn (ChatgptSale $r): int => $r->total()),
                'registros' => $grupo->map(fn (ChatgptSale $r): array => self::registro($r))->values()->all(),
            ])->values()->all();

        $vendedor = Chatgpt::vendedor();

        return Inertia::render('Chatgpt/Index', [
            'mes' => $mes->format('Y-m'),
            'anterior' => $mes->copy()->subMonthNoOverflow()->format('Y-m'),
            'siguiente' => $mes->copy()->addMonthNoOverflow()->startOfMonth()->greaterThan($hoy) ? null : $mes->copy()->addMonthNoOverflow()->format('Y-m'),
            'vendedor' => $vendedor ? ['id' => $vendedor->id, 'name' => $vendedor->name] : null,
            'precio' => Chatgpt::precio(),
            'costo_mensual' => Chatgpt::costoMensual(),
            'dia_pago' => Chatgpt::diaPago(),
            'siguiente_pago' => Chatgpt::siguientePago(),
            'pagos' => $pagos,
            // Lo de ChatGPT en el mes, sin publicidad (la de Jorge va en su corte, junto con Gemini).
            'resumen' => ['vendidos' => $vendidos] + Reparto::calcular($ventas, 0, false, $costo),
            'dias' => $dias,
        ]);
    }

    /** Anota ChatGPT vendidos en un corte (por omisión hoy). El precio llega en pesos. */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'sold_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::fecha()],
            'quantity' => ['required', 'integer', 'min:1', 'max:500'],
            'price' => ['required', 'numeric', 'min:1', 'max:100000'],
        ], ['sold_on.before_or_equal' => 'No se pueden anotar ventas de días que no han llegado.'], ['sold_on' => 'fecha', 'quantity' => 'cuántos', 'price' => 'precio']);

        $vendedor = Chatgpt::vendedor();
        if ($vendedor === null) {
            return back()->with('error', 'No encontré al vendedor de ChatGPT ('.config('zengpt.chatgpt.vendedor').') en Vendedores.');
        }

        $venta = ChatgptSale::query()->create([
            'sold_on' => $data['sold_on'],
            'quantity' => (int) $data['quantity'],
            'price_cents' => (int) round(((float) $data['price']) * 100),
            'seller_id' => $vendedor->id,
            'created_by' => $request->user()->id,
        ]);

        $fecha = $venta->sold_on->locale('es')->isoFormat('D [de] MMMM');

        return back()->with('success', ($venta->quantity === 1 ? 'Se anotó 1 ChatGPT' : "Se anotaron {$venta->quantity} ChatGPT")." del {$fecha}.");
    }

    public function destroy(ChatgptSale $venta): RedirectResponse
    {
        $venta->delete();

        return back()->with('success', 'Se quitó ese registro de ChatGPT.');
    }

    /**
     * Un registro de ChatGPT para las pantallas.
     *
     * @return array{id: int, quantity: int, price_cents: int, total: int, registrado_por: ?string}
     */
    public static function registro(ChatgptSale $r): array
    {
        return ['id' => $r->id, 'quantity' => $r->quantity, 'price_cents' => $r->price_cents, 'total' => $r->total(), 'registrado_por' => $r->creator?->name];
    }
}
