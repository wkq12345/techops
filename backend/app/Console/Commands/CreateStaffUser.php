<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class CreateStaffUser extends Command
{
    protected $signature = 'techops:create-user {email? : Staff email address} {--role=sales-staff : Existing role slug}';

    protected $description = 'Create an internal staff account with a hidden password prompt';

    public function handle(): int
    {
        $role = Role::query()->where('slug', $this->option('role'))->first();
        if (! $role) {
            $this->error('Unknown role. Available roles: '.Role::query()->pluck('slug')->implode(', '));

            return self::FAILURE;
        }

        $data = [
            'email' => Str::lower(trim((string) ($this->argument('email') ?? $this->ask('Email')))),
            'name' => trim((string) $this->ask('Full name')),
            'password' => $this->secret('Password'),
            'password_confirmation' => $this->secret('Confirm password'),
        ];
        $validator = Validator::make($data, [
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $message) {
                $this->error($message);
            }

            return self::FAILURE;
        }

        DB::transaction(function () use ($data, $role): void {
            $user = User::query()->create(collect($data)->only(['name', 'email', 'password'])->all());
            $user->roles()->attach($role);
        });
        $this->info('Created '.$data['email'].' with role '.$role->slug.'.');

        return self::SUCCESS;
    }
}
