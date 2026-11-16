<?php

namespace Tests\Feature;

use App\Mail\InvitacionGrupo;
use App\Models\Account;
use App\Models\AdSpend;
use App\Models\Seller;
use App\Models\Slot;
use App\Models\User;
use App\Support\Hoy;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SistemaTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $socio;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(DatabaseSeeder::class);
        $this->admin = User::factory()->create(['username' => 'leo', 'role' => 'admin', 'password' => 'secreto-de-prueba']);
        $this->socio = User::factory()->create(['username' => 'christian', 'role' => 'socio', 'password' => 'secreto-de-prueba']);
    }

    private function vendedor(string $nombre): Seller
    {
        return Seller::query()->where('name', $nombre)->firstOrFail();
    }

    private function cuenta(array $datos = []): Account
    {
        return Account::query()->create($datos + ['email' => 'cuenta'.uniqid().'@gmail.com', 'started_on' => Hoy::fecha(), 'expires_on' => Hoy::carbon()->addMonthsNoOverflow(3)->toDateString()]);
    }

    public function test_sin_sesion_todo_manda_al_login_y_el_login_no_distingue_mayusculas(): void
    {
        $this->get('/')->assertRedirect('/login');
        $this->get('/cuentas')->assertRedirect('/login');
        $this->get('/login')->assertOk()->assertInertia(fn (Assert $page) => $page->component('Auth/Login'));

        $this->post('/login', ['username' => 'LEO', 'password' => 'incorrecta'])->assertSessionHasErrors('username');
        $this->assertGuest();

        $this->post('/login', ['username' => 'LeO', 'password' => 'secreto-de-prueba'])->assertRedirect('/cuentas'); // vuelve a donde iba
        $this->assertAuthenticatedAs($this->admin);
        // La sesión se recuerda: no caduca hasta cerrar sesión.
        $this->assertNotNull($this->admin->fresh()->remember_token);

        $this->post('/logout')->assertRedirect('/login');
        $this->assertGuest();
    }

    public function test_alta_de_cuenta_vence_a_los_tres_meses_y_no_se_repite(): void
    {
        $this->actingAs($this->socio)->post('/cuentas', ['email' => 'Nueva@Gmail.com', 'started_on' => '2026-11-16'])->assertSessionHasNoErrors();

        $cuenta = Account::query()->where('email', 'nueva@gmail.com')->firstOrFail();
        $this->assertSame('2027-02-16', $cuenta->expires_on->toDateString());
        $this->assertSame($this->socio->id, $cuenta->created_by);

        $this->actingAs($this->socio)->post('/cuentas', ['email' => 'nueva@gmail.com', 'started_on' => '2026-11-16'])->assertSessionHasErrors('email');
    }

    public function test_una_cuenta_acepta_cinco_espacios_y_ni_uno_mas(): void
    {
        $cuenta = $this->cuenta();
        $jorge = $this->vendedor('Jorge');

        foreach ([200, 400, 500, 350.5, 200] as $i => $precio) {
            $this->actingAs($this->socio)->post("/cuentas/{$cuenta->id}/espacios", [
                'client_email' => "cliente{$i}@gmail.com", 'client_phone' => $i === 0 ? '614 123 4567' : null,
                'price' => $precio, 'seller_id' => $jorge->id, 'sold_on' => Hoy::fecha(),
            ])->assertSessionHasNoErrors()->assertSessionHas('success');
        }

        $this->assertSame([1, 2, 3, 4, 5], $cuenta->slots()->pluck('position')->all());
        $this->assertSame(35050, $cuenta->slots()->where('position', 4)->value('price_cents'));

        $this->actingAs($this->socio)->post("/cuentas/{$cuenta->id}/espacios", [
            'client_email' => 'sexto@gmail.com', 'price' => 200, 'seller_id' => $jorge->id, 'sold_on' => Hoy::fecha(),
        ])->assertSessionHas('error');
        $this->assertSame(5, $cuenta->slots()->count());

        // Al liberar un espacio, el siguiente cliente toma ese lugar.
        $this->actingAs($this->socio)->delete('/espacios/'.$cuenta->slots()->where('position', 2)->value('id'))->assertSessionHas('success');
        $this->actingAs($this->socio)->post("/cuentas/{$cuenta->id}/espacios", [
            'client_email' => 'reemplazo@gmail.com', 'price' => 200, 'seller_id' => $jorge->id, 'sold_on' => Hoy::fecha(),
        ])->assertSessionHas('success');
        $this->assertSame('reemplazo@gmail.com', $cuenta->slots()->where('position', 2)->value('client_email'));
    }

    public function test_una_cuenta_vencida_no_acepta_clientes(): void
    {
        $cuenta = $this->cuenta(['started_on' => '2026-01-01', 'expires_on' => '2026-04-01']);

        $this->actingAs($this->admin)->post("/cuentas/{$cuenta->id}/espacios", [
            'client_email' => 'tarde@gmail.com', 'price' => 200, 'seller_id' => $this->vendedor('Leo')->id, 'sold_on' => Hoy::fecha(),
        ])->assertSessionHas('error');

        $this->assertSame(0, $cuenta->slots()->count());
    }

    public function test_la_publicidad_solo_la_captura_el_administrador(): void
    {
        $jorge = $this->vendedor('Jorge');
        $hoy = Hoy::fecha();

        $this->actingAs($this->socio)->put("/dia/{$hoy}/publicidad", ['gastos' => [$jorge->id => 100]])->assertForbidden();
        $this->assertSame(0, AdSpend::query()->count());

        $this->actingAs($this->admin)->put("/dia/{$hoy}/publicidad", ['gastos' => [$jorge->id => 100.5, $this->vendedor('Gera')->id => 0]])->assertSessionHas('success');
        $this->assertSame(10050, AdSpend::query()->where('seller_id', $jorge->id)->value('amount_cents'));
        $this->assertSame(1, AdSpend::query()->count());

        // Volver a guardar corrige el mismo renglón; en cero lo borra.
        $this->actingAs($this->admin)->put("/dia/{$hoy}/publicidad", ['gastos' => [$jorge->id => 80]]);
        $this->assertSame(8000, AdSpend::query()->where('seller_id', $jorge->id)->value('amount_cents'));
        $this->actingAs($this->admin)->put("/dia/{$hoy}/publicidad", ['gastos' => [$jorge->id => 0]]);
        $this->assertSame(0, AdSpend::query()->count());

        // El socio ve el día (incluida la publicidad) pero en solo lectura.
        $this->actingAs($this->socio)->get('/dia')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Dia/Show')->where('puedeEditarPublicidad', false)->where('fecha', $hoy));
        $this->actingAs($this->admin)->get('/dia')->assertInertia(fn (Assert $page) => $page->where('puedeEditarPublicidad', true));
    }

    public function test_el_reparto_del_dia_y_del_panel_sigue_la_regla_acordada(): void
    {
        $hoy = Hoy::fecha();
        $cuenta = $this->cuenta();
        $jorge = $this->vendedor('Jorge');
        $leo = $this->vendedor('Leo');

        // Jorge vende 2 × $200 con $100 de publicidad; Leo vende 1 × $500 sin publicidad.
        foreach ([[1, $jorge, 20000], [2, $jorge, 20000], [3, $leo, 50000]] as [$pos, $v, $precio]) {
            Slot::query()->create(['account_id' => $cuenta->id, 'position' => $pos, 'client_email' => "c{$pos}@gmail.com", 'price_cents' => $precio, 'seller_id' => $v->id, 'sold_on' => $hoy]);
        }
        AdSpend::query()->create(['spent_on' => $hoy, 'seller_id' => $jorge->id, 'amount_cents' => 10000]);

        $this->actingAs($this->socio)->get('/dia')->assertInertia(fn (Assert $page) => $page
            ->has('ventas', 3)
            ->where('reparto.totales.ventas', 90000)
            ->where('reparto.totales.publicidad', 10000)
            ->where('reparto.totales.neto', 80000)
            // Christian: 10 % de 300 + 10 % de 500 = 30 + 50
            ->where('reparto.totales.socio', 8000)
            // Jorge: mitad de 270
            ->where('reparto.totales.vendedor', 13500)
            // Leo: 135 (mitad de Jorge) + 450 (su venta)
            ->where('reparto.totales.dueno', 58500)
            ->where('conEspacio.0.libres', 2));

        $this->actingAs($this->admin)->get('/')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('hoy.neto', 80000)
            ->where('mes.socio', 8000)
            ->where('cuentas.activas', 1)
            ->where('cuentas.espacios_libres', 2)
            ->has('serie', 30)
            ->has('porVendedorMes', 4));

        $this->actingAs($this->admin)->get("/reportes?desde={$hoy}&hasta={$hoy}")->assertInertia(fn (Assert $page) => $page
            ->component('Reportes/Index')->where('totales.dueno', 58500)->has('filas', 4)->has('serie', 1));
    }

    public function test_vendedores_y_borrado_de_cuentas_con_clientes_son_del_administrador(): void
    {
        $this->actingAs($this->socio)->get('/vendedores')->assertForbidden();
        $this->actingAs($this->admin)->get('/vendedores')->assertOk();
        $this->actingAs($this->admin)->post('/vendedores', ['name' => 'Paty'])->assertSessionHas('success');
        $this->assertTrue(Seller::query()->where('name', 'Paty')->exists());

        // El dueño no se puede dar de baja.
        $leo = $this->vendedor('Leo');
        $this->actingAs($this->admin)->put("/vendedores/{$leo->id}", ['name' => 'Leo', 'active' => false]);
        $this->assertTrue($leo->fresh()->active);

        $cuenta = $this->cuenta();
        Slot::query()->create(['account_id' => $cuenta->id, 'position' => 1, 'client_email' => 'c@gmail.com', 'price_cents' => 20000, 'seller_id' => $leo->id, 'sold_on' => Hoy::fecha()]);

        $this->actingAs($this->socio)->delete("/cuentas/{$cuenta->id}")->assertSessionHas('error');
        $this->assertNotNull($cuenta->fresh());
        $this->actingAs($this->admin)->delete("/cuentas/{$cuenta->id}")->assertSessionHas('success');
        $this->assertNull($cuenta->fresh());
    }

    public function test_el_comando_crea_usuarios_con_la_contrasena_dada(): void
    {
        putenv('ZG_PASSWORD=UnaClaveLarga123');
        try {
            $this->artisan('zengpt:usuario', ['usuario' => 'Christian2', '--rol' => 'socio', '--password-env' => true])->assertSuccessful();
        } finally {
            putenv('ZG_PASSWORD');
        }

        $this->post('/login', ['username' => 'christian2', 'password' => 'UnaClaveLarga123'])->assertRedirect('/');
        $this->assertFalse(auth()->user()->isAdmin());
    }

    public function test_la_cuenta_guarda_contrasena_cifrada_y_liga_de_2fa(): void
    {
        $this->actingAs($this->socio)->post('/cuentas', [
            'email' => 'prueba@gmail.com', 'password' => 'Clave-De-Prueba-1', 'twofa_url' => 'https://api2fa.example/abc123', 'started_on' => Hoy::fecha(),
        ])->assertSessionHasNoErrors();

        $cuenta = Account::query()->where('email', 'prueba@gmail.com')->firstOrFail();
        $this->assertSame('Clave-De-Prueba-1', $cuenta->password);
        $this->assertNotSame('Clave-De-Prueba-1', DB::table('accounts')->where('id', $cuenta->id)->value('password'));

        $this->actingAs($this->socio)->get('/cuentas')->assertInertia(fn (Assert $page) => $page
            ->where('cuentas.0.password', 'Clave-De-Prueba-1')->where('cuentas.0.twofa_url', 'https://api2fa.example/abc123'));

        $this->actingAs($this->socio)->post('/cuentas', ['email' => 'otra@gmail.com', 'twofa_url' => 'no-es-una-liga', 'started_on' => Hoy::fecha()])->assertSessionHasErrors('twofa_url');
    }

    public function test_invitacion_al_grupo_familiar_por_cliente(): void
    {
        $cuenta = $this->cuenta();
        $slot = Slot::query()->create(['account_id' => $cuenta->id, 'position' => 1, 'client_email' => 'c@gmail.com', 'price_cents' => 20000, 'seller_id' => $this->vendedor('Jorge')->id, 'sold_on' => Hoy::fecha()]);
        $this->assertSame('sin_liga', $slot->inviteStatus());

        $vence = Hoy::carbon()->addDays(7)->toDateString();
        $this->actingAs($this->socio)->put("/espacios/{$slot->id}/invitacion", ['invite_url' => 'https://families.example/join/abc', 'invite_expires_on' => $vence])->assertSessionHasNoErrors();
        $this->assertSame('lista', $slot->fresh()->inviteStatus());

        $this->actingAs($this->socio)->put("/espacios/{$slot->id}/invitacion", ['accion' => 'enviada']);
        $this->assertSame('enviada', $slot->fresh()->inviteStatus());
        $this->actingAs($this->socio)->put("/espacios/{$slot->id}/invitacion", ['accion' => 'aceptada']);
        $this->assertSame('aceptada', $slot->fresh()->inviteStatus());

        // Una liga nueva reinicia el estado; una liga vencida sin aceptar sale como caducada.
        $this->actingAs($this->socio)->put("/espacios/{$slot->id}/invitacion", ['invite_url' => 'https://families.example/join/xyz', 'invite_expires_on' => Hoy::carbon()->subDay()->toDateString()]);
        $this->assertSame('caducada', $slot->fresh()->inviteStatus());

        $this->actingAs($this->socio)->get('/cuentas')->assertInertia(fn (Assert $page) => $page->where('cuentas.0.espacios.0.invite_status', 'caducada'));
        $this->actingAs($this->socio)->put("/espacios/{$slot->id}/invitacion", ['invite_url' => 'no-es-liga'])->assertSessionHasErrors('invite_url');
    }

    public function test_correo_de_invitacion_con_boton_verde(): void
    {
        Mail::fake();
        $cuenta = $this->cuenta();
        $slot = Slot::query()->create(['account_id' => $cuenta->id, 'position' => 1, 'client_email' => 'cliente@gmail.com', 'price_cents' => 20000, 'seller_id' => $this->vendedor('Jorge')->id, 'sold_on' => Hoy::fecha()]);

        $this->actingAs($this->socio)->post("/espacios/{$slot->id}/invitacion/correo")->assertSessionHas('error');
        Mail::assertNothingSent();

        $slot->update(['invite_url' => 'https://families.example/join/abc', 'invite_expires_on' => Hoy::carbon()->addDays(7)->toDateString()]);
        $this->actingAs($this->socio)->post("/espacios/{$slot->id}/invitacion/correo")->assertSessionHas('success');

        Mail::assertSent(InvitacionGrupo::class, fn ($m) => $m->hasTo('cliente@gmail.com'));
        $this->assertSame('enviada', $slot->fresh()->inviteStatus());

        $html = (new InvitacionGrupo($slot->fresh()))->render();
        $this->assertStringContainsString('Adquiere Google One Pro por 12 meses', $html);
        $this->assertStringContainsString('href="https://families.example/join/abc"', $html);
        $this->assertStringContainsString('cliente@gmail.com', $html);
    }
}
