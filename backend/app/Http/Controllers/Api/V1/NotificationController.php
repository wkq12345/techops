<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $r): JsonResponse
    {
        return response()->json($r->user()->notifications()->latest()->cursorPaginate(30));
    }

    public function read(Request $r, string $id): JsonResponse
    {
        $notification = $r->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return response()->json(['data' => $notification, 'message' => 'Notification marked as read.']);
    }
}
