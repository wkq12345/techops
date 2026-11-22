<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class UserManagementService
{
    public function __construct(private readonly AuditService $audit) {}

    public function save(array $data, ?int $id, User $actor): User
    {
        return DB::transaction(function () use ($data, $id, $actor): User {
            User::query()->orderBy('id')->lockForUpdate()->get(['id']);
            $user = $id ? User::query()->findOrFail($id) : new User;
            $before = $id ? $this->snapshot($user) : null;
            $wasAdmin = $id && $user->isAdministrator();
            $roleChanged = $id && ($wasAdmin ? 'admin' : 'staff') !== $data['role'];
            if ($wasAdmin && $data['role'] !== 'admin') {
                $this->guardAdministratorRemoval($user, $actor);
            }
            $passwordChanged = ! empty($data['password']);
            $user->fill(collect($data)->only(['name', 'email'])->all());
            if ($passwordChanged) {
                $user->password = $data['password'];
                $user->remember_token = Str::random(60);
            }
            $user->save();
            // Preserve job-specific roles unless the administrator changes the role.
            if (! $id || $roleChanged || ! $user->roles()->exists()) {
                $user->roles()->sync([Role::query()->where('slug', $data['role'])->firstOrFail()->id]);
            }
            if ($id && ($passwordChanged || $roleChanged)) {
                $this->revokeSessions($user);
            }
            $this->audit->record($id ? 'users.updated' : 'users.created', $user, $before, $this->snapshot($user));

            return $user->fresh('roles');
        }, 5);
    }

    public function delete(int $id, User $actor): void
    {
        DB::transaction(function () use ($id, $actor): void {
            User::query()->orderBy('id')->lockForUpdate()->get(['id']);
            $user = User::query()->findOrFail($id);
            if ($user->id === $actor->id) {
                throw ValidationException::withMessages(['user' => 'You cannot delete your own account.']);
            }
            if ($user->isAdministrator()) {
                $this->guardAdministratorRemoval($user, $actor);
            }
            $before = $this->snapshot($user);
            $user->remember_token = Str::random(60);
            $user->save();
            $this->revokeSessions($user);
            $user->delete();
            $this->audit->record('users.deleted', $user, $before, null);
        }, 5);
    }

    private function guardAdministratorRemoval(User $user, User $actor): void
    {
        if ($user->id === $actor->id) {
            throw ValidationException::withMessages(['role' => 'You cannot remove your own administrator access.']);
        }
        if (User::query()->whereHas('roles', fn ($q) => $q->whereIn('slug', ['admin', 'super-admin']))->count() <= 1) {
            throw ValidationException::withMessages(['role' => 'At least one administrator must remain.']);
        }
    }

    private function revokeSessions(User $user): void
    {
        DB::table('sessions')->where('user_id', $user->id)->delete();
        $user->tokens()->delete();
    }

    private function snapshot(User $user): array
    {
        return ['name' => $user->name, 'email' => $user->email, 'roles' => $user->roles()->pluck('slug')->all()];
    }
}
