# TechOps backend health checks

Both endpoints accept unauthenticated GET requests. Laravel returns JSON with
`Cache-Control: no-store`. The routes run outside the Laravel web and stateful
API middleware groups so they do not start sessions, authenticate users or
read a database-backed session. They remain callable during Laravel
maintenance mode. The readiness result describes dependency connectivity
during maintenance. A deployment pipeline should check user-facing service
availability separately if it uses maintenance mode.

| Endpoint | Success | Failure |
| --- | --- | --- |
| `/api/health/live` | `200 {"status":"ok"}` | The runtime or HTTP transport may return an error or time out if it cannot serve requests |
| `/api/health/ready` | `200 {"status":"ok","checks":{"postgres":"ok","redis":"ok"}}` | `503 {"status":"unavailable","checks":{"postgres":"unavailable","redis":"ok"}}`, with each check reporting its own result |

A dependency exception, timeout or unexpected reply is summarized as
`unavailable`. The public response includes only fixed keys and statuses.
Application probe failures do not emit individual exception logs. Monitor
repeated non-200 responses and investigate privately through the dependency
logs. Keep probe cadence coarse enough for your deployment.

## Dependency and forwarding behavior

- PostgreSQL uses the configured PostgreSQL connection and URL parameters.
  Its dedicated asynchronous libpq connection shares a 1.5-second socket
  deadline across connection, authentication and `SELECT 1`. The session
  also has a one-second PostgreSQL statement timeout. Both backend Docker
  images include the native `pgsql` extension alongside PDO.
- Redis uses the existing cache connection settings, including URL, TLS,
  authentication and database selection. A dedicated PhpRedis connection
  uses 300 ms connect and per-read timeouts. It runs one PING with no
  retries or persistent connection. Authentication and database selection
  may each consume a read timeout.
- The production Nginx `/api` FastCGI location forwards both paths to
  PHP-FPM. Readiness has a two-request-per-second limit per Nginx peer,
  with three burst slots and HTTP 429 for excess traffic. Caddy is an
  Nginx peer, so external readiness requests share that limit behind it.
  Liveness and all other routes keep their existing rate behavior.
- DNS lookups depend on OS resolver timing, and Nginx/FPM queue time is
  outside the dependency budgets. This endpoint checks connectivity. It
  does not certify migrations, business operations or queue progress.

The PostgreSQL socket polling uses PHP's asynchronous connection API.
[PHP pg_connect_poll documentation](https://www.php.net/manual/en/function.pg-connect-poll.php)

## Continuous deployment

After starting a candidate deployment, request liveness first, then poll
readiness through the Nginx-facing URL. Use a bounded polling window and
space requests at least one second apart. Require HTTP 200 and
`status: ok` before sending traffic. A readiness 503 should block promotion
while the deployment system checks its dependencies. An individual readiness
failure should not restart a working PHP process.

```sh
curl --fail --silent --show-error --max-time 5 "https://$DEPLOY_HOST/api/health/live"
curl --fail --silent --show-error --max-time 5 "https://$DEPLOY_HOST/api/health/ready"
```

## Future Kubernetes probes

Point HTTP probes at the pod's HTTP listener. For PHP-FPM, use its HTTP
proxy instead of its FastCGI socket. Liveness detects a process that
cannot serve HTTP. Readiness removes a pod from service during dependency
failure. Use liveness for a startup probe if initialization takes time.

```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: http
  timeoutSeconds: 2
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /api/health/ready
    port: http
  timeoutSeconds: 5
  periodSeconds: 10
```

## Verification

The feature tests cover anonymous requests, response status and content
type, all four dependency states, session isolation and error redaction.
They mock dependencies and run with the isolated backend suite. The six
health cases passed. The full backend suite passed 63 tests and 468 assertions.

The development backend, production PHP-FPM and production frontend images
built locally. A disposable
Compose stack using those images passed `nginx -t` and verified forwarding
to Laravel. Both endpoints returned JSON 200 with healthy dependencies.
Pausing PostgreSQL, Redis and both services returned the corresponding
readiness 503 responses. With both paused, readiness returned in about
1.84 seconds and liveness still returned 200. Readiness returned 200
after both services resumed. The test stack used temporary database and
Redis storage.

