# TechOps on local Kubernetes

This is a single-node learning environment for Docker Desktop **kubeadm** on
Windows. It is not a public or production deployment. It keeps the existing
development web server, while introducing Kubernetes orchestration around it.

Every helper uses the explicit `docker-desktop` Kubernetes context and the
`techops-learning` namespace. Images are built on Docker's `desktop-linux`
context. The helpers do not change your current context, import `backend/.env`,
connect to Windows PostgreSQL, or reuse the Compose PostgreSQL volume.

## 1. Enable the cluster

1. Open Docker Desktop and wait for its engine to be running.
2. Open its **Kubernetes** view, choose **Create cluster**, and select **kubeadm**
   (one node). In older Desktop versions, look under Settings > Kubernetes.
3. Wait until the cluster is running. Allow enough resources for PostgreSQL,
   Redis, Laravel and Nginx; 4 GiB of Docker Desktop memory is a practical starting
   point for this learning stack, in addition to what your other apps need.
4. Verify from PowerShell:

```powershell
kubectl config get-contexts
kubectl --context docker-desktop get nodes
kubectl --context docker-desktop get storageclass
```

Expect one Ready node named `docker-desktop` and one default StorageClass.
The helper requires Kubernetes 1.27+ and kubectl within one minor version of the
server. It stops if the node, context, storage class, or local images are missing.
It does not create, reset, or change the Docker Desktop cluster for you.

Reference: [Docker Desktop Kubernetes setup](https://docs.docker.com/desktop/use-desktop/kubernetes/).
Use kubeadm for this first setup; kind/Minikube/cloud contexts are deliberately
outside this helper's supported targets.

## 2. Preview and deploy

Run from `C:\Projects\techops`:

```powershell
# Offline preview: no cluster, builds, secret generation or deployment required.
.\deploy\k8s\Deploy-Local.ps1 -RenderOnly

# Optional offline policy checks, using backend development dependencies:
kubectl kustomize deploy/k8s | php deploy/k8s/Validate-Manifests.php

# Actual deployment after the cluster is ready.
.\deploy\k8s\Deploy-Local.ps1
```

Use a PowerShell execution policy allowed by your organization for local scripts.
Do not change the machine-wide policy just to run this helper.

The helper:

1. Checks the explicit local contexts, one Ready kubeadm node, and default storage.
2. Builds distinct `techops-k8s-backend:learning-...` and
   `techops-k8s-frontend:learning-...` images. The frontend's API base is `/`.
3. Starts disposable image-check Jobs, with no database access, to prove Kubernetes
   can use the locally built images. These Jobs expire after ten minutes.
4. Reuses or creates a private Secrets file and Kubernetes Secret. It validates
   manifests with the API server before applying the application resources.
5. Provisions PostgreSQL and Redis, keeping application replicas at zero and the
   scheduler/bootstrap Job suspended until dependencies are ready.
6. Runs additive migrations. On the first setup only, seeds the administrator and
   demo data in a transaction and initializes matching child-location stock.
7. Records initialization in `techops-initialized`, starts the application, and
   enables the scheduler.

There is no `migrate:fresh`, truncation, credential rotation, or automatic data
deletion. Existing records prevent initial seeding when its initialization marker
is missing. If setup was interrupted after a successful seed Job, the helper
recovers its marker rather than seeding again.

Initialization state lives in the namespace; business records live in the new
`techops-postgres-data` 5 GiB PVC. An application/pod restart preserves both.
Do not reset the Docker Desktop cluster or delete its namespace/PVC to troubleshoot
the app; that can destroy the learning data.

## 3. Open TechOps

In a terminal that stays open:

```powershell
kubectl --context docker-desktop -n techops-learning port-forward --address 127.0.0.1 service/frontend 8080:80
```

Open **http://127.0.0.1:8080** consistently. Nginx serves React and forwards `/api`,
`/sanctum`, and `/up` to the internal backend. No ingress controller or hosts-file
edit is required. Use this exact host rather than switching to `localhost` so
Sanctum, cookies and the configured URL agree. If comparing with another app on
127.0.0.1, use a separate browser profile to avoid sharing its XSRF cookie.

The admin email is `admin@techops.local`. Open
`deploy/k8s/.local/secrets.env` privately to get its generated `ADMIN_PASSWORD`.
The helper never prints passwords. The directory is Git-ignored and access is
restricted to the current Windows user when it is created. Keep its contents
private. If your login password is later changed in TechOps, this file still holds
the original bootstrap password; the verification helper expects that initial
learning administrator password.

The Secret is reused across deployments. A missing local file is restored from
the existing cluster Secret; mismatches or lost credentials with existing storage
cause a stop instead of automatic regeneration. Kubernetes Secrets are not a
production secret-management solution merely because their values are base64.

Gmail credentials from `backend/.env` are not copied. Password-reset email is
logged to the backend pod's stderr in this learning environment. Operational
reminders remain in-app notifications.

## 4. What each resource teaches

| Resource | Purpose |
| --- | --- |
| Deployments | Replaceable frontend, backend and cache pods |
| Services | Private, stable `backend`, `postgres`, and `redis` DNS names |
| StatefulSet and PVC | PostgreSQL pod identity and persistent learning data |
| ConfigMaps | Public configuration, proxy config and bootstrap code |
| Secret | Separate application key, database password and initial admin password |
| Bootstrap Job | One deployment's migration/initial seed gate |
| CronJob | Run Laravel's scheduler every minute without overlapping Jobs |

The daily reminder time remains in Laravel: 08:30 Asia/Kuala_Lumpur. The CronJob
calls `schedule:run`, so Kubernetes does not duplicate that business schedule.
History is limited to one successful and two failed scheduler Jobs. Redis remains
cache-only, with a 128 MiB eviction budget. Sessions, queues and Laravel scheduler
locks stay in PostgreSQL. No queue-worker deployment is introduced in this phase.

Application readiness and liveness use `/up`; migrations are separately gated by
the bootstrap Job. PostgreSQL checks `pg_isready`; Redis checks `redis-cli ping`.
All workload containers have CPU/memory requests and limits. Service-account API
tokens are disabled in application pods.

## 5. Redeploy without reseeding

Rerun the helper after code changes. Each normal run builds a new image tag.

```powershell
.\deploy\k8s\Deploy-Local.ps1

# Or reuse existing images (the previous tag is in .local/last-deployment.json):
$learningDeployment = Get-Content .\deploy\k8s\.local\last-deployment.json -Raw | ConvertFrom-Json
.\deploy\k8s\Deploy-Local.ps1 -SkipBuild -ImageTag $learningDeployment.imageTag
```

Each run creates a uniquely named bootstrap Job and runs migrations, but skips
seeding after successful initialization. Credentials and the initial marker remain
stable. This learning workflow pauses the application during migration; it is not
a zero-downtime production rollout. Reopen the port-forward after a redeployment
replaces the frontend pod.

Always deploy through the helper. Bare `kubectl apply -k deploy/k8s` intentionally
leaves the application at zero replicas, uses placeholder local image tags and
keeps Jobs suspended; it is not a complete deployment procedure.

Completed bootstrap Jobs are retained for audit and interruption recovery. Only
the image-check Jobs have an automatic TTL. No helper deletes the namespace,
PVC, database, or business records.

## 6. Verify the learning deployment

Close your manually started port-forward first. The verification helper owns a
temporary hidden port-forward on 8080, closes only its own process afterward,
and never logs the admin password.

```powershell
# HTTP/proxy/authentication checks, Redis connectivity and scheduler registration:
.\deploy\k8s\Test-Local.ps1

# Also replace the learning PostgreSQL pod and prove data/credentials persist:
.\deploy\k8s\Test-Local.ps1 -RestartDatabase

# Also redeploy the existing image and check data, secrets and seed marker:
.\deploy\k8s\Test-Local.ps1 -RestartDatabase -Redeploy
```

These checks do not create sales, repairs, purchases, or other business records.
They check login/CSRF, repeated authenticated reads (session persistence), SPA deep
links, logout, cache connectivity, and scheduler registration. The optional data
checks compare product contents, staff/migration counts, Secret fingerprints and
the initialization marker before/after the operation. Avoid editing learning
records concurrently while running these snapshot comparisons.

For visual refresh persistence, reopen the port-forward, sign in, refresh the
dashboard, and sign out. Business-workflow testing remains yours.

To inspect Redis-backed dashboard/catalog behavior without business changes, use
the backend service as usual and inspect cache keys:

```powershell
kubectl --context docker-desktop -n techops-learning exec deployment/redis -- redis-cli --scan --pattern '*operations:v1:*'
kubectl --context docker-desktop -n techops-learning exec deployment/backend -- php artisan schedule:list
kubectl --context docker-desktop -n techops-learning get cronjob scheduler
```

After changing a category/brand through the app, confirm the selector/list shows
the new value; product changes must also refresh product counts. This checks the
existing after-commit cache invalidation in the learning environment.

## 7. Status and troubleshooting

```powershell
kubectl --context docker-desktop -n techops-learning get pods,services,pvc,jobs,cronjobs
kubectl --context docker-desktop -n techops-learning get events --sort-by=.lastTimestamp
kubectl --context docker-desktop -n techops-learning logs deployment/backend --tail=60
kubectl --context docker-desktop -n techops-learning logs deployment/frontend --tail=60
kubectl --context docker-desktop -n techops-learning describe statefulset postgres
```

- **No context / node not Ready:** enable the Docker Desktop kubeadm cluster and
  wait; the helper does not alter or reset the cluster.
- **ErrImageNeverPull:** confirm kubeadm, Docker `desktop-linux`, and the exact
  versioned image tag. Build again using the helper. It never pushes private images
  to a public registry.
- **PVC Pending:** inspect its events and the default StorageClass. Do not delete
  a bound PVC to troubleshoot a pod.
- **Bootstrap failed:** inspect `kubectl ... logs job/<name>` and
  `kubectl ... describe job <name>`. Correct the cause, then rerun the helper. It
  intentionally leaves application replicas at zero after a failed bootstrap.
- **Initialization marker missing with existing users:** inspect prior bootstrap
  Jobs before changing anything. Do not reseed/reset the database to bypass the
  guard.
- **Secret mismatch:** restore the original matching credentials. Do not regenerate
  APP_KEY or database passwords against an existing volume.
- **8080 busy:** close the previous port-forward; it uses a different port from
  the ordinary 5173/8000 development servers.
- **419 / login problems:** use `127.0.0.1:8080` consistently, clear that site's
  cookies, and check the backend/proxy logs. Do not mix hostnames.
- **OOMKilled:** inspect the named workload's memory limit and Docker Desktop's
  allocation before raising its manifest limit.

## 8. Stop without deleting data

Stop the port-forward with Ctrl+C. Suspend the scheduler and scale workloads down:

```powershell
kubectl --context docker-desktop -n techops-learning edit cronjob scheduler
# In the editor set spec.suspend: true, then save.
kubectl --context docker-desktop -n techops-learning scale deployment/backend deployment/frontend deployment/redis --replicas=0
kubectl --context docker-desktop -n techops-learning scale statefulset/postgres --replicas=0
```

Allow a currently running scheduler Job to finish before scaling PostgreSQL down.
To resume, rerun the deployment helper, then reopen port-forwarding. The PVC,
Secrets, marker and database records remain in place. Deleting learning data would
be a separate, explicitly requested operation; no deletion command is supplied.
