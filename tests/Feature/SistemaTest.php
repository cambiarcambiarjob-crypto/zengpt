<?php

namespace Tests\Feature;

use App\Mail\InvitacionGrupo;
use App\Models\Account;
use App\Models\AdSpend;
use App\Models\Seller;
use App\Models\Slot;
use App\Models\User;
use App\Support\Hoy;
use App\Support\Presentar;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Process;
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
            // Costo de cuentas: 3 espacios × $23.40 ($117 ÷ 5).
            ->where('reparto.totales.costo', 7020)
            // Jorge: 400 − 100 − 46.80 = 253.20 · Leo: 500 − 23.40 = 476.60
            ->where('reparto.totales.neto', 72980)
            // Christian: 10 % de 253.20 + 10 % de 476.60 = 25.32 + 47.66
            ->where('reparto.totales.socio', 7298)
            // Jorge: mitad de 227.88
            ->where('reparto.totales.vendedor', 11394)
            // Leo: 113.94 (mitad de Jorge) + 428.94 (su venta)
            ->where('reparto.totales.dueno', 54288)
            ->where('conEspacio.0.libres', 2));

        $this->actingAs($this->admin)->get('/')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')
            ->where('hoy.neto', 72980)
            ->where('mes.socio', 7298)
            ->where('cuentas.activas', 1)
            ->where('cuentas.espacios_libres', 2)
            ->has('serie', 30)
            ->has('porVendedorMes', 4));

        $this->actingAs($this->admin)->get("/reportes?desde={$hoy}&hasta={$hoy}")->assertInertia(fn (Assert $page) => $page
            ->component('Reportes/Index')->where('totales.dueno', 54288)->has('filas', 4)->has('serie', 1));
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

    public function test_al_agregar_cliente_se_puede_guardar_ya_su_liga(): void
    {
        $cuenta = $this->cuenta();
        $base = ['price' => 200, 'seller_id' => $this->vendedor('Jorge')->id, 'sold_on' => Hoy::fecha()];

        $this->actingAs($this->socio)->post("/cuentas/{$cuenta->id}/espacios", $base + ['client_email' => 'con@gmail.com', 'invite_url' => 'https://families.example/join/a1'])->assertSessionHasNoErrors();
        $con = Slot::query()->where('client_email', 'con@gmail.com')->firstOrFail();
        $this->assertSame('lista', $con->inviteStatus());
        $this->assertSame(Hoy::carbon()->addDays(7)->toDateString(), $con->invite_expires_on->toDateString());

        $this->actingAs($this->socio)->post("/cuentas/{$cuenta->id}/espacios", $base + ['client_email' => 'sin@gmail.com', 'invite_url' => ''])->assertSessionHasNoErrors();
        $this->assertSame('sin_liga', Slot::query()->where('client_email', 'sin@gmail.com')->firstOrFail()->inviteStatus());

        $this->actingAs($this->socio)->post("/cuentas/{$cuenta->id}/espacios", $base + ['client_email' => 'mal@gmail.com', 'invite_url' => 'no-es-liga'])->assertSessionHasErrors('invite_url');
    }

    public function test_las_ligas_se_capturan_en_la_cuenta_y_cada_cliente_toma_la_de_su_espacio(): void
    {
        $vence = Hoy::carbon()->addDays(5)->toDateString();
        $this->actingAs($this->socio)->post('/cuentas', [
            'email' => 'familia@gmail.com', 'started_on' => Hoy::fecha(),
            'invite_links' => ['1' => ['url' => 'https://families.example/join/uno', 'expires_on' => $vence], '2' => ['url' => 'https://families.example/join/dos'], '3' => ['url' => '']],
        ])->assertSessionHasNoErrors();
        $cuenta = Account::query()->where('email', 'familia@gmail.com')->firstOrFail();
        $this->assertSame([1, 2], array_keys($cuenta->invite_links));

        $base = ['price' => 200, 'seller_id' => $this->vendedor('Jorge')->id, 'sold_on' => Hoy::fecha()];
        foreach (['a', 'b', 'c'] as $n) {
            $this->actingAs($this->socio)->post("/cuentas/{$cuenta->id}/espacios", $base + ['client_email' => "{$n}@gmail.com"])->assertSessionHasNoErrors();
        }
        $slots = $cuenta->slots()->get()->keyBy('position');
        $this->assertSame('https://families.example/join/uno', $slots[1]->invite_url);
        $this->assertSame($vence, $slots[1]->invite_expires_on->toDateString());
        $this->assertSame('https://families.example/join/dos', $slots[2]->invite_url);
        $this->assertSame(Hoy::carbon()->addDays(7)->toDateString(), $slots[2]->invite_expires_on->toDateString());
        $this->assertSame('sin_liga', $slots[3]->inviteStatus());

        // El cliente 1 ya recibió la invitación y el 2 ya aceptó; luego se pegan ligas nuevas en la cuenta.
        $slots[1]->update(['invite_sent_at' => now()]);
        $slots[2]->update(['invite_accepted_at' => now()]);
        $this->actingAs($this->socio)->put("/cuentas/{$cuenta->id}", [
            'email' => 'familia@gmail.com', 'started_on' => Hoy::fecha(),
            'invite_links' => ['1' => ['url' => 'https://families.example/join/uno-nueva'], '2' => ['url' => 'https://families.example/join/dos-nueva'], '3' => ['url' => 'https://families.example/join/tres']],
        ])->assertSessionHasNoErrors();

        $slots = $cuenta->slots()->get()->keyBy('position');
        $this->assertSame('https://families.example/join/uno-nueva', $slots[1]->invite_url);
        $this->assertSame('lista', $slots[1]->inviteStatus(), 'liga nueva: hay que volver a enviarla');
        $this->assertSame('https://families.example/join/dos', $slots[2]->invite_url, 'el que ya aceptó no se toca');
        $this->assertSame('https://families.example/join/tres', $slots[3]->invite_url);

        $this->actingAs($this->socio)->get('/cuentas')->assertInertia(fn (Assert $page) => $page
            ->where('cuentas.0.invite_links.0.url', 'https://families.example/join/uno-nueva')
            ->where('cuentas.0.invite_links.4.url', null));

        $this->actingAs($this->socio)->put("/cuentas/{$cuenta->id}", ['email' => 'familia@gmail.com', 'started_on' => Hoy::fecha(), 'invite_links' => ['1' => ['url' => 'no-es-liga']]])
            ->assertSessionHasErrors('invite_links.1.url');
    }

    public function test_un_cliente_pendiente_de_pago_no_cuenta_hasta_que_paga(): void
    {
        $hoy = Hoy::fecha();
        $ayer = Hoy::carbon()->subDay()->toDateString();
        $cuenta = $this->cuenta();
        $jorge = $this->vendedor('Jorge');

        // Uno pagado y uno que ya está dentro pero aún no transfiere (ambos vendidos ayer).
        Slot::query()->create(['account_id' => $cuenta->id, 'position' => 1, 'client_email' => 'paga@gmail.com', 'price_cents' => 20000, 'seller_id' => $jorge->id, 'sold_on' => $ayer]);
        $this->actingAs($this->socio)->post("/cuentas/{$cuenta->id}/espacios", [
            'client_email' => 'debe@gmail.com', 'price' => 400, 'seller_id' => $jorge->id, 'sold_on' => $ayer, 'pendiente' => true,
        ])->assertSessionHasNoErrors();
        $debe = Slot::query()->where('client_email', 'debe@gmail.com')->firstOrFail();
        $this->assertNull($debe->paid_on);

        $this->actingAs($this->socio)->get("/dia/{$ayer}")->assertInertia(fn (Assert $page) => $page->where('reparto.totales.ventas', 20000));
        $this->actingAs($this->admin)->get('/')->assertInertia(fn (Assert $page) => $page
            ->where('cuentas.pendientes_pago', 1)
            ->where('cuentas.pendiente_monto', 40000)
            ->where('cuentas.espacios_libres', 3));
        $this->actingAs($this->admin)->get('/cuentas?estado=por_cobrar')->assertInertia(fn (Assert $page) => $page->has('cuentas', 1));

        // Paga hoy: cuenta en las ventas de hoy (fecha de pago), no en las de ayer.
        $this->actingAs($this->socio)->put("/espacios/{$debe->id}/pago", ['pagado' => true])->assertSessionHasNoErrors();
        $this->assertSame($hoy, $debe->fresh()->paid_on->toDateString());
        $this->actingAs($this->socio)->get("/dia/{$ayer}")->assertInertia(fn (Assert $page) => $page->where('reparto.totales.ventas', 20000));
        $this->actingAs($this->socio)->get("/dia/{$hoy}")->assertInertia(fn (Assert $page) => $page->where('reparto.totales.ventas', 40000));
        $this->actingAs($this->admin)->get('/')->assertInertia(fn (Assert $page) => $page->where('cuentas.pendientes_pago', 0));
    }

    public function test_revisar_el_grupo_en_google_marca_a_cada_cliente(): void
    {
        config(['zengpt.google.cuentas' => ['admin.grupo@gmail.com']]);
        $cuenta = $this->cuenta(['email' => 'admin.grupo@gmail.com']);
        $otra = $this->cuenta();
        $jorge = $this->vendedor('Jorge');
        foreach (['dentro@gmail.com', 'pendiente@gmail.com', 'fuera@gmail.com'] as $i => $correo) {
            Slot::query()->create(['account_id' => $cuenta->id, 'position' => $i + 1, 'client_email' => $correo, 'price_cents' => 20000, 'seller_id' => $jorge->id, 'sold_on' => Hoy::fecha(), 'invite_accepted_at' => $correo === 'fuera@gmail.com' ? now() : null]);
        }

        Process::fake(['*' => Process::result(json_encode([
            'ok' => true, 'admin' => 'admin.grupo@gmail.com',
            'miembros' => [['email' => 'admin.grupo@gmail.com', 'nombre' => 'Admin', 'admin' => true], ['email' => 'dentro@gmail.com', 'nombre' => 'Ana', 'admin' => false], ['email' => 'colado@gmail.com', 'nombre' => 'X', 'admin' => false]],
            'invitaciones' => [['email' => 'pendiente@gmail.com', 'caduca' => '30 nov']],
        ]))]);

        $this->assertTrue(Presentar::cuenta($cuenta->load('slots'))['google']['conectada']);
        $this->assertFalse(Presentar::cuenta($otra->load('slots'))['google']['conectada']);

        $this->actingAs($this->socio)->post("/cuentas/{$cuenta->id}/google")->assertSessionHas('success');
        Process::assertRan(fn ($proceso) => in_array('leer', (array) $proceso->command, true));

        $estado = Slot::query()->where('account_id', $cuenta->id)->pluck('google_status', 'client_email');
        $this->assertSame('miembro', $estado['dentro@gmail.com']);
        $this->assertSame('invitado', $estado['pendiente@gmail.com']);
        $this->assertSame('ausente', $estado['fuera@gmail.com']);
        $this->assertSame('aceptada', Slot::query()->where('client_email', 'dentro@gmail.com')->first()->inviteStatus());
        $this->assertNull(Slot::query()->where('client_email', 'fuera@gmail.com')->first()->invite_accepted_at);
        // Quien está en Google pero no en el sistema se da de alta solo: sin precio ni vendedor y pendiente de pago.
        $colado = Slot::query()->where('client_email', 'colado@gmail.com')->firstOrFail();
        $this->assertSame([$cuenta->id, 4, 0, null, null, 'google', 'miembro'], [$colado->account_id, $colado->position, $colado->price_cents, $colado->seller_id, $colado->paid_on, $colado->origen, $colado->google_status]);
        $this->assertSame([], $cuenta->fresh()->google_extra);

        // No se puede marcar pagado sin vendedor; al editarlo, precio y vendedor no son obligatorios.
        $this->actingAs($this->socio)->put("/espacios/{$colado->id}/pago", ['pagado' => true])->assertSessionHas('error');
        $this->assertNull($colado->fresh()->paid_on);
        $this->actingAs($this->socio)->put("/espacios/{$colado->id}", ['client_email' => 'colado@gmail.com', 'price' => '', 'seller_id' => '', 'sold_on' => Hoy::fecha(), 'pendiente' => true])->assertSessionHasNoErrors();
        $this->actingAs($this->socio)->put("/espacios/{$colado->id}", ['client_email' => 'colado@gmail.com', 'price' => 400, 'seller_id' => $jorge->id, 'sold_on' => Hoy::fecha(), 'pendiente' => true])->assertSessionHasNoErrors();
        $this->actingAs($this->socio)->put("/espacios/{$colado->id}/pago", ['pagado' => true])->assertSessionHas('success');
        $this->assertSame(40000, $colado->fresh()->price_cents);
        // Un cliente capturado a mano sí exige precio y vendedor.
        $fuera = Slot::query()->where('client_email', 'fuera@gmail.com')->first();
        $this->actingAs($this->socio)->put("/espacios/{$fuera->id}", ['client_email' => 'fuera@gmail.com', 'price' => '', 'seller_id' => '', 'sold_on' => Hoy::fecha()])->assertSessionHasErrors(['price', 'seller_id']);

        // Invitar y sacar desde el sistema (con la sesión de esa cuenta).
        Process::fake(['*' => Process::result(json_encode(['ok' => true, 'invitado' => 'fuera@gmail.com']))]);
        $this->actingAs($this->socio)->post("/espacios/{$fuera->id}/google")->assertSessionHas('success');
        Process::assertRan(fn ($proceso) => array_slice((array) $proceso->command, -2) === ['invitar', 'fuera@gmail.com']);
        $this->assertSame('invitado', $fuera->fresh()->google_status);
        Process::fake(['*' => Process::result(json_encode(['ok' => true, 'sacado' => 'fuera@gmail.com', 'era' => 'invitacion']))]);
        $this->actingAs($this->socio)->delete("/espacios/{$fuera->id}/google")->assertSessionHas('success');
        Process::assertRan(fn ($proceso) => array_slice((array) $proceso->command, -2) === ['sacar', 'fuera@gmail.com']);
        $this->assertNull($fuera->fresh()); // sacarlo de Google también libera su espacio

        // Si Google ya no lo tenía, igual se libera el espacio.
        Process::fake(['*' => Process::result(json_encode(['ok' => false, 'error' => 'no_encontrado']), exitCode: 1)]);
        $pendiente = Slot::query()->where('client_email', 'pendiente@gmail.com')->first();
        $this->actingAs($this->socio)->delete("/espacios/{$pendiente->id}/google")->assertSessionHas('success');
        $this->assertNull($pendiente->fresh());

        // Alta con «invitar en Google al guardar».
        Process::fake(['*' => Process::result(json_encode(['ok' => true, 'invitado' => 'nuevo@gmail.com']))]);
        $this->actingAs($this->socio)->post("/cuentas/{$cuenta->id}/espacios", ['client_email' => 'nuevo@gmail.com', 'price' => 200, 'seller_id' => $jorge->id, 'sold_on' => Hoy::fecha(), 'invitar_google' => true])->assertSessionHas('success');
        $this->assertSame('invitado', Slot::query()->where('client_email', 'nuevo@gmail.com')->first()->google_status);

        // Cuenta sin sesión en el servidor, o sesión de otra cuenta: no toca nada.
        $this->actingAs($this->socio)->post("/cuentas/{$otra->id}/google")->assertSessionHas('error');
        config(['zengpt.google.cuentas' => ['admin.grupo@gmail.com', $otra->email]]);
        $this->actingAs($this->socio)->post("/cuentas/{$otra->id}/google")->assertSessionHas('error');
        $this->assertNull($otra->fresh()->google_synced_at);

        // Google cerró la sesión: aviso claro.
        Process::fake(['*' => Process::result(json_encode(['ok' => false, 'error' => 'sin_sesion']), exitCode: 1)]);
        $this->actingAs($this->socio)->post("/cuentas/{$cuenta->id}/google")->assertSessionHas('error', 'Google cerró la sesión del servidor: entra con «Iniciar sesión (visor)» en la cuenta.');
    }

    public function test_el_visor_de_google_es_solo_del_administrador(): void
    {
        config(['zengpt.google.cuentas' => ['admin.grupo@gmail.com']]);
        $cuenta = $this->cuenta(['email' => 'admin.grupo@gmail.com', 'password' => 'clave-de-prueba', 'twofa_url' => 'https://api2fa.com/GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ']);
        $otra = $this->cuenta();

        // nginx pregunta a /zenbot/autorizar: sin sesión o socio → 403; administrador → 204.
        $this->get('/zenbot/autorizar')->assertForbidden();
        $this->actingAs($this->socio)->get('/zenbot/autorizar')->assertForbidden();
        $this->actingAs($this->admin)->get('/zenbot/autorizar')->assertNoContent();

        $this->actingAs($this->socio)->get("/google/visor/{$cuenta->id}")->assertForbidden();
        // Cada cuenta tiene su propio visor, aunque todavía no esté conectada.
        $this->actingAs($this->admin)->get("/google/visor/{$otra->id}")->assertOk()->assertSee($otra->email);
        $this->actingAs($this->admin)->get("/google/visor/{$cuenta->id}")->assertOk()->assertSee('admin.grupo@gmail.com')->assertSee('Pegar en el visor')->assertHeader('Cache-Control', 'no-store, private');

        $codigo = $this->actingAs($this->admin)->getJson("/google/visor/{$cuenta->id}/codigo")->assertOk()->json();
        $this->assertMatchesRegularExpression('/^\d{6}$/', $codigo['codigo']);
        $this->actingAs($this->socio)->getJson("/google/visor/{$cuenta->id}/codigo")->assertForbidden();
    }

    public function test_al_terminar_en_el_visor_la_cuenta_queda_conectada_y_se_cierra_su_chrome(): void
    {
        $cuenta = $this->cuenta(['email' => 'nueva.cuenta@gmail.com']);
        $this->assertFalse(Presentar::cuenta($cuenta->load('slots'))['google']['conectada']);

        // Abrir el visor arranca el Chrome de ESA cuenta (ZENBOT_ADMIN = su correo).
        Process::fake(['*' => Process::result(json_encode(['ok' => true, 'sesion' => false]))]);
        $this->actingAs($this->admin)->postJson("/google/visor/{$cuenta->id}/login")->assertOk()->assertJson(['ok' => true, 'sesion' => false]);
        Process::assertRan(fn ($p) => in_array('abrir', (array) $p->command, true) && ($p->environment['ZENBOT_ADMIN'] ?? null) === 'nueva.cuenta@gmail.com');

        // «Ya inicié sesión»: revisa el grupo, marca la cuenta conectada y cierra su Chrome.
        Process::fake(['*' => Process::result(json_encode(['ok' => true, 'admin' => 'nueva.cuenta@gmail.com', 'miembros' => [['email' => 'nueva.cuenta@gmail.com', 'admin' => true]], 'invitaciones' => []]))]);
        $this->actingAs($this->admin)->post("/google/visor/{$cuenta->id}/listo")->assertRedirect('/cuentas');
        Process::assertRan(fn ($p) => in_array('leer', (array) $p->command, true));
        Process::assertRan(fn ($p) => in_array('cerrar', (array) $p->command, true));
        $this->assertTrue($cuenta->fresh()->google_conectada);

        // Si Google no dejó la sesión, no queda conectada.
        $otra = $this->cuenta(['email' => 'otra.cuenta@gmail.com']);
        Process::fake(['*' => Process::result(json_encode(['ok' => false, 'error' => 'sin_sesion']), exitCode: 1)]);
        $this->actingAs($this->admin)->post("/google/visor/{$otra->id}/listo")->assertSessionHas('error');
        $this->assertFalse($otra->fresh()->google_conectada);
    }
}
