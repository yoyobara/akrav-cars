"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { patch, post } from "@/lib/client";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui";

export type CarFormValues = {
  id?: string;
  nickname: string;
  make: string | null;
  model: string | null;
  year: number | null;
  plate: string | null;
  colour: string | null;
  photoUrl: string | null;
  notes: string | null;
  isActive: boolean;
};

const blank: CarFormValues = {
  nickname: "",
  make: null,
  model: null,
  year: null,
  plate: null,
  colour: null,
  photoUrl: null,
  notes: null,
  isActive: true,
};

export function CarForm({ car }: { car?: CarFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState<CarFormValues>(car ?? blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof CarFormValues>(key: K, value: CarFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const body = {
      nickname: values.nickname,
      make: values.make || null,
      model: values.model || null,
      year: values.year ?? null,
      plate: values.plate || null,
      colour: values.colour || null,
      photoUrl: values.photoUrl || null,
      notes: values.notes || null,
      isActive: values.isActive,
    };

    try {
      if (car?.id) {
        await patch(`/api/cars/${car.id}`, body);
        router.push("/admin/cars");
      } else {
        // A new car has nobody on its insurance yet, so go straight to the
        // page where the admin says who can drive it.
        const { car: created } = await post<{ car: { id: string } }>("/api/cars", body);
        router.push(`/admin/cars/${created.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the car.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Nickname" hint="What people actually call it: “the Mazda”, “Dad’s car”.">
        <input
          className={inputClass}
          value={values.nickname}
          onChange={(e) => set("nickname", e.target.value)}
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Make">
          <input className={inputClass} value={values.make ?? ""} onChange={(e) => set("make", e.target.value)} />
        </Field>
        <Field label="Model">
          <input className={inputClass} value={values.model ?? ""} onChange={(e) => set("model", e.target.value)} />
        </Field>
        <Field label="Year">
          <input
            className={inputClass}
            inputMode="numeric"
            value={values.year ?? ""}
            onChange={(e) => set("year", e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
        <Field label="Colour">
          <input className={inputClass} value={values.colour ?? ""} onChange={(e) => set("colour", e.target.value)} />
        </Field>
      </div>

      <Field label="Plate">
        <input className={inputClass} value={values.plate ?? ""} onChange={(e) => set("plate", e.target.value)} />
      </Field>
      <Field label="Photo URL" hint="Optional.">
        <input
          className={inputClass}
          value={values.photoUrl ?? ""}
          onChange={(e) => set("photoUrl", e.target.value)}
          placeholder="https://…"
        />
      </Field>
      <Field label="Notes">
        <textarea
          className={`${inputClass} min-h-16`}
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>

      {car?.id && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={!values.isActive}
            onChange={(e) => set("isActive", !e.target.checked)}
          />
          Archived — hide from the garage
        </label>
      )}

      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" className="w-full" disabled={busy || !values.nickname}>
        {busy ? "Saving…" : car?.id ? "Save changes" : "Add car"}
      </Button>
    </form>
  );
}
