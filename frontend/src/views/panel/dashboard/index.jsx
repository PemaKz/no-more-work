import useAuth from "../../../hooks/useAuth";

export default function PanelDashboardView() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">
          Bienvenido, {user?.name || 'Usuario'}!
        </h2>
        <p className="text-zinc-400">
          Este es tu panel de control. Aquí podrás gestionar todo lo relacionado con tu cuenta.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Perfil</h3>
            <span className="text-2xl">👤</span>
          </div>
          <p className="text-zinc-400 text-sm">
            Gestiona tu información personal y preferencias.
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Actividad</h3>
            <span className="text-2xl">📈</span>
          </div>
          <p className="text-zinc-400 text-sm">
            Revisa tu actividad reciente y estadísticas.
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Configuración</h3>
            <span className="text-2xl">⚙️</span>
          </div>
          <p className="text-zinc-400 text-sm">
            Ajusta la configuración de tu cuenta.
          </p>
        </div>
      </div>

      <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Información de tu cuenta</h3>
        <div className="space-y-3">
          <div>
            <span className="text-sm text-zinc-400">Nombre:</span>
            <p className="text-white font-medium">{user?.name || 'N/A'}</p>
          </div>
          <div>
            <span className="text-sm text-zinc-400">Email:</span>
            <p className="text-white font-medium">{user?.email || 'N/A'}</p>
          </div>
          <div>
            <span className="text-sm text-zinc-400">ID de Usuario:</span>
            <p className="text-white font-medium font-mono text-sm">{user?.id || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}