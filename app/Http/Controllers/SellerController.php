<?php

namespace App\Http\Controllers;

use App\Models\Seller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Catálogo de vendedores (solo administrador). */
class SellerController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Vendedores/Index', [
            'vendedores' => Seller::query()->ordered()->withCount('slots')->get()
                ->map(fn (Seller $s): array => ['id' => $s->id, 'name' => $s->name, 'is_owner' => $s->is_owner, 'active' => $s->active, 'ventas_count' => $s->slots_count])->all(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:60', Rule::unique('sellers', 'name')]], [], ['name' => 'nombre']);
        Seller::query()->create(['name' => trim($data['name']), 'sort' => (int) Seller::query()->max('sort') + 1]);

        return back()->with('success', 'Vendedor agregado.');
    }

    public function update(Request $request, Seller $seller): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('sellers', 'name')->ignore($seller->id)],
            'active' => ['required', 'boolean'],
        ], [], ['name' => 'nombre', 'active' => 'activo']);

        // El dueño no se puede dar de baja: sus ventas son las que no se reparten.
        $seller->update(['name' => trim($data['name']), 'active' => $seller->is_owner ? true : (bool) $data['active']]);

        return back()->with('success', 'Vendedor actualizado.');
    }
}
