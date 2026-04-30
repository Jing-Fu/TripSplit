"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

interface InviteQRProps {
  inviteCode: string;
}

export function InviteQR({ inviteCode }: InviteQRProps) {
  const [copied, setCopied] = useState(false);
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const url = liffId
    ? `https://liff.line.me/${liffId}?invite=${inviteCode}`
    : `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/trips/join?code=${inviteCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div data-content={url} data-testid="invite-qr">
        <QRCodeSVG value={url} size={160} />
      </div>
      <p className="text-xs text-gray-500 break-all text-center max-w-xs">{url}</p>
      <button
        onClick={handleCopy}
        className="rounded-full bg-primary-100 px-4 py-1.5 text-sm text-primary-700 hover:bg-primary-200 transition-colors"
        data-testid="copy-invite-link"
      >
        {copied ? "已複製！" : "複製連結"}
      </button>
    </div>
  );
}
