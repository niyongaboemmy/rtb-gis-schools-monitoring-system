import React, { useState, useRef } from "react";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Input } from "../ui/input";
import {
  AlertCircle,
  UploadCloud,
  Download,
  Loader2,
  Save,
} from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkUploadModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep("upload");
    setParsedData([]);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
        setParsedData(data);
        setStep("preview");
      } catch (err) {
        alert(
          "Failed to parse the file. Please ensure it is a valid Excel document.",
        );
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      alert("Error reading file");
      setLoading(false);
    };
    reader.readAsBinaryString(file);
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
      const res = await api.post("/users/bulk-json", { rows: parsedData });
      setUploadResult(res.data);
      setStep("result");
      onSuccess();
    } catch (err: any) {
      setUploadResult({
        error: true,
        message: err.response?.data?.message || "Failed to bulk create records",
      });
      setStep("result");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const token = useAuthStore.getState().token;
    fetch(`${import.meta.env.VITE_API_URL}/users/upload/template`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "users_upload_template.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth={step === "preview" ? "max-w-5xl" : "max-w-md"}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            {loading ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : step === "result" && uploadResult?.error ? (
              <AlertCircle className="w-5 h-5 text-destructive" />
            ) : step === "result" && uploadResult?.errors?.length > 0 ? (
              <AlertCircle className="w-5 h-5 text-amber-500" />
            ) : (
              <UploadCloud className="w-5 h-5 text-emerald-500" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold uppercase tracking-tight text-foreground">
              {step === "upload" && "Bulk Import"}
              {step === "preview" && "Preview & Edit Data"}
              {step === "result" && "Import Results"}
            </span>
            <span className="text-[10px] font-medium tracking-normal normal-case text-muted-foreground">
              {loading && "Working..."}
              {!loading && step === "upload" && "Select an Excel template"}
              {!loading &&
                step === "preview" &&
                `${parsedData.length} records ready to push`}
              {!loading && step === "result" && "Final processing summary"}
            </span>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          {step !== "result" ? (
            <Button
              variant="link"
              className="text-primary p-0 h-auto text-xs font-semibold hover:no-underline"
              onClick={downloadTemplate}
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Download Template
            </Button>
          ) : (
            <div></div> // empty spacer if no download button in result tab
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="px-6 h-9 rounded-full font-bold text-xs"
              disabled={loading}
            >
              Cancel
            </Button>
            {step === "preview" && (
              <Button
                onClick={confirmUpload}
                disabled={loading || parsedData.length === 0}
                className="px-6 h-9 rounded-full font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-white shadow-none"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Confirm Upload
              </Button>
            )}
            {step === "result" && (
              <Button
                onClick={handleClose}
                className="px-6 h-9 rounded-full font-bold text-xs"
              >
                Done
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="py-2">
        {step === "upload" && (
          <div
            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border/60 rounded-2xl bg-muted/10 cursor-pointer hover:bg-muted/30 hover:border-primary/40 transition-all duration-300"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h4 className="text-sm font-bold text-foreground">
              Click to browse your files
            </h4>
            <p className="text-xs text-muted-foreground mt-2">
              Supports .xlsx and .xls formats
            </p>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
          </div>
        )}

        {step === "preview" && (
          <div className="border border-border/20 rounded-xl overflow-hidden mt-2">
            <div className="max-h-[60vh] overflow-y-auto">
              {parsedData.length === 0 ? (
                <div className="p-8 text-center text-sm font-semibold text-muted-foreground">
                  The uploaded file contains no data rows.
                </div>
              ) : (
                <Table wrapperClassName="border-0 rounded-none bg-transparent">
                  <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-md">
                    <TableRow className="border-border/20">
                      <TableHead className="w-12 text-center text-[10px] uppercase font-black tracking-widest">
                        #
                      </TableHead>
                      {columns.map((col) => (
                        <TableHead
                          key={col}
                          className="text-[10px] uppercase font-black tracking-widest whitespace-nowrap"
                        >
                          {col.replace(/([A-Z])/g, " $1").trim()}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, idx) => (
                      <TableRow
                        key={idx}
                        className="border-border/10 hover:bg-muted/30"
                      >
                        <TableCell className="w-12 text-center text-xs font-mono text-muted-foreground font-bold">
                          {idx + 1}
                        </TableCell>
                        {columns.map((col) => (
                          <TableCell key={col} className="p-1 min-w-[120px]">
                            <Input
                              value={row[col] || ""}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) => handleFieldChange(idx, col, e.target.value)}
                              className="h-8 text-xs font-medium bg-transparent border-transparent hover:border-border focus:bg-background shadow-none px-2 rounded-md"
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}

        {step === "result" && (
          <div>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                <p className="text-sm font-semibold text-muted-foreground animate-pulse">
                  Uploading identities...
                </p>
              </div>
            ) : uploadResult?.error ? (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm font-semibold text-destructive">
                {uploadResult.message}
              </div>
            ) : uploadResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                      {uploadResult.created}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70">
                      Created
                    </span>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
                      {uploadResult.skipped +
                        (uploadResult.errors?.length || 0)}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600/70 dark:text-amber-400/70">
                      Skipped/Failed
                    </span>
                  </div>
                </div>

                {uploadResult.errors?.length > 0 && (
                  <div className="mt-6 border border-border/20 rounded-xl overflow-hidden shadow-xs">
                    <div className="bg-muted px-4 py-2 border-b border-border/20 text-xs font-bold flex justify-between">
                      <span>Error Log</span>
                      <span className="text-destructive">
                        {uploadResult.errors.length} issues
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto w-full overscroll-contain">
                      <Table wrapperClassName="border-0 rounded-none bg-transparent h-full max-h-none">
                        <TableHeader className="bg-muted/30 sticky top-0 z-10 hidden">
                          <TableRow className="border-border/20">
                            <TableHead className="py-2 h-auto text-[10px]">
                              Row
                            </TableHead>
                            <TableHead className="py-2 h-auto text-[10px]">
                              Email
                            </TableHead>
                            <TableHead className="py-2 h-auto text-[10px]">
                              Reason
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uploadResult.errors.map((err: any, idx: number) => (
                            <TableRow key={idx} className="border-border/10">
                              <TableCell className="py-1.5 text-[10px] font-mono whitespace-nowrap align-top">
                                #{err.row}
                              </TableCell>
                              <TableCell className="py-1.5 text-[10px] font-medium align-top truncate max-w-[120px]">
                                {err.email}
                              </TableCell>
                              <TableCell className="py-1.5 text-[10px] text-destructive/80 font-medium whitespace-normal wrap-break-word leading-tight">
                                {err.reason}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}
