import Link from "next/link";
import { useLocale } from "@/lib/i18n/context";
import { formatDate } from "@/lib/utils";
import type { Trip } from "./types";

type TripHeaderProps = {
  trip: Trip;
  showInvite: boolean;
  onToggleInvite: () => void;
  onDeleteTrip: () => void;
};

export function TripHeader({ trip, showInvite, onToggleInvite, onDeleteTrip }: TripHeaderProps) {
  const { t } = useLocale();

  return (
    <header className="sticky top-0 z-10 border-b border-primary-100 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link href="/" className="shrink-0 text-gray-400 transition-colors hover:text-gray-600">
              ←
            </Link>
            <span className="shrink-0 text-2xl sm:text-3xl">{trip.coverEmoji}</span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-gray-800 sm:text-xl">{trip.name}</h1>
              <p className="truncate text-xs text-gray-400 sm:text-sm">
                {trip.destination && `📍 ${trip.destination} · `}
                {formatDate(trip.startDate)}
                {trip.endDate && ` ~ ${formatDate(trip.endDate)}`}
              </p>
              <p className="hidden text-xs text-gray-400 sm:block">
                {t("trip.owner").replace("{name}", trip.owner?.name || t("trip.ownerUnclaimed"))} · {" "}
                {t("trip.currentIdentity").replace("{name}", trip.currentUser.name)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onToggleInvite}
              className="rounded-xl bg-accent-50 px-2.5 py-1.5 text-xs text-accent-600 transition-colors hover:bg-accent-100 sm:px-3 sm:text-sm"
            >
              {t("trip.invite")}
            </button>
            {trip.permissions.canDeleteTrip && (
              <button
                onClick={onDeleteTrip}
                className="px-2 py-1.5 text-sm text-gray-300 transition-colors hover:text-red-400"
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {showInvite && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-accent-50 p-3">
            <span className="text-sm text-accent-700">{t("trip.inviteCode")}</span>
            <code className="rounded-lg bg-white px-3 py-1 font-mono text-lg font-bold text-accent-700">
              {trip.inviteCode}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(trip.inviteCode)}
              className="text-sm text-accent-500 hover:text-accent-700"
            >
              📋 {t("common.copy")}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
