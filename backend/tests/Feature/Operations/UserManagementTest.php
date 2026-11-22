<?php

namespace Tests\Feature\Operations;

use App\Models\Brand;
use App\Models\Role;
use App\Models\User;
use App\Services\UserManagementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->account('admin');
        $this->actingAs($this->admin);
    }

    private function account(string $role): User
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->where('slug', $role)->firstOrFail());

        return $user;
    }

    private function payload(string $role = 'staff'): array
    {
        return ['name' => 'New User', 'email' => 'new@example.test', 'role' => $role, 'password' => 'A-long-password-123', 'password_confirmation' => 'A-long-password-123'];
    }

    public function test_admin_creates_both_roles_with_hashed_passwords_and_safe_audit_records(): void
    {
        foreach (['admin', 'staff'] as $role) {
            $response = $this->postJson('/api/v1/users', [...$this->payload($role), 'email' => $role.'@example.test'])->assertCreated()->assertJsonPath('data.role', $role);
            $this->assertArrayNotHasKey('password', $response->json('data'));
            $user = User::query()->findOrFail($response->json('data.id'));
            $this->assertTrue(Hash::check('A-long-password-123', $user->password));
            $this->assertTrue($user->hasRole($role));
        }
        $this->assertFalse(str_contains(DB::table('audit_logs')->pluck('new_values')->implode(' '), 'A-long-password-123'));
    }

    public function test_user_update_retains_password_when_omitted_and_changes_role_safely(): void
    {
        $user = $this->account('staff');
        $hash = $user->password;
        $this->putJson('/api/v1/users/'.$user->id, ['name' => 'Updated', 'email' => $user->email, 'role' => 'admin'])->assertOk()->assertJsonPath('data.role', 'admin');
        $this->assertSame($hash, $user->fresh()->password);
        $this->putJson('/api/v1/users/'.$user->id, ['name' => 'Updated', 'email' => $user->email, 'role' => 'staff'])->assertOk()->assertJsonPath('data.role', 'staff');
        $this->assertTrue($user->fresh()->hasRole('staff'));
    }

    public function test_validation_protects_password_confirmation_email_and_role_assignment(): void
    {
        $this->postJson('/api/v1/users', [...$this->payload(), 'role' => 'super-admin'])->assertUnprocessable()->assertJsonValidationErrors('role');
        $this->postJson('/api/v1/users', [...$this->payload(), 'email' => $this->admin->email])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson('/api/v1/users', [...$this->payload(), 'password' => 'short', 'password_confirmation' => 'short'])->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->postJson('/api/v1/users', [...$this->payload(), 'password_confirmation' => 'different'])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_staff_can_use_operations_but_cannot_manage_users_or_delete_any_records(): void
    {
        $staff = $this->account('staff');
        $brand = Brand::query()->create(['name' => 'Test', 'slug' => 'test']);
        $this->actingAs($staff);
        $this->getJson('/api/v1/brands')->assertOk();
        $this->postJson('/api/v1/brands', ['name' => 'Allowed'])->assertCreated();
        $this->deleteJson('/api/v1/brands/'.$brand->id)->assertForbidden();
        $this->getJson('/api/v1/users')->assertForbidden();
        $this->getJson('/api/v1/users/'.$this->admin->id)->assertForbidden();
        $this->postJson('/api/v1/users', $this->payload('admin'))->assertForbidden();
        $this->putJson('/api/v1/users/'.$staff->id, ['name' => 'Escalate', 'email' => $staff->email, 'role' => 'admin'])->assertForbidden();
        $this->deleteJson('/api/v1/users/'.$this->admin->id)->assertForbidden();
        $this->assertFalse(Gate::forUser($staff)->allows('records.delete'));
        $this->getJson('/api/v1/auth/user')->assertOk();
        $this->assertNotContains('records.delete', $this->getJson('/api/v1/auth/user')->json('data.permissions'));
    }

    public function test_self_deletion_demotion_and_last_admin_removal_are_blocked(): void
    {
        $this->deleteJson('/api/v1/users/'.$this->admin->id)->assertUnprocessable();
        $this->putJson('/api/v1/users/'.$this->admin->id, ['name' => 'Self', 'email' => $this->admin->email, 'role' => 'staff'])->assertUnprocessable();
        $actor = $this->account('staff');
        try {
            app(UserManagementService::class)->delete($this->admin->id, $actor);
            $this->fail('Last admin removal was permitted.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('role', $exception->errors());
        }
        $this->assertNotNull($this->admin->fresh());
    }

    public function test_delete_retains_user_history_revokes_access_and_hides_account(): void
    {
        $user = $this->account('staff');
        $user->createToken('test');
        DB::table('sessions')->insert(['id' => 'deleted-session', 'user_id' => $user->id, 'payload' => 'test', 'last_activity' => time()]);
        $this->deleteJson('/api/v1/users/'.$user->id)->assertOk();
        $this->assertSoftDeleted('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('sessions', ['id' => 'deleted-session']);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $user->id]);
        $this->getJson('/api/v1/users/'.$user->id)->assertNotFound();
        $this->assertDatabaseHas('audit_logs', ['action' => 'users.deleted', 'entity_id' => $user->id]);
        $this->assertNull(auth('web')->getProvider()->retrieveByCredentials(['email' => $user->email, 'password' => 'anything']));
    }

    public function test_password_reset_revokes_existing_sessions_and_tokens(): void
    {
        $user = $this->account('staff');
        $user->createToken('test');
        DB::table('sessions')->insert(['id' => 'old-session', 'user_id' => $user->id, 'payload' => 'test', 'last_activity' => time()]);
        $this->putJson('/api/v1/users/'.$user->id, [...$this->payload(), 'email' => $user->email])->assertOk();
        $this->assertTrue(Hash::check('A-long-password-123', $user->fresh()->password));
        $this->assertDatabaseMissing('sessions', ['id' => 'old-session']);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $user->id]);
    }

    public function test_listing_search_and_cursor_pagination_do_not_expose_secrets(): void
    {
        $staff = $this->account('staff');
        $response = $this->getJson('/api/v1/users?per_page=1')->assertOk()->assertJsonPath('data.0.id', $staff->id);
        $this->assertArrayNotHasKey('password', $response->json('data.0'));
        $this->getJson('/api/v1/users?per_page=1&cursor='.urlencode($response->json('next_cursor')))->assertOk()->assertJsonPath('data.0.id', $this->admin->id);
        $this->getJson('/api/v1/users?search='.urlencode($staff->email))->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_editing_existing_job_role_does_not_silently_replace_it(): void
    {
        $role = Role::query()->create(['slug' => 'technician', 'name' => 'Technician']);
        $user = User::factory()->create();
        $user->roles()->attach($role);
        $this->putJson('/api/v1/users/'.$user->id, ['name' => 'Edited', 'email' => $user->email, 'role' => 'staff'])->assertOk();
        $this->assertTrue($user->fresh()->hasRole('technician'));
    }
}
