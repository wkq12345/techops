<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UserManagementRequest;
use App\Models\User;
use App\Services\UserManagementService;
use App\Support\TablePagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserManagementController extends Controller
{
    public function __construct(private readonly UserManagementService $users) {}

    public function index(Request $request): JsonResponse
    {
        $query = User::query()->with('roles:id,name,slug')->orderByDesc('id');
        if ($request->input('sort_by') === 'role') {
            $query->select('users.*')->selectRaw("case when exists (select 1 from user_roles join roles on roles.id = user_roles.role_id where user_roles.user_id = users.id and roles.slug in ('admin', 'super-admin')) then 'admin' else 'staff' end as role_sort");
        }
        if ($search = trim($request->string('search')->toString())) {
            $operator = $query->getModel()->getConnection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where(fn ($q) => $q->where('name', $operator, '%'.$search.'%')->orWhere('email', $operator, '%'.$search.'%'));
        }
        $page = TablePagination::paginate($query, 'users', $request->only(['sort_by', 'sort_direction', 'page']), $request->integer('per_page', 30));
        $page->through(fn (User $user) => $this->record($user));

        return response()->json($page);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['data' => $this->record(User::query()->with('roles')->findOrFail($id))]);
    }

    public function store(UserManagementRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->record($this->users->save($request->validated(), null, $request->user()))], 201);
    }

    public function update(UserManagementRequest $request, int $id): JsonResponse
    {
        return response()->json(['data' => $this->record($this->users->save($request->validated(), $id, $request->user()))]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->users->delete($id, $request->user());

        return response()->json(['data' => null, 'message' => 'Account access removed. History retained.']);
    }

    private function record(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->isAdministrator() ? 'admin' : 'staff', 'roles' => $user->roles->pluck('name')->all(), 'created_at' => $user->created_at];
    }
}
