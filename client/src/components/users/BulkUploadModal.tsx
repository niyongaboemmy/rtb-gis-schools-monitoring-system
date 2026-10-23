import React, { useState, useRef } from "react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { AlertCircle, AlertTriangle, CheckCircle2, UploadCloud, Download, FileSpreadsheet, Save } from "lucide-react";
import * as XLSX from "xlsx";
import { api, apiErrorMessage } from "../../lib/api";
import { cn } from "../../lib/utils";
import { formatNumber } from "../../lib/format";
import { useToast } from "../ui/toast";
import { INSET, PILL_BUTTON, TONE_TILE, type Tone } from "../ui/surfaces";
import { Eyebrow, IconTile, Th, Td, Tr } from "../settings/settings-ui";
import { Skeleton, SkeletonGroup } from "../ui/skeleton";

/** One spreadsheet row, keyed by template column. */
type SheetRow = Record<string, string | number>;

interface ImportResult {
  created?: number;
  skipped?: number;
  errors?: { row: number; email?: string; reason?: string }[];
  error?: boolean;
  message?: string;
}

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/** "firstName" → "First name". */
function columnLabel(col: string): string {
  const words = col.replace(/([A-Z])/g, " $1").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function ResultTile({ tone, value, label }: { tone: Tone; value: number; label: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl p-4 ring-1 ring-inset", TONE_TILE[tone])}>
      <span className="text-3xl font-semibold tabular-nums">{formatNumber(value)}</span>
      <span className="mt-1 text-xs font-normal opacity-80">{label}</span>
    </div>
  );
}

export function BulkUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkUploadModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [parsedData, setParsedData] = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const resetState = () => {
    setStep("upload");
    setParsedData([]);
    setUploadResult(null);
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const readFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<SheetRow>(ws, { defval: "" });
        setParsedData(data);
        setStep("preview");
      } catch {
        toast.error(
          "Failed to parse the file. Please ensure it is a valid Excel document.",
        );
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      toast.error("Error reading file");
      setLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) {
      toast.error("Choose an Excel file (.xlsx or .xls).");
      return;
    }
    readFile(file);
  };

  const handleFieldChange = (
    rowIndex: number,
    field: string,
    value: string,
  ) => {
    const newData = [...parsedData];
    newData[rowIndex][field] = value;
    setParsedData(newData);
  };

  const confirmUpload = async () => {
    setLoading(true);
    try {
      const res = await api.post<ImportResult>("/users/bulk-json", { rows: parsedData });
      setUploadResult(res.data);
      const created = Number(res.data?.created ?? 0);
      const problems =
        Number(res.data?.skipped ?? 0) + (res.data?.errors?.length ?? 0);
      const createdText = `${created} user${created === 1 ? "" : "s"} imported`;
      if (problems > 0)
        toast.warning(`${createdText}; ${problems} row${problems === 1 ? "" : "s"} skipped or failed.`);
      else toast.success(createdText);
      setStep("result");
      onSuccess();
    } catch (err) {
      setUploadResult({
        error: true,
        message: apiErrorMessage(err, "Failed to bulk create records"),
      });
      setStep("result");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Through `api` so an expired access token is refreshed transparently.
    api
      .get<Blob>("/users/upload/template", { responseType: "blob" })
      .then(({ data }) => {
        const url = window.URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = "users_upload_template.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast.success("User import template downloaded");
      })
      .catch((err) =>
        toast.error(apiErrorMessage(err, "Could not download the template.")),
      );
  };

  // Pre-define columns expected based on backend template mapping
  const columns = [
    "firstName",
    "lastName",
    "email",
    "password",
    "roleName",
    "province",
    "district",
    "sector",
    "schoolId",
  ];

  const problemCount = uploadResult ? Number(uploadResult.skipped ?? 0) + (uploadResult.errors?.length || 0) : 0;
  const headerTone: Tone =
    step === "result" && uploadResult?.error
      ? "danger"
      : step === "result" && (uploadResult?.errors?.length ?? 0) > 0
        ? "warn"
        : step === "result"
          ? "good"
          : "primary";
  const HeaderIcon =
    step === "result" && uploadResult?.error
      ? AlertCircle
      : step === "result" && (uploadResult?.errors?.length ?? 0) > 0
        ? AlertTriangle
        : step === "result"
          ? CheckCircle2
          : step === "preview"
            ? FileSpreadsheet
            : UploadCloud;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth={step === "preview" ? "sm:max-w-5xl" : "sm:max-w-md"}
      title={
        <span className="flex items-center gap-3">
          <IconTile icon={HeaderIcon} tone={headerTone} />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-lg font-semibold tracking-tight text-foreground">
              {step === "upload" && "Import users"}
              {step === "preview" && "Check the rows"}
              {step === "result" && "Import results"}
            </span>
            <span className="text-xs font-normal text-muted-foreground/70">
              {loading && "Working…"}
              {!loading && step === "upload" && "From the Excel template"}
              {!loading &&
                step === "preview" &&
                `${formatNumber(parsedData.length)} ${parsedData.length === 1 ? "row" : "rows"} ready to import`}
              {!loading && step === "result" && "Summary"}
            </span>
          </span>
        </span>
      }
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {step !== "result" ? (
            <Button
              variant="ghost"
              className={cn(PILL_BUTTON.small, "text-primary hover:text-primary")}
              onClick={downloadTemplate}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Download template
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {step !== "result" && (
              <Button
                variant="ghost"
                onClick={handleClose}
                className={cn(PILL_BUTTON.secondary, "w-full sm:w-auto")}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            {step === "preview" && (
              <Button
                onClick={confirmUpload}
                disabled={loading || parsedData.length === 0}
                isLoading={loading}
                className={cn(PILL_BUTTON.primary, "w-full sm:w-auto")}
              >
                {!loading && <Save className="h-4 w-4" aria-hidden />}
                Import {formatNumber(parsedData.length)} {parsedData.length === 1 ? "user" : "users"}
              </Button>
            )}
            {step === "result" && (
              <Button onClick={handleClose} className={cn(PILL_BUTTON.primary, "w-full sm:w-auto")}>
                Done
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="py-2">
        {step === "upload" && (
          <>
            <div
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:p-8",
                dragOver
                  ? "border-primary/50 bg-primary/[0.07]"
                  : "border-border/60 bg-slate-900/[0.02] hover:border-primary/35 hover:bg-primary/[0.04] dark:bg-white/[0.02]",
                loading && "pointer-events-none opacity-60",
              )}
              role="button"
              tabIndex={0}
              aria-label="Choose an Excel file to import"
              aria-busy={loading}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!dragOver) setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <IconTile icon={dragOver ? FileSpreadsheet : UploadCloud} />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {loading ? "Reading the file…" : dragOver ? "Drop to read the file" : "Drop a file here or browse"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Excel .xlsx or .xls</p>
              </div>
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Passwords must be at least 10 characters with upper- and lower-case
              letters, a number and a symbol, and must not contain the email.
              Imported users are asked to choose their own password at first
              sign-in.
            </p>
          </>
        )}

        {step === "preview" && (
          <div className={cn("mt-1 overflow-hidden rounded-2xl", INSET)}>
            {parsedData.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <IconTile icon={FileSpreadsheet} tone="neutral" />
                <p className="text-sm font-normal text-muted-foreground">The file has no data rows.</p>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-auto overscroll-contain">
                <table aria-label="Rows to import" className="w-full border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-10 bg-background/90 backdrop-blur-md">
                    <tr>
                      <Th className="w-12 text-center first:pl-3">#</Th>
                      {columns.map((col) => (
                        <Th key={col} className="whitespace-nowrap">
                          {columnLabel(col)}
                        </Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((row, idx) => (
                      <Tr key={idx}>
                        <Td align="center" className="w-12 py-1 text-xs tabular-nums text-muted-foreground first:pl-3">
                          {idx + 1}
                        </Td>
                        {columns.map((col) => (
                          <Td key={col} className="min-w-34 px-1 py-1 last:pr-3">
                            <Input
                              value={row[col] ? String(row[col]) : ""}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) => handleFieldChange(idx, col, e.target.value)}
                              aria-label={`Row ${idx + 1} ${col.replace(/([A-Z])/g, " $1").trim().toLowerCase()}`}
                              className="h-9 rounded-lg border-transparent bg-transparent px-2 text-xs shadow-none hover:border-border focus:bg-background"
                            />
                          </Td>
                        ))}
                      </Tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {step === "result" && (
          <div>
            {loading ? (
              <SkeletonGroup label="Importing users…" className="grid grid-cols-2 gap-3">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </SkeletonGroup>
            ) : uploadResult?.error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-3.5 py-3 text-sm font-normal text-destructive ring-1 ring-inset ring-destructive/20"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0">{uploadResult.message}</span>
              </div>
            ) : uploadResult ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <ResultTile tone="good" value={Number(uploadResult.created ?? 0)} label="Created" />
                  <ResultTile tone={problemCount > 0 ? "warn" : "neutral"} value={problemCount} label="Skipped or failed" />
                </div>

                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <section aria-label="Rows with problems" className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Eyebrow>Rows with problems</Eyebrow>
                      <span className="text-[11px] font-normal text-destructive">
                        {formatNumber(uploadResult.errors.length)} {uploadResult.errors.length === 1 ? "issue" : "issues"}
                      </span>
                    </div>
                    <ul className={cn("max-h-56 divide-y divide-border/30 overflow-y-auto overscroll-contain rounded-2xl", INSET)}>
                      {uploadResult.errors.map((err, idx) => (
                        <li key={idx} className="flex min-w-0 flex-col gap-0.5 px-3.5 py-2.5">
                          <div className="flex min-w-0 items-center gap-2 text-xs">
                            <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-normal tabular-nums text-destructive">
                              Row {err.row}
                            </span>
                            <span className="truncate font-normal text-foreground">{err.email}</span>
                          </div>
                          <p className="wrap-break-word text-xs text-muted-foreground">{err.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}
