<?php

// Optional offline checks; requires the existing backend development dependencies.
require dirname(__DIR__, 2).'/backend/vendor/autoload.php';

use Symfony\Component\Yaml\Yaml;

$check = static function (bool $condition, string $message): void {
    if (! $condition) {
        throw new RuntimeException($message);
    }
};

try {
    $check(class_exists(Yaml::class), 'Install backend development dependencies for this optional offline checker.');
    $input = stream_get_contents(STDIN);
    $check(trim($input) !== '', 'Pipe kubectl kustomize deploy/k8s into this checker.');
    $resources = [];
    foreach (preg_split('/^---[ \t]*\r?$/m', $input) as $document) {
        if (trim($document) === '') {
            continue;
        }
        $resource = Yaml::parse($document);
        $kind = $resource['kind'];
        $name = $resource['metadata']['name'];
        $check($kind !== 'Secret', 'Rendered manifests must never contain secret material.');
        $check($kind === 'Namespace' ? $name === 'techops-learning' : ($resource['metadata']['namespace'] ?? null) === 'techops-learning', 'Unexpected namespace.');
        $check(! isset($resources[$kind.':'.$name]), 'Duplicate resource: '.$kind.':'.$name);
        $resources[$kind.':'.$name] = $resource;
        if ($kind === 'Service') {
            $check(($resource['spec']['type'] ?? 'ClusterIP') === 'ClusterIP', 'Services must remain internal.');
        }
        $pod = match ($kind) {
            'Deployment', 'StatefulSet', 'Job' => $resource['spec']['template']['spec'],
            'CronJob' => $resource['spec']['jobTemplate']['spec']['template']['spec'],
            default => null,
        };
        if ($pod) {
            $check(($pod['automountServiceAccountToken'] ?? true) === false, 'Unneeded API token mounted in '.$name);
            foreach ($pod['containers'] as $container) {
                foreach (['requests', 'limits'] as $boundary) {
                    foreach (['cpu', 'memory'] as $metric) {
                        $check(isset($container['resources'][$boundary][$metric]), 'Missing '.$boundary.' '.$metric.' for '.$name);
                    }
                }
                if (str_starts_with($container['image'], 'techops-k8s-')) {
                    $check(($container['imagePullPolicy'] ?? '') === 'Never', 'Local image must never be pulled from a registry.');
                }
                if (in_array($kind, ['Deployment', 'StatefulSet'], true)) {
                    foreach (['startupProbe', 'readinessProbe', 'livenessProbe'] as $probe) {
                        $check(isset($container[$probe]), 'Missing '.$probe.' for '.$name);
                    }
                }
            }
        }
    }
    $config = $resources['ConfigMap:techops-config']['data'];
    foreach ([
        'DB_DATABASE' => 'techops_learning', 'DB_HOST' => 'postgres',
        'SESSION_DRIVER' => 'database', 'QUEUE_CONNECTION' => 'database',
        'CACHE_STORE' => 'database', 'OPERATIONS_CACHE_STORE' => 'redis',
        'REDIS_CLIENT' => 'phpredis', 'REDIS_HOST' => 'redis', 'MAIL_MAILER' => 'log',
        'APP_URL' => 'http://127.0.0.1:8080', 'FRONTEND_URL' => 'http://127.0.0.1:8080',
        'SANCTUM_STATEFUL_DOMAINS' => '127.0.0.1:8080',
    ] as $key => $value) {
        $check(($config[$key] ?? null) === $value, 'Unexpected learning setting: '.$key);
    }
    foreach (['APP_KEY', 'DB_PASSWORD', 'ADMIN_PASSWORD', 'MAIL_PASSWORD'] as $key) {
        $check(! isset($config[$key]), 'A secret was placed in public configuration.');
    }
    foreach (['backend', 'frontend'] as $name) {
        $check($resources['Deployment:'.$name]['spec']['replicas'] === 0, 'Application must wait for bootstrap.');
    }
    $cron = $resources['CronJob:scheduler']['spec'];
    $check($cron['suspend'] === true && $cron['concurrencyPolicy'] === 'Forbid', 'Unsafe scheduler startup policy.');
    $check($cron['schedule'] === '* * * * *' && $cron['timeZone'] === 'Asia/Kuala_Lumpur', 'Scheduler cadence/time zone changed.');
    $pvc = $resources['PersistentVolumeClaim:techops-postgres-data']['spec'];
    $check($pvc['resources']['requests']['storage'] === '5Gi', 'Unexpected PVC size.');
    $check($pvc['accessModes'] === ['ReadWriteOnce'], 'Unexpected PVC access mode.');
    $jobs = array_filter($resources, static fn ($resource) => $resource['kind'] === 'Job');
    $check(count($jobs) === 1 && array_values($jobs)[0]['spec']['suspend'] === true, 'Bootstrap must be suspended before dependencies are ready.');
    $check(count($resources) === 16, 'Unexpected resource count; review and update the isolation checks if intentional.');
    fwrite(STDOUT, 'Validated '.count($resources)." rendered resources: isolation, bootstrap gates, probes, limits, storage and configuration.\n");
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage().PHP_EOL);
    exit(1);
}
