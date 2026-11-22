<?php

namespace App\Console\Commands;

use App\Models\PurchaseOrder;
use App\Models\RepairJob;
use App\Models\SalesOrder;
use App\Models\User;
use App\Models\Warranty;
use App\Services\NotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SendOperationalReminders extends Command
{
    protected $signature = 'ops:send-reminders';
    protected $description = 'Send deduplicated reminders for aging operational work and warranty dates.';

    public function handle(NotificationService $notifications): int
    {
        if (! Schema::hasTable('operational_reminders')) {
            $this->error('Run the pending database migrations before sending operational reminders.');
            return self::FAILURE;
        }
        $this->notify($notifications, RepairJob::query()->whereNotIn('status', ['completed', 'cancelled'])
            ->where('updated_at', '<=', now()->subDays(3)), 'repairs.update', 'repair',
            fn (RepairJob $job) => ["repair:{$job->id}:{$job->status}", 'Repair needs attention', "Repair {$job->number} has had no update for at least 3 days.", '/modules/repairs']);

        $this->notify($notifications, PurchaseOrder::query()->whereNotIn('status', ['received', 'cancelled'])
            ->whereNotNull('expected_at')->whereDate('expected_at', '<', today()), 'purchases.create', 'purchase',
            fn (PurchaseOrder $order) => ["purchase:{$order->id}:{$order->status}:{$order->expected_at}", 'Purchase order overdue', "Purchase order {$order->number} is past its expected date.", '/modules/purchase-orders']);

        $this->notify($notifications, SalesOrder::query()->whereIn('status', ['confirmed', 'processing'])
            ->where('created_at', '<=', now()->subDays(2)), 'sales.create', 'sales',
            fn (SalesOrder $order) => ["sales:{$order->id}:{$order->status}", 'Sales order awaiting action', "Sales order {$order->number} has been open for more than 2 days; review its status and stock reservation.", '/modules/sales-orders']);

        Warranty::query()->where('status', 'active')->whereDate('warranty_end', '<', today())->update(['status' => 'expired']);
        $this->notify($notifications, Warranty::query()->where('status', 'active')->whereBetween('warranty_end', [today(), today()->addDays(7)]), 'products.view', 'warranty',
            fn (Warranty $warranty) => ["warranty:{$warranty->id}:{$warranty->warranty_end}", 'Warranty expiring soon', "Warranty {$warranty->number} expires on {$warranty->warranty_end}.", '/modules/warranties']);

        $this->info('Operational reminders processed.');
        return self::SUCCESS;
    }

    private function notify(NotificationService $notifications, $query, string $permission, string $kind, callable $message): void
    {
        $users = User::query()->whereHas('roles', fn ($role) => $role->whereIn('slug', ['admin', 'super-admin'])
            ->orWhereHas('permissions', fn ($p) => $p->where('name', $permission)))->get(['id']);
        $query->orderBy('id')->chunkById(100, function ($records) use ($notifications, $users, $kind, $message): void {
            foreach ($records as $record) {
                [$key, $title, $body, $url] = $message($record);
                foreach ($users as $user) {
                    DB::transaction(function () use ($notifications, $key, $user, $title, $body, $kind, $url): void {
                        $created = DB::table('operational_reminders')->insertOrIgnore(['reminder_key' => $key.':user:'.$user->id, 'user_id' => $user->id, 'sent_at' => now()]);
                        if ($created) $notifications->users([$user->id], $title, $body, $kind, $url);
                    });
                }
            }
        });
    }
}
