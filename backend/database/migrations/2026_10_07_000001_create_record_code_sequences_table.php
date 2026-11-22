<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_code_sequences', function (Blueprint $table): void {
            $table->string('resource', 50)->primary();
            $table->unsignedBigInteger('last_value')->default(0);
        });
    }

    public function down(): void
    {
        // Retain allocation history to prevent identifier reuse after rollback.
        // A destructive removal requires the owner's explicit approval.
        throw new RuntimeException('Code sequence history is retained. Removing this table requires explicit approval.');
    }
};
