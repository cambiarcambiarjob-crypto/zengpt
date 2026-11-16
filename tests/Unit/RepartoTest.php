<?php

namespace Tests\Unit;

use App\Support\Reparto;
use Tests\TestCase;

class RepartoTest extends TestCase
{
    public function test_ejemplo_acordado_jorge_vende_400_con_100_de_publicidad(): void
    {
        // Neto $300 → Christian 10 % = $30 → resto $270 → Leo $135 y Jorge $135.
        $r = Reparto::calcular(40000, 10000, esDueno: false);

        $this->assertSame(['ventas' => 40000, 'publicidad' => 10000, 'costo' => 0, 'neto' => 30000, 'socio' => 3000, 'vendedor' => 13500, 'dueno' => 13500], $r);
    }

    public function test_si_vende_el_dueno_no_hay_mitad_y_mitad_pero_el_socio_cobra_su_10(): void
    {
        $r = Reparto::calcular(20000, 0, esDueno: true);

        $this->assertSame(2000, $r['socio']);
        $this->assertSame(0, $r['vendedor']);
        $this->assertSame(18000, $r['dueno']);
    }

    public function test_las_partes_siempre_suman_el_neto(): void
    {
        foreach ([[20000, 3333, false], [50000, 12345, false], [45550, 999, true], [0, 5000, false], [19999, 1, false]] as [$v, $p, $dueno]) {
            $r = Reparto::calcular($v, $p, $dueno);
            $this->assertSame($r['neto'], $r['socio'] + $r['vendedor'] + $r['dueno'], "ventas {$v}, publicidad {$p}");
        }
    }

    public function test_con_mas_publicidad_que_ventas_la_perdida_se_reparte_igual(): void
    {
        $r = Reparto::calcular(0, 10000, esDueno: false);

        $this->assertSame(-10000, $r['neto']);
        $this->assertSame(-1000, $r['socio']);
        $this->assertSame(-4500, $r['vendedor']);
        $this->assertSame(-4500, $r['dueno']);
    }
}
