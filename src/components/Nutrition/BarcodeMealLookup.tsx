"use client";

import { useEffect, useRef, useState } from "react";
import { Barcode, Camera, Check, Loader2, Pencil } from "lucide-react";
import type { Nutrients } from "@/lib/nutrition/types";
import { normalizeBarcode } from "@/lib/nutrition/barcode";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type LookupItem = {
  barcode: string;
  source: string;
  sourceId: string;
  description: string;
  brand?: string | null;
  servingGram?: number | null;
  per: "100g" | "serving";
  nutrients: Nutrients;
  sourceSnapshot?: { source: string; sourceId: string; fetchedAt: string };
};

const fields: Array<keyof Nutrients> = ["kcal", "protein_g", "fat_g", "carb_g", "fiber_g", "sugar_g", "sodium_mg"];
const emptyNutrients = (): Nutrients => ({ kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0, sat_fat_g: 0, cholesterol_mg: 0, potassium_mg: 0 });

export function BarcodeMealLookup({ onLogged }: { onLogged?: () => void }) {
  const [code, setCode] = useState("");
  const [item, setItem] = useState<LookupItem | null>(null);
  const [nutrients, setNutrients] = useState<Nutrients | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [mealType, setMealType] = useState<MealType>("snack");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState<string | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const lookup = async (raw = code) => {
    const normalized = normalizeBarcode(raw);
    if (!normalized) { setMessage("Enter a valid UPC-A or EAN-13, including its check digit."); return; }
    setStatus("loading"); setMessage(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(`/api/foods/upc?code=${normalized.code}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data?.item) {
        setName(""); setNutrients(emptyNutrients());
        setMessage(response.status === 404 ? "Barcode not found. Create a private food record below; no nutrition was guessed." : data?.error ?? "Lookup unavailable; use a private food record.");
      } else {
        setItem(data.item); setName(data.item.description); setNutrients(data.item.nutrients); setQuantity(data.item.per === "100g" ? (data.item.servingGram ?? 100) : 1);
        setMessage("Review the source snapshot and edit any field before saving.");
      }
    } catch (error) {
      setName(""); setNutrients(emptyNutrients());
      setMessage(error instanceof DOMException && error.name === "AbortError" ? "Lookup timed out; use a private food record." : "Offline or source unavailable; use a private food record.");
    } finally { window.clearTimeout(timeout); setStatus("idle"); }
  };

  const startCamera = async () => {
    setMessage(null); setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const Detector = (window as typeof window & { BarcodeDetector?: new () => { detect(video: HTMLVideoElement): Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
      if (!Detector) { setMessage("Camera is on. This browser cannot decode automatically, so type the barcode below."); return; }
      const detector = new Detector();
      const tick = async () => {
        if (!videoRef.current) return;
        const found = await detector.detect(videoRef.current);
        if (found[0]?.rawValue) { setCode(found[0].rawValue); setCameraOpen(false); streamRef.current?.getTracks().forEach((track) => track.stop()); await lookup(found[0].rawValue); }
        else window.setTimeout(tick, 250);
      };
      window.setTimeout(tick, 500);
    } catch { setCameraOpen(false); setMessage("Camera access was denied. Type or paste the barcode instead."); }
  };

  const save = async () => {
    if (!name.trim() || !nutrients) { setMessage("Name and nutrition values are required for a private record."); return; }
    setStatus("saving");
    const now = new Date();
    const idempotencyKey = `barcode:${item?.barcode ?? code}:${now.toISOString().slice(0, 16)}`;
    const response = await fetch("/api/foods/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      source: item?.source ?? "private", sourceId: item?.sourceId ?? null, barcode: item?.barcode ?? normalizeBarcode(code)?.code ?? null,
      sourceSnapshot: item?.sourceSnapshot ?? null, idempotencyKey, itemName: name.trim(), brand: item?.brand ?? null,
      quantity, unit: item?.per === "100g" ? "g" : "serving", gramWeight: item?.per === "100g" ? quantity : item?.servingGram ? item.servingGram * quantity : null,
      nutrients, mealType, loggedAt: now.toISOString(), localDate: now.toLocaleDateString("en-CA"), localTime: now.toTimeString().slice(0, 8),
    }) });
    const data = await response.json();
    if (!response.ok || !data?.ok) { setMessage(data?.error ?? "Unable to save meal"); setStatus("idle"); return; }
    setMessage(data.duplicate ? "Already saved; duplicate retry did not create another meal." : "Meal saved to your private history and daily journal.");
    setItem(null); setNutrients(null); setStatus("idle"); onLogged?.();
  };

  return <div className="mt-5 rounded-xl border border-cyan-400/30 bg-cyan-950/20 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="flex items-center gap-2 font-semibold text-white"><Barcode className="h-5 w-5 text-cyan-300" /> Barcode food lookup</h3><p className="text-xs text-slate-400">Private review step: source data is never saved until you confirm.</p></div>
      <button type="button" onClick={startCamera} className="flex items-center gap-2 rounded-lg border border-cyan-300/40 px-3 py-2 text-sm text-cyan-100"><Camera className="h-4 w-4" /> Scan with camera</button>
    </div>
    {cameraOpen && <div className="mt-3"><video ref={videoRef} autoPlay playsInline className="max-h-48 w-full rounded-lg bg-black object-cover" /><button type="button" onClick={() => { setCameraOpen(false); streamRef.current?.getTracks().forEach((track) => track.stop()); }} className="mt-2 text-xs text-slate-300">Stop camera</button></div>}
    <div className="mt-3 flex gap-2"><input value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && lookup()} inputMode="numeric" placeholder="UPC-A or EAN-13" className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" /><button type="button" onClick={() => lookup()} disabled={status === "loading"} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">{status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}</button></div>
    {message && <p className="mt-2 text-sm text-cyan-100">{message}</p>}
    {nutrients && <div className="mt-4 space-y-3 rounded-lg border border-slate-700 bg-slate-950/60 p-3"><div className="flex items-center justify-between"><div><p className="font-medium text-white">{item?.brand ? `${item.brand} — ` : ""}{name || "Private food"}</p><p className="text-xs text-slate-400">{item ? `Source: ${item.source} · ${item.barcode}` : "Private user-authored record"}</p></div><Pencil className="h-4 w-4 text-cyan-300" /></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{fields.map((field) => <label key={field} className="text-xs text-slate-400">{field}<input type="number" value={nutrients[field] ?? 0} onChange={(event) => setNutrients({ ...nutrients, [field]: Number(event.target.value) || 0 })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white" /></label>)}</div><div className="flex flex-wrap gap-2"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Food name" className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white" /><input type="number" min="0.25" step="0.25" value={quantity} onChange={(event) => setQuantity(Math.max(0.25, Number(event.target.value) || 0.25))} className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white" /><select value={mealType} onChange={(event) => setMealType(event.target.value as MealType)} className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select><button type="button" onClick={save} disabled={status === "saving"} className="flex items-center gap-1 rounded bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950"><Check className="h-4 w-4" /> Confirm meal</button></div></div>}
  </div>;
}
