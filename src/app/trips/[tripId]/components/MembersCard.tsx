import type { Dispatch, KeyboardEvent, SetStateAction } from "react";
import { useLocale } from "@/lib/i18n/context";
import type { Trip } from "./types";

type MembersCardProps = {
  trip: Trip;
  newMember: string;
  setNewMember: Dispatch<SetStateAction<string>>;
  onAddMember: () => void;
  onRemoveMember: (memberId: string) => void;
};

export function MembersCard({ trip, newMember, setNewMember, onAddMember, onRemoveMember }: MembersCardProps) {
  const { t } = useLocale();

  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">
          {t("trip.members").replace("{count}", String(trip.members.length))}
        </h3>
        {trip.permissions.canManageMembers ? (
          <span className="text-xs text-primary-500">{t("trip.onlyOwnerCanManageMembers")}</span>
        ) : (
          <span className="text-xs text-gray-400">{t("trip.viewOnlyMembers")}</span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {trip.members.map((member) => (
          <span
            key={member.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1.5 text-sm text-accent-700"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-200 text-xs font-medium text-accent-800">
              {member.name[0]}
            </span>
            {member.name}
            {member.userId === trip.currentUser.id && <span className="text-[10px] text-accent-500">{t("common.you")}</span>}
            {trip.permissions.canManageMembers && member.userId !== trip.owner?.id && (
              <button
                onClick={() => onRemoveMember(member.id)}
                className="ml-0.5 text-accent-300 hover:text-red-400"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      {trip.permissions.canManageMembers && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            placeholder={t("trip.addMemberPlaceholder")}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-300"
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && onAddMember()}
          />
          <button
            onClick={onAddMember}
            className="rounded-xl bg-accent-500 px-4 py-2 text-sm text-white transition-colors hover:bg-accent-600"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
