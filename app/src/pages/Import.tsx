import { useRef, useState } from "react";
import { Link } from "react-router";
import Navbar from "@/components/Navbar";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, FileJson, FileSpreadsheet, ChevronLeft } from "lucide-react";
import type { Import as ImportRecord } from "@contracts/types";

const SAMPLE_CSV = `title,price,addressLine1,city,state,zip,beds,baths,sqft,propertyType,lat,lng
"Craftsman near downtown",485000,"12 Oak Ave",Austin,TX,78701,4,3,2400,house,30.2672,-97.7431
"Brick colonial with yard",620000,"88 Elm St",Plano,TX,75023,5,4,3100,house,33.0198,-96.6989`;

export default function Import() {
  const { isLoading } = useAuth({ redirectOnUnauthenticated: true });
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [format, setFormat] = useState<"csv" | "json" | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [result, setResult] = useState<ImportRecord | null>(null);
  const [parseError, setParseError] = useState("");

  const doImport = trpc.imports.create.useMutation({
    onSuccess: (r) => {
      setResult(r);
      setRows([]);
      toast.success(
        `Import finished: ${r.successRows} created, ${r.failedRows} failed`,
      );
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return null;

  const onFile = (file: File) => {
    setParseError("");
    setResult(null);
    setFilename(file.name);
    const isJson = file.name.toLowerCase().endsWith(".json");
    setFormat(isJson ? "json" : "csv");

    if (isJson) {
      file.text().then((text) => {
        try {
          const data = JSON.parse(text);
          const arr = Array.isArray(data) ? data : data.listings ?? data.data;
          if (!Array.isArray(arr)) throw new Error("JSON must be an array of objects");
          setRows(arr.slice(0, 5000));
        } catch (e) {
          setParseError(e instanceof Error ? e.message : "Invalid JSON");
          setRows([]);
        }
      });
    } else {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => setRows(res.data.slice(0, 5000)),
        error: (e) => {
          setParseError(e.message);
          setRows([]);
        },
      });
    }
  };

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "proplink-import-sample.csv";
    a.click();
  };

  const previewCols = rows.length ? Object.keys(rows[0]).slice(0, 7) : [];

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link
          to="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold sm:text-3xl">Bulk import</h1>
        <p className="mt-1 text-muted-foreground">
          Upload a CSV or JSON file with your listings. Flexible column names —
          we map <code>address</code>, <code>bedrooms</code>,{" "}
          <code>latitude/longitude</code> and friends automatically.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card
            className="cursor-pointer border-2 border-dashed shadow-none transition-colors hover:border-primary/60"
            onClick={() => fileRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <Upload className="h-8 w-8 text-primary" />
              <p className="font-medium">Drop or choose a file</p>
              <p className="text-xs text-muted-foreground">
                .csv or .json, up to 5,000 rows
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="flex h-full flex-col justify-center gap-3 p-6">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                CSV with a header row
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileJson className="h-4 w-4 text-amber-600" />
                JSON array (or {"{ listings: [...] }"})
              </div>
              <Button variant="outline" size="sm" onClick={downloadSample}>
                Download CSV sample
              </Button>
            </CardContent>
          </Card>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />

        {parseError && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {parseError}
          </p>
        )}

        {rows.length > 0 && (
          <Card className="mt-6 border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{filename}</p>
                  <p className="text-sm text-muted-foreground">
                    {rows.length} rows parsed · format {format?.toUpperCase()}
                  </p>
                </div>
                <Button
                  disabled={doImport.isPending}
                  onClick={() =>
                    format &&
                    doImport.mutate({ filename, format, rows })
                  }
                >
                  {doImport.isPending ? "Importing…" : `Import ${rows.length} rows`}
                </Button>
              </div>
              <div className="mt-4 overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      {previewCols.map((c) => (
                        <TableHead key={c}>{c}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 8).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{i + 1}</TableCell>
                        {previewCols.map((c) => (
                          <TableCell key={c} className="max-w-[180px] truncate">
                            {String(r[c] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 8 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  …and {rows.length - 8} more rows
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="mt-6 border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Badge className="border-0 bg-green-100 text-green-700">
                  {result.successRows} imported
                </Badge>
                {result.failedRows > 0 && (
                  <Badge className="border-0 bg-red-100 text-red-700">
                    {result.failedRows} failed
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  of {result.totalRows} rows
                </span>
              </div>
              {!!result.errors?.length && (
                <div className="mt-4 max-h-64 overflow-y-auto rounded-lg bg-red-50 p-4">
                  {result.errors.slice(0, 50).map((e, i) => (
                    <p key={i} className="text-xs text-red-700">
                      Row {e.row}: {e.message}
                    </p>
                  ))}
                </div>
              )}
              <Button asChild className="mt-4" variant="outline">
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
