<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\AdSpend;
use App\Models\Seller;
use App\Models\Slot;
use App\Models\User;
use App\Support\Hoy;
use Illuminate\Database\Seeder;

/**
 * Datos de demostración SOLO para desarrollo (no se llama desde DatabaseSeeder):
 *
 *   php artisan db:seed --class=DemoSeeder
 *
 * Crea los usuarios «leo» (admin) y «christian» (socio) con contraseña «demo-zengpt-2026», 14 cuentas
 * (10 vigentes con 0 a 5 espacios, 2 por vencer y 2 vencidas), 49 espacios vendidos en los últimos 40 días
 * entre los 4 vendedores y publicidad de varios días por vendedor. Todas las fechas son relativas a
 * App\Support\Hoy, y se puede correr varias veces sin duplicar nada.
 */
class DemoSeeder extends Seeder
{
    public const PASSWORD = 'demo-zengpt-2026';

    /** Precios en pesos: los sugeridos y algunos personalizados (uno con centavos). */
    private const PRECIOS = [400, 200, 500, 400, 350, 200, 500, 400, 450, 200, 400, 500, 380.5, 400, 200, 500, 300];

    private const CLIENTES = [
        'ana.torres', 'luis.mendoza', 'karla.rios', 'diego.salas', 'fernanda.lopez', 'marco.duran', 'sofia.nunez', 'ricardo.pena',
        'valeria.cruz', 'hector.vega', 'paola.ortiz', 'emilio.castro', 'daniela.rojas', 'oscar.leon', 'mariana.gil', 'javier.soto',
        'camila.reyes', 'andres.luna', 'renata.mora', 'pablo.aguirre', 'ximena.flores', 'raul.campos', 'lucia.ibarra', 'sergio.meza',
        'natalia.pineda', 'adrian.cano', 'regina.solis', 'bruno.avila', 'elena.zamora', 'tomas.bravo', 'abril.carrillo', 'mateo.fuentes',
        'jimena.acosta', 'ivan.cordero', 'alicia.montes', 'gael.navarro', 'monica.trejo', 'saul.arias', 'carla.esquivel', 'noe.galindo',
        'irene.barrera', 'felipe.osorio', 'miranda.tapia', 'ruben.cisneros', 'pamela.villa', 'ulises.rangel', 'diana.sandoval', 'erick.maldonado',
        'laura.quintero', 'alan.becerra', 'brenda.figueroa', 'cesar.olvera',
    ];

    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->error('DemoSeeder es solo para desarrollo: no se ejecuta en producción.');

            return;
        }

        $this->call(DatabaseSeeder::class);

        $leo = User::query()->updateOrCreate(['username' => 'leo'], ['name' => 'Leo', 'role' => User::ROLE_ADMIN, 'email' => 'leo@zengpt.local', 'password' => self::PASSWORD]);
        User::query()->updateOrCreate(['username' => 'christian'], ['name' => 'Christian', 'role' => User::ROLE_SOCIO, 'email' => 'christian@zengpt.local', 'password' => self::PASSWORD]);

        $vendedores = Seller::query()->ordered()->get()->values();
        $hoy = Hoy::carbon();
        $meses = (int) config('zengpt.meses_cuenta', 3);
        $n = 0;

        // [correo, días desde que inició (null si se define por vencimiento), días para vencer (negativo = ya venció), ventas: «hace cuántos días» de cada espacio]
        $cuentas = [
            ['zen.equipo01@gmail.com', 1, null, []],
            ['zen.equipo02@gmail.com', 3, null, [1, 0]],
            ['zen.equipo03@gmail.com', 6, null, [6, 5, 3, 1, 0]],
            ['zen.equipo04@gmail.com', 9, null, [8, 4, 0]],
            ['zen.equipo05@gmail.com', 13, null, [13, 11, 7, 2]],
            ['zen.equipo06@gmail.com', 18, null, [18, 17, 14, 12, 10]],
            ['zen.equipo07@gmail.com', 22, null, [20]],
            ['zen.equipo08@gmail.com', 27, null, [27, 26, 23, 21, 16]],
            ['zen.equipo09@gmail.com', 33, null, [32, 30, 25, 9]],
            ['zen.equipo10@gmail.com', 38, null, [38, 37, 34, 31, 28]],
            // Por vencer (menos de 14 días)
            ['zen.equipo11@gmail.com', null, 4, [39, 36, 29, 24, 15]],
            ['zen.equipo12@gmail.com', null, 11, [35, 22, 19]],
            // Vencidas
            ['zen.equipo13@gmail.com', null, -6, [40, 33, 28, 12]],
            ['zen.equipo14@gmail.com', null, -21, [40, 36, 30]],
        ];

        foreach ($cuentas as [$correo, $iniciada, $vence, $ventas]) {
            $inicio = $iniciada !== null
                ? $hoy->copy()->subDays($iniciada)
                : $hoy->copy()->addDays($vence)->subMonthsNoOverflow($meses);
            $fin = $iniciada !== null
                ? $inicio->copy()->addMonthsNoOverflow($meses)
                : $hoy->copy()->addDays($vence);

            $cuenta = Account::query()->updateOrCreate(['email' => $correo], [
                'started_on' => $inicio->toDateString(),
                'expires_on' => $fin->toDateString(),
                'notes' => match ($correo) {
                    'zen.equipo03@gmail.com' => 'Cuenta llena. Renovar con la misma tarjeta.',
                    'zen.equipo11@gmail.com' => 'Avisar a los clientes antes de que venza.',
                    default => null,
                },
                'created_by' => $leo->id,
            ]);

            foreach ($ventas as $i => $haceDias) {
                $vendedor = $vendedores[$n % $vendedores->count()];
                $cliente = self::CLIENTES[$n % count(self::CLIENTES)];

                Slot::query()->updateOrCreate(['account_id' => $cuenta->id, 'position' => $i + 1], [
                    'client_email' => $cliente.($n >= count(self::CLIENTES) ? $n : '').'@gmail.com',
                    'client_phone' => $n % 5 < 3 ? sprintf('614 555 %04d', 100 + $n * 7) : null,
                    'price_cents' => (int) round(self::PRECIOS[$n % count(self::PRECIOS)] * 100),
                    'seller_id' => $vendedor->id,
                    'sold_on' => $hoy->copy()->subDays($haceDias)->toDateString(),
                    'created_by' => $leo->id,
                ]);
                $n++;
            }

            // Si se vuelve a sembrar, no deja espacios de una corrida anterior con otra forma.
            Slot::query()->where('account_id', $cuenta->id)->where('position', '>', count($ventas))->delete();
        }

        // Publicidad: cada vendedor invierte con su propio ritmo durante los últimos 40 días (hoy incluido).
        $ritmos = [[2, 0, 150], [3, 0, 100], [4, 1, 80], [5, 2, 120]];

        foreach ($vendedores as $v => $vendedor) {
            [$cada, $desfase, $base] = $ritmos[$v % count($ritmos)];

            for ($dia = 0; $dia < 40; $dia++) {
                if ($dia % $cada !== $desfase) {
                    continue;
                }

                $fecha = $hoy->copy()->subDays($dia)->toDateString();
                $monto = ($base + ($dia % 3) * 50) * 100;
                $gasto = AdSpend::query()->whereDate('spent_on', $fecha)->where('seller_id', $vendedor->id)->first();

                $gasto
                    ? $gasto->update(['amount_cents' => $monto, 'updated_by' => $leo->id])
                    : AdSpend::query()->create(['spent_on' => $fecha, 'seller_id' => $vendedor->id, 'amount_cents' => $monto, 'updated_by' => $leo->id]);
            }
        }

        $this->command?->info('Demo lista: usuarios «leo» (admin) y «christian» (socio), contraseña «'.self::PASSWORD.'».');
    }
}
