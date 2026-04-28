type BackupCardProps = {
  backingUp: boolean;
  onTriggerBackup: () => void;
};

export function BackupCard({ backingUp, onTriggerBackup }: BackupCardProps) {
  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-500">💾 伺服器備份</h3>
          <p className="mt-1 text-xs text-gray-400">建立旅程的完整備份到伺服器</p>
        </div>
        <button
          onClick={onTriggerBackup}
          disabled={backingUp}
          className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:bg-primary-300"
        >
          {backingUp ? "備份中..." : "建立備份"}
        </button>
      </div>
    </div>
  );
}
