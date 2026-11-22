<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('operational_reminders', function (Blueprint $table): void {
            $table->id();
            $table->string('reminder_key')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestampTz('sent_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operational_reminders');
    }
};
