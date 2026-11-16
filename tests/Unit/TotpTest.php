<?php

namespace Tests\Unit;

use App\Support\Totp;
use PHPUnit\Framework\TestCase;

class TotpTest extends TestCase
{
    public function test_coincide_con_los_vectores_del_rfc_6238(): void
    {
        // Clave «12345678901234567890» en base32.
        foreach ([59 => '287082', 1111111109 => '081804', 1234567890 => '005924', 2000000000 => '279037'] as $t => $esperado) {
            $this->assertSame($esperado, Totp::codigo('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', $t));
        }
        $this->assertSame('287082', Totp::codigo('gezd gnbv gy3t qojq gezd gnbv gy3t qojq', 59));
        $this->assertNull(Totp::codigo(''));
        $this->assertSame(1, Totp::restante(59));
    }
}
