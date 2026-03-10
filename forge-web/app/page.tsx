export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Forge Dashboard</h1>
      <p className="text-gray-600 mb-8">
        Structured Change Orchestrator — manage projects, tasks, and knowledge.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Projects</h2>
          <p className="text-gray-500 text-sm">View and manage your projects</p>
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Recent Activity</h2>
          <p className="text-gray-500 text-sm">Latest changes and decisions</p>
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
          <p className="text-gray-500 text-sm">Create project, plan goal</p>
        </div>
      </div>
    </div>
  );
}
