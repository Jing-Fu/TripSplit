import { useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
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
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);

  const copyClaimLink = async (memberId: string, claimToken: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/member/${claimToken}`);
      setCopiedMemberId(memberId);
      setTimeout(() => setCopiedMemberId((current) => (current === memberId ? null : current)), 2000);
    } catch {
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-medium text-gray-500">
          {t("trip.members").replace("{count}", String(trip.members.length))}
        </h3>
        {trip.permissions.canManageMembers ? (
          <span className="text-xs text-primary-500">{t("trip.onlyOwnerCanManageMembers")}</span>
        ) : (
          <span className="text-xs text-gray-400">{t("trip.viewOnlyMembers")}</span>
        )}
      </div>

      <div className="mb-3 space-y-2">
        {trip.members.map((member) => (
          <div
            key={member.id}
            className="flex flex-col gap-2 rounded-2xl bg-accent-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-200 text-xs font-medium text-accent-800">
                  {member.name[0]}
                </span>
                <span className="truncate text-sm text-accent-700">{member.name}</span>
                {member.userId === trip.currentUser.id && <span className="text-[10px] text-accent-500">{t("common.you")}</span>}
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                  member.userId ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {member.userId ? t("trip.memberClaimed") : t("trip.memberUnclaimed")}
                </span>
              </div>
              {!member.userId && trip.permissions.canManageMembers && (
                <p className="mt-1 text-xs text-gray-400">{t("trip.memberInviteHint")}</p>
              )}
            </div>

            <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
              {!member.userId && trip.permissions.canManageMembers && member.claimToken && (
                <button
                  onClick={() => copyClaimLink(member.id, member.claimToken!)}
                  className="rounded-full bg-white px-3 py-1 text-xs text-accent-600 hover:bg-accent-100"
                >
                  {copiedMemberId === member.id ? t("trip.memberInviteCopied") : t("trip.memberInvite")}
                </button>
              )}
              {trip.permissions.canManageMembers && member.userId !== trip.owner?.id && (
                <button
                  onClick={() => onRemoveMember(member.id)}
                  className="text-accent-300 hover:text-red-400"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {trip.permissions.canManageMembers && (
        <div className="flex flex-col gap-2 sm:flex-row">
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
            className="rounded-xl bg-accent-500 px-4 py-2 text-sm text-white transition-colors hover:bg-accent-600 sm:self-auto"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
