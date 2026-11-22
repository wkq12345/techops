<?php

namespace App\Services;

use App\Models\User;
use App\Notifications\OperationalNotification;
use Illuminate\Support\Facades\Notification;

class NotificationService
{
    public function permission(string $permission, string $title, string $message, string $type, ?string $url = null): void
    {
        $users = User::query()->whereHas('roles', fn ($q) => $q->where('slug', 'super-admin')->orWhereHas('permissions', fn ($p) => $p->where('name', $permission)))->get();
        Notification::send($users, new OperationalNotification($title, $message, $type, $url));
    }

    public function users(array $userIds, string $title, string $message, string $type, ?string $url = null): void
    {
        Notification::send(User::query()->whereIn('id', array_filter($userIds))->get(), new OperationalNotification($title, $message, $type, $url));
    }
}
