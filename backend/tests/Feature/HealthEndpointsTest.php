<?php

namespace Tests\Feature;

use App\Services\HealthDependencies;
use Mockery\MockInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class HealthEndpointsTest extends TestCase
{
    public function test_public_liveness_ignores_dependencies_and_stateful_headers(): void
    {
        config(['session.driver' => 'database', 'database.default' => 'unconfigured']);
        $this->mock(HealthDependencies::class, function (MockInterface $probe): void {
            $probe->shouldNotReceive('postgres', 'redis');
        });

        $this->get('/api/health/live', [
            'Origin' => 'http://localhost',
            'Cookie' => 'techops_session=invalid-session',
        ])->assertOk()
            ->assertHeader('Content-Type', 'application/json')
            ->assertHeaderMissing('Set-Cookie')
            ->assertExactJson(['status' => 'ok'])
            ->assertHeaderContains('Cache-Control', 'no-store');
    }

    #[DataProvider('dependencyStates')]
    public function test_public_readiness_reports_each_dependency(bool $postgres, bool $redis): void
    {
        config(['app.debug' => true, 'session.driver' => 'database', 'database.default' => 'unconfigured']);
        $this->mock(HealthDependencies::class, function (MockInterface $probe) use ($postgres, $redis): void {
            $database = $probe->shouldReceive('postgres')->once();
            if ($postgres) {
                $database->andReturn(true);
            } else {
                $database->andThrow(new RuntimeException('postgresql://test:secret@private.internal'));
            }

            $probe->shouldReceive('redis')->once()->andReturn($redis);
        });

        $healthy = $postgres && $redis;
        $this->get('/api/health/ready', ['Origin' => 'http://localhost'])
            ->assertStatus($healthy ? 200 : 503)
            ->assertHeader('Content-Type', 'application/json')
            ->assertHeaderMissing('Set-Cookie')
            ->assertHeaderContains('Cache-Control', 'no-store')
            ->assertExactJson([
                'status' => $healthy ? 'ok' : 'unavailable',
                'checks' => [
                    'postgres' => $postgres ? 'ok' : 'unavailable',
                    'redis' => $redis ? 'ok' : 'unavailable',
                ],
            ])->assertDontSee('secret')->assertDontSee('private.internal')->assertDontSee('RuntimeException');
    }

    public static function dependencyStates(): array
    {
        return [
            'healthy' => [true, true],
            'database unavailable' => [false, true],
            'redis unavailable' => [true, false],
            'both unavailable' => [false, false],
        ];
    }

    public function test_redis_exception_is_sanitized(): void
    {
        config(['app.debug' => true]);
        $this->mock(HealthDependencies::class, function (MockInterface $probe): void {
            $probe->shouldReceive('postgres')->once()->andReturn(true);
            $probe->shouldReceive('redis')->once()->andThrow(new RuntimeException('redis://private-secret@redis.internal'));
        });

        $this->get('/api/health/ready')->assertServiceUnavailable()
            ->assertExactJson(['status' => 'unavailable', 'checks' => ['postgres' => 'ok', 'redis' => 'unavailable']])
            ->assertDontSee('private-secret');
    }
}

