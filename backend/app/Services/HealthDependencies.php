<?php

namespace App\Services;

use Illuminate\Redis\RedisManager;
use Illuminate\Support\ConfigurationUrlParser;
use PgSql\Connection;

class HealthDependencies
{
    private const POSTGRES_BUDGET_NS = 1_500_000_000;

    public function postgres(): bool
    {
        if (! extension_loaded('pgsql')) {
            return false;
        }

        $deadline = hrtime(true) + self::POSTGRES_BUDGET_NS;
        $settings = (new ConfigurationUrlParser)->parseConfiguration(config('database.connections.pgsql'));
        $parameters = [
            'host' => $settings['host'],
            'port' => $settings['port'],
            'dbname' => $settings['database'],
            'user' => $settings['username'],
            'password' => $settings['password'],
            'sslmode' => $settings['sslmode'] ?? 'prefer',
            'options' => '-c statement_timeout=1000',
        ];

        foreach (['sslrootcert', 'sslcert', 'sslkey', 'sslcrl'] as $key) {
            if (! empty($settings[$key])) {
                $parameters[$key] = $settings[$key];
            }
        }

        $parts = [];
        foreach ($parameters as $key => $value) {
            $parts[] = $key."='".str_replace(["\\", "'"], ["\\\\", "\\'"], (string) $value)."'";
        }

        $connection = @pg_connect(implode(' ', $parts), PGSQL_CONNECT_ASYNC | PGSQL_CONNECT_FORCE_NEW);
        if ($connection === false) {
            return false;
        }

        try {
            if (! $this->waitForConnection($connection, $deadline)) {
                return false;
            }

            $sent = @pg_send_query($connection, 'SELECT 1');
            while ($sent === 0 && $this->waitForSocket($connection, $deadline, true)) {
                $sent = @pg_flush($connection);
            }
            if ($sent !== true) {
                return false;
            }

            while (@pg_connection_busy($connection)) {
                if (! $this->waitForSocket($connection, $deadline) || ! @pg_consume_input($connection)) {
                    return false;
                }
            }

            $result = @pg_get_result($connection);

            return hrtime(true) <= $deadline && $result !== false
                && pg_result_status($result) === PGSQL_TUPLES_OK
                && pg_fetch_result($result, 0, 0) === '1';
        } finally {
            @pg_close($connection);
        }
    }

    public function redis(): bool
    {
        if (config('database.redis.client') !== 'phpredis' || ! extension_loaded('redis')) {
            return false;
        }

        // Parse URLs before applying probe limits so URL options cannot override them.
        $settings = (new ConfigurationUrlParser)->parseConfiguration(config('database.redis.cache'));
        $limits = ['timeout' => 0.3, 'read_timeout' => 0.3, 'persistent' => false, 'max_retries' => 0];
        $settings['options'] = array_replace($settings['options'] ?? [], $limits);
        $manager = new RedisManager(app(), 'phpredis', ['probe' => $settings]);
        $connection = @$manager->connection('probe');

        try {
            // Call the client directly so the Laravel connection cannot retry PING.
            $reply = @$connection->client()->ping();

            return in_array($reply, [true, 'PONG', '+PONG'], true);
        } finally {
            @$connection->disconnect();
        }
    }

    private function waitForConnection(Connection $connection, int $deadline): bool
    {
        // libpq starts an async connect waiting for its socket to become writable.
        $state = PGSQL_POLLING_WRITING;
        while (in_array($state, [PGSQL_POLLING_READING, PGSQL_POLLING_WRITING], true)) {
            if (! $this->waitForSocket($connection, $deadline, $state === PGSQL_POLLING_WRITING)) {
                return false;
            }
            $state = @pg_connect_poll($connection);
        }

        return $state === PGSQL_POLLING_OK;
    }

    private function waitForSocket(Connection $connection, int $deadline, bool $writing = false): bool
    {
        $remaining = intdiv($deadline - hrtime(true), 1000);
        if ($remaining <= 0 || ($socket = @pg_socket($connection)) === false) {
            return false;
        }

        $read = $writing ? [] : [$socket];
        $write = $writing ? [$socket] : [];
        $except = null;

        return @stream_select($read, $write, $except, intdiv($remaining, 1_000_000), $remaining % 1_000_000) === 1;
    }
}

