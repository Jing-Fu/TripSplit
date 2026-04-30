export class LineAuthError extends Error {
  constructor(
    public readonly code: "expired" | "audience_mismatch" | "verify_failed",
    message?: string
  ) {
    super(message ?? code);
    this.name = "LineAuthError";
  }
}

export class LinePushError extends Error {
  constructor(
    public readonly code: string,
    message?: string
  ) {
    super(message ?? code);
    this.name = "LinePushError";
  }
}
