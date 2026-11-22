<?php

use App\Services\UserRoleService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->softDeletes();
        });
        app(UserRoleService::class)->provision();
    }

    public function down(): void
    {
        throw new RuntimeException('Removing user deletion history and roles requires explicit approval.');
    }
};
