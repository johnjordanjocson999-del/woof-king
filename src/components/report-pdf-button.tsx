"use client";

/**
 * Opens a print-ready report and triggers the browser “Save as PDF” flow.
 */
export function ReportPdfButton({
  href,
  label = "Download PDF",
}: {
  href: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="btn btn-primary btn-sm"
    >
      {label}
    </a>
  );
}
