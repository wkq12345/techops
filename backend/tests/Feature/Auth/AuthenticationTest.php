<?php

namespace Tests\Feature\Auth;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_fetch_profile_and_logout(): void
    {
        $user = User::factory()->create(['password' => 'secret-password']);

        $this->withHeader('Origin', 'http://localhost:5173');

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'secret-password',
        ])->assertOk()->assertJsonPath('data.email', $user->email);

        $this->getJson('/api/v1/auth/user')
            ->assertOk()
            ->assertJsonPath('data.email', $user->email);

        $this->postJson('/api/v1/auth/logout')->assertOk();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/auth/user')->assertUnauthorized();
    }

    public function test_invalid_credentials_return_consistent_validation_response(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'Validation failed.')
            ->assertJsonValidationErrors('email');
    }

    public function test_role_permissions_are_resolved_by_the_gate(): void
    {
        $permission = Permission::query()->firstOrCreate(['name' => 'products.view']);
        $role = Role::query()->create(['name' => 'Sales Staff', 'slug' => 'sales-staff']);
        $role->permissions()->attach($permission);
        $user = User::factory()->create();
        $user->roles()->attach($role);

        $this->assertTrue(Gate::forUser($user)->allows('products.view'));
        $this->assertFalse(Gate::forUser($user)->allows('users.manage'));
    }

    public function test_super_admin_bypasses_specific_permission_assignments(): void
    {
        $role = Role::query()->create(['name' => 'Super Admin', 'slug' => 'super-admin']);
        $user = User::factory()->create();
        $user->roles()->attach($role);

        $this->assertTrue(Gate::forUser($user)->allows('users.manage'));
    }

    public function test_password_reset_link_can_be_requested(): void
    {
        Notification::fake();
        $user = User::factory()->create();

        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertJsonPath('message', 'Password reset link sent.');

        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_password_can_be_reset_with_a_valid_token(): void
    {
        $user = User::factory()->create();
        $token = Password::broker()->createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'new-secure-password',
            'password_confirmation' => 'new-secure-password',
        ])->assertOk();

        $this->assertTrue(Hash::check('new-secure-password', $user->fresh()->password));
    }

    public function test_operations_require_authentication(): void
    {
        foreach (['inventory', 'products', 'sales-orders', 'repairs', 'purchase-orders', 'reports/dashboard'] as $path) {
            $this->getJson('/api/v1/'.$path)->assertUnauthorized();
        }
        $this->putJson('/api/v1/auth/password', [])->assertUnauthorized();
        $this->postJson('/api/v1/stock-adjustments', [])->assertUnauthorized();
    }

    public function test_staff_cannot_access_operations_without_permission(): void
    {
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/v1/inventory')->assertForbidden();
        $this->postJson('/api/v1/stock-adjustments', [])->assertForbidden();
    }

    public function test_login_is_rate_limited(): void
    {
        for ($attempt = 0; $attempt < 6; $attempt++) {
            $this->postJson('/api/v1/auth/login', ['email' => 'unknown@example.test', 'password' => 'wrong-password'])->assertUnprocessable();
        }
        $this->postJson('/api/v1/auth/login', ['email' => 'unknown@example.test', 'password' => 'wrong-password'])->assertStatus(429);
    }

    public function test_changing_password_requires_the_current_password(): void
    {
        $user = User::factory()->create(['password' => 'original-password']);
        $this->withHeader('Origin', 'http://localhost:5173')->actingAs($user);
        $this->putJson('/api/v1/auth/password', ['current_password' => 'incorrect', 'password' => 'replacement-password', 'password_confirmation' => 'replacement-password'])
            ->assertUnprocessable()->assertJsonValidationErrors('current_password');
        $this->assertTrue(Hash::check('original-password', $user->fresh()->password));
    }

    public function test_password_change_keeps_current_session_and_rejects_an_old_session_hash(): void
    {
        $user = User::factory()->create(['password' => 'original-password']);
        $this->withHeader('Origin', 'http://localhost:5173')->actingAs($user);
        $this->getJson('/api/v1/auth/user')->assertOk();
        $oldHash = session('password_hash_web');
        $this->putJson('/api/v1/auth/password', ['current_password' => 'original-password', 'password' => 'replacement-password', 'password_confirmation' => 'replacement-password'])->assertOk();
        $this->assertTrue(Hash::check('replacement-password', $user->fresh()->password));
        $this->getJson('/api/v1/auth/user')->assertOk();
        $this->withSession(['password_hash_web' => $oldHash])->getJson('/api/v1/auth/user')->assertUnauthorized();
        Auth::forgetGuards();
    }

    public function test_staff_account_command_assigns_role_and_hashes_password(): void
    {
        $role = Role::query()->create(['name' => 'Sales Staff', 'slug' => 'sales-staff']);
        $this->artisan('techops:create-user', ['email' => 'staff@example.test'])
            ->expectsQuestion('Full name', 'Sales Operator')
            ->expectsQuestion('Password', 'staff-secure-password')
            ->expectsQuestion('Confirm password', 'staff-secure-password')
            ->assertSuccessful();
        $user = User::query()->where('email', 'staff@example.test')->firstOrFail();
        $this->assertTrue(Hash::check('staff-secure-password', $user->password));
        $this->assertTrue($user->roles->contains($role));
    }

    public function test_staff_account_command_does_not_overwrite_an_existing_user(): void
    {
        Role::query()->create(['name' => 'Sales Staff', 'slug' => 'sales-staff']);
        $user = User::factory()->create(['email' => 'staff@example.test', 'password' => 'original-password']);
        $this->artisan('techops:create-user', ['email' => 'staff@example.test'])
            ->expectsQuestion('Full name', 'Replacement Name')
            ->expectsQuestion('Password', 'staff-secure-password')
            ->expectsQuestion('Confirm password', 'staff-secure-password')
            ->assertFailed();
        $this->assertTrue(Hash::check('original-password', $user->fresh()->password));
    }
}
