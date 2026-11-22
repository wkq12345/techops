<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService
{
    /** @param array{email: string, password: string, remember?: bool} $credentials */
    public function login(Request $request, array $credentials): User
    {
        $authenticated = Auth::attempt(
            ['email' => $credentials['email'], 'password' => $credentials['password']],
            $credentials['remember'] ?? false,
        );

        if (! $authenticated) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $request->session()->regenerate();

        return $request->user()->load('roles.permissions');
    }

    public function logout(Request $request): void
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }

    public function changePassword(Request $request, string $password): void
    {
        $request->user()->forceFill([
            'password' => Hash::make($password),
            'remember_token' => Str::random(60),
        ])->save();

        $request->session()->regenerate();
        // Sanctum's AuthenticateSession stores the new password hash for this
        // browser on the response; other established sessions fail its check.
    }

    public function sendResetLink(string $email): void
    {
        $status = Password::sendResetLink(['email' => $email]);

        if ($status === Password::INVALID_USER) {
            return;
        }

        if ($status !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages(['email' => [__($status)]]);
        }
    }

    /** @param array{email: string, password: string, password_confirmation: string, token: string} $credentials */
    public function resetPassword(array $credentials): void
    {
        $status = Password::reset(
            $credentials,
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => [__($status)]]);
        }
    }
}
