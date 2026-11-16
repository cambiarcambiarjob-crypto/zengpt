<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Slot;
use App\Support\Hoy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SlotController extends Controller
{
    public function store(Request $request, Account $account): RedirectResponse
    {
        $data = $this->validated($request);

        if (! $account->isActive()) {
            return back()->with('error', 'La cuenta ya venció: no se le pueden agregar clientes.');
        }

        // Transacción con bloqueo: dos personas capturando a la vez no pueden pasar de 5 espacios.
        $creado = DB::transaction(function () use ($account, $data, $request): bool {
            $cuenta = Account::query()->lockForUpdate()->findOrFail($account->id);
            $posicion = $cuenta->firstFreePosition();

            if ($posicion === null) {
                return false;
            }

            $cuenta->slots()->create($data + ['position' => $posicion, 'created_by' => $request->user()->id]);

            return true;
        });

        return $creado
            ? back()->with('success', 'Cliente agregado al espacio.')
            : back()->with('error', 'La cuenta ya tiene sus '.Account::capacity().' espacios ocupados.');
    }

    public function update(Request $request, Slot $slot): RedirectResponse
    {
        $slot->update($this->validated($request));

        return back()->with('success', 'Espacio actualizado.');
    }

    public function destroy(Slot $slot): RedirectResponse
    {
        $slot->delete();

        return back()->with('success', 'Espacio liberado.');
    }

    /**
     * El precio llega en pesos (200, 400, 500 o personalizado) y se guarda en centavos.
     *
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'client_email' => ['required', 'email:rfc', 'max:255'],
            'client_phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\-\s]{7,30}$/'],
            'price' => ['required', 'numeric', 'min:0', 'max:100000'],
            'seller_id' => ['required', 'integer', Rule::exists('sellers', 'id')->where('active', true)],
            'sold_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.Hoy::carbon()->addDay()->toDateString()],
        ], ['client_phone.regex' => 'El teléfono solo puede llevar números, espacios, + y guiones.'], [
            'client_email' => 'Gmail del cliente', 'client_phone' => 'teléfono', 'price' => 'precio', 'seller_id' => 'vendedor', 'sold_on' => 'fecha de venta',
        ]);

        return [
            'client_email' => $data['client_email'],
            'client_phone' => filled($data['client_phone'] ?? null) ? trim($data['client_phone']) : null,
            'price_cents' => (int) round(((float) $data['price']) * 100),
            'seller_id' => (int) $data['seller_id'],
            'sold_on' => $data['sold_on'],
        ];
    }
}
