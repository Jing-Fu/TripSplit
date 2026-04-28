import { useLocale } from "@/lib/i18n/context";
import { getActivityEmoji, getActivityLabel } from "./helpers";
import type { ActivityLog } from "./types";

type ActivityViewProps = {
  activities: ActivityLog[];
  loading: boolean;
  onRefresh: () => void;
};

export function ActivityView({ activities, loading, onRefresh }: ActivityViewProps) {
  const { t } = useLocale();
  const activityLabels: Record<string, string> = {
    expense_created: t("activity.labels.expenseCreated"),
    expense_updated: t("activity.labels.expenseUpdated"),
    expense_deleted: t("activity.labels.expenseDeleted"),
    payment_marked: t("activity.labels.paymentMarked"),
    payment_updated: t("activity.labels.paymentUpdated"),
    member_added: t("activity.labels.memberAdded"),
    member_removed: t("activity.labels.memberRemoved"),
    backup_imported: t("activity.labels.backupImported"),
    backup_exported: t("activity.labels.backupExported"),
    notification_generated: t("activity.labels.notificationGenerated"),
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400">
        <div className="mb-3 text-4xl animate-bounce">📜</div>
        <p>{t("activity.loading")}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mb-3 text-5xl">📜</div>
        <p className="text-gray-400">{t("activity.empty")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">{t("activity.recent")}</h3>
        <button
          onClick={onRefresh}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700"
        >
          🔄 {t("common.refresh")}
        </button>
      </div>
      <div className="space-y-2">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4"
          >
            <span className="mt-0.5 shrink-0 text-xl">{getActivityEmoji(activity.action)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{activity.user?.name || t("common.system")}</span>{" "}
                {activityLabels[activity.action] || getActivityLabel(activity.action)}
              </p>
              {activity.details && <p className="mt-0.5 truncate text-xs text-gray-400">{activity.details}</p>}
              <p className="mt-1 text-xs text-gray-300">
                {new Date(activity.createdAt).toLocaleString("zh-TW", {
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
