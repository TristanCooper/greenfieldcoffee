'use client';

import { useState } from 'react';
import {
  Banner,
  Button,
  Card,
  CardMeta,
  CardTitle,
  Input,
  PageHeader,
  Pill,
  Select,
  StepBody,
  StepIndicator,
  Textarea,
  type Step,
} from '@greenfield/ui';
import { createClient } from '@/lib/supabase/client';

const STEPS: readonly Step[] = [
  { label: 'Supplier', description: 'Who delivered this coffee?' },
  { label: 'Producer', description: 'Who grew it?' },
  { label: 'Geolocation', description: 'Where exactly?' },
  { label: 'Lot details', description: 'Variety, weight, date' },
  { label: 'Review', description: 'Confirm and receive' },
];

interface FormState {
  supplierName: string;
  supplierCountryCode: string;
  producerName: string;
  producerCountryCode: string;
  producerRegion: string;
  producerType: 'cooperative' | 'estate' | 'smallholder' | 'other';
  producerLatitude: string;
  producerLongitude: string;
  geolocationSource: 'gps' | 'polygon' | 'centroid' | 'manual';
  geolocationAccuracyM: string;
  deforestationRiskClass: 'low' | 'standard' | 'high';
  variety: string;
  processingMethod: '' | 'washed' | 'natural' | 'honey' | 'anaerobic' | 'other';
  grade: string;
  greenWeightKg: string;
  receivedOn: string;
  notes: string;
}

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

const COUNTRY_CHOICES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'KE', name: 'Kenya' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'CO', name: 'Colombia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'PE', name: 'Peru' },
  { code: 'PA', name: 'Panama' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IN', name: 'India' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'NL', name: 'Netherlands' },
];

const initialState: FormState = {
  supplierName: '',
  supplierCountryCode: 'GB',
  producerName: '',
  producerCountryCode: 'KE',
  producerRegion: '',
  producerType: 'cooperative',
  producerLatitude: '',
  producerLongitude: '',
  geolocationSource: 'gps',
  geolocationAccuracyM: '',
  deforestationRiskClass: 'standard',
  variety: '',
  processingMethod: '',
  grade: '',
  greenWeightKg: '',
  receivedOn: TODAY_ISO(),
  notes: '',
};

export default function ReceiveGreenPage() {
  return (
    <>
      <PageHeader title="Receive green" crumb="EUDR intake · Step 1 of 5" />
      <ReceiveGreenWizard />
    </>
  );
}

function ReceiveGreenWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    | null
    | { ok: true; lotId: string; lotCode: string }
    | { ok: false; error: string }
  >(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const stepValid = (() => {
    if (stepIndex === 0) return form.supplierName.trim().length > 0;
    if (stepIndex === 1) return form.producerName.trim().length > 0;
    if (stepIndex === 2) {
      const lat = form.producerLatitude.trim();
      const lng = form.producerLongitude.trim();
      // Lat/lng are optional — but if either is set, both must be.
      if (lat === '' && lng === '') return true;
      const latN = Number(lat);
      const lngN = Number(lng);
      return (
        Number.isFinite(latN) &&
        Number.isFinite(lngN) &&
        latN >= -90 &&
        latN <= 90 &&
        lngN >= -180 &&
        lngN <= 180
      );
    }
    if (stepIndex === 3) {
      const w = Number(form.greenWeightKg);
      return Number.isFinite(w) && w > 0 && form.receivedOn !== '';
    }
    return true;
  })();

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in.');

      const body = {
        supplierName: form.supplierName.trim(),
        supplierCountryCode: form.supplierCountryCode,
        producerName: form.producerName.trim(),
        producerCountryCode: form.producerCountryCode,
        producerRegion: form.producerRegion.trim() || null,
        producerType: form.producerType,
        producerLatitude:
          form.producerLatitude.trim() === '' ? null : Number(form.producerLatitude),
        producerLongitude:
          form.producerLongitude.trim() === '' ? null : Number(form.producerLongitude),
        geolocationSource: form.geolocationSource,
        geolocationAccuracyM:
          form.geolocationAccuracyM.trim() === '' ? null : Number(form.geolocationAccuracyM),
        deforestationRiskClass: form.deforestationRiskClass,
        variety: form.variety.trim() || null,
        processingMethod: form.processingMethod || null,
        grade: form.grade.trim() || null,
        greenWeightKg: Number(form.greenWeightKg),
        receivedOn: form.receivedOn,
        notes: form.notes.trim() || null,
      };

      const res = await fetch('/api/lots/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as
        | { ok: true; lotId: string; lotCode: string }
        | { error: string };
      if (!res.ok || 'error' in json) {
        const message = 'error' in json ? json.error : 'Receive failed.';
        setError(message);
        setResult({ ok: false, error: message });
        return;
      }
      setResult({ ok: true, lotId: json.lotId, lotCode: json.lotCode });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error.';
      setError(message);
      setResult({ ok: false, error: message });
    } finally {
      setSubmitting(false);
    }
  }

  if (result && result.ok) {
    return (
      <Card>
        <CardTitle>Received</CardTitle>
        <CardMeta>Lot code: {result.lotCode}</CardMeta>
        <div className="mt-4 flex gap-3">
          <Button onClick={() => { setResult(null); setForm(initialState); setStepIndex(0); }}>
            Receive another
          </Button>
          <a href="/dashboard/stock">
            <Button variant="secondary">View stock</Button>
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <StepIndicator steps={STEPS} currentIndex={stepIndex} />
      <StepBody>
        {error && <Banner tone="bad">{error}</Banner>}
        {stepIndex === 0 && (
          <SupplierStep form={form} update={update} />
        )}
        {stepIndex === 1 && (
          <ProducerStep form={form} update={update} />
        )}
        {stepIndex === 2 && (
          <GeolocationStep form={form} update={update} />
        )}
        {stepIndex === 3 && (
          <LotDetailsStep form={form} update={update} />
        )}
        {stepIndex === 4 && <ReviewStep form={form} />}
      </StepBody>
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={stepIndex === 0 || submitting}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
        >
          Back
        </Button>
        <div className="flex gap-3">
          {stepIndex < STEPS.length - 1 ? (
            <Button
              disabled={!stepValid}
              onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
            >
              Continue
            </Button>
          ) : (
            <Button disabled={submitting} onClick={submit}>
              {submitting ? 'Receiving…' : 'Receive lot'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function SupplierStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="supplierName" className="mb-1 block text-xs text-ink-2">
          Supplier name
        </label>
        <Input
          id="supplierName"
          value={form.supplierName}
          onChange={(e) => update('supplierName', e.target.value)}
          placeholder="e.g. Hasbean Coffee"
        />
      </div>
      <div>
        <label htmlFor="supplierCountry" className="mb-1 block text-xs text-ink-2">
          Supplier country
        </label>
        <Select
          id="supplierCountry"
          value={form.supplierCountryCode}
          onChange={(e) => update('supplierCountryCode', e.target.value)}
        >
          {COUNTRY_CHOICES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function ProducerStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="producerName" className="mb-1 block text-xs text-ink-2">
          Producer name
        </label>
        <Input
          id="producerName"
          value={form.producerName}
          onChange={(e) => update('producerName', e.target.value)}
          placeholder="e.g. Kiandu Farmers Cooperative Society"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="producerCountry" className="mb-1 block text-xs text-ink-2">
            Producer country
          </label>
          <Select
            id="producerCountry"
            value={form.producerCountryCode}
            onChange={(e) => update('producerCountryCode', e.target.value)}
          >
            {COUNTRY_CHOICES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="producerRegion" className="mb-1 block text-xs text-ink-2">
            Region (optional)
          </label>
          <Input
            id="producerRegion"
            value={form.producerRegion}
            onChange={(e) => update('producerRegion', e.target.value)}
            placeholder="e.g. Nyeri"
          />
        </div>
      </div>
      <div>
        <label htmlFor="producerType" className="mb-1 block text-xs text-ink-2">
          Producer type
        </label>
        <Select
          id="producerType"
          value={form.producerType}
          onChange={(e) => update('producerType', e.target.value as FormState['producerType'])}
        >
          <option value="cooperative">Cooperative</option>
          <option value="estate">Estate</option>
          <option value="smallholder">Smallholder</option>
          <option value="other">Other</option>
        </Select>
      </div>
    </div>
  );
}

function GeolocationStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-ink-3">
        Producer geolocation. Either both lat/lng or neither. If you have a
        polygon, enter its centroid.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="lat" className="mb-1 block text-xs text-ink-2">
            Latitude
          </label>
          <Input
            id="lat"
            type="number"
            step="0.0001"
            value={form.producerLatitude}
            onChange={(e) => update('producerLatitude', e.target.value)}
            placeholder="e.g. -0.42"
          />
        </div>
        <div>
          <label htmlFor="lng" className="mb-1 block text-xs text-ink-2">
            Longitude
          </label>
          <Input
            id="lng"
            type="number"
            step="0.0001"
            value={form.producerLongitude}
            onChange={(e) => update('producerLongitude', e.target.value)}
            placeholder="e.g. 36.95"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="geoSrc" className="mb-1 block text-xs text-ink-2">
            Source
          </label>
          <Select
            id="geoSrc"
            value={form.geolocationSource}
            onChange={(e) => update('geolocationSource', e.target.value as FormState['geolocationSource'])}
          >
            <option value="gps">GPS</option>
            <option value="polygon">Polygon centroid</option>
            <option value="centroid">Administrative centroid</option>
            <option value="manual">Manual entry</option>
          </Select>
        </div>
        <div>
          <label htmlFor="acc" className="mb-1 block text-xs text-ink-2">
            Accuracy (m, optional)
          </label>
          <Input
            id="acc"
            type="number"
            min="0"
            value={form.geolocationAccuracyM}
            onChange={(e) => update('geolocationAccuracyM', e.target.value)}
            placeholder="e.g. 25"
          />
        </div>
      </div>
      <div>
        <label htmlFor="risk" className="mb-1 block text-xs text-ink-2">
          Deforestation risk class
        </label>
        <Select
          id="risk"
          value={form.deforestationRiskClass}
          onChange={(e) =>
            update('deforestationRiskClass', e.target.value as FormState['deforestationRiskClass'])
          }
        >
          <option value="low">Low (EU low-risk benchmark)</option>
          <option value="standard">Standard</option>
          <option value="high">High (elevated due diligence required)</option>
        </Select>
        <p className="mt-1 text-xs text-ink-3">
          Defaults to standard. Update if you have a country- or region-specific assessment.
        </p>
      </div>
    </div>
  );
}

function LotDetailsStep({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="variety" className="mb-1 block text-xs text-ink-2">
            Variety (optional)
          </label>
          <Input
            id="variety"
            value={form.variety}
            onChange={(e) => update('variety', e.target.value)}
            placeholder="e.g. SL28, Heirloom"
          />
        </div>
        <div>
          <label htmlFor="process" className="mb-1 block text-xs text-ink-2">
            Processing (optional)
          </label>
          <Select
            id="process"
            value={form.processingMethod}
            onChange={(e) => update('processingMethod', e.target.value as FormState['processingMethod'])}
          >
            <option value="">—</option>
            <option value="washed">Washed</option>
            <option value="natural">Natural</option>
            <option value="honey">Honey</option>
            <option value="anaerobic">Anaerobic</option>
            <option value="other">Other</option>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="grade" className="mb-1 block text-xs text-ink-2">
            Grade (optional)
          </label>
          <Input
            id="grade"
            value={form.grade}
            onChange={(e) => update('grade', e.target.value)}
            placeholder="e.g. AA, 85+"
          />
        </div>
        <div>
          <label htmlFor="weight" className="mb-1 block text-xs text-ink-2">
            Green weight (kg)
          </label>
          <Input
            id="weight"
            type="number"
            step="0.1"
            min="0.1"
            required
            value={form.greenWeightKg}
            onChange={(e) => update('greenWeightKg', e.target.value)}
            placeholder="e.g. 60"
          />
        </div>
      </div>
      <div>
        <label htmlFor="received" className="mb-1 block text-xs text-ink-2">
          Date received
        </label>
        <Input
          id="received"
          type="date"
          required
          value={form.receivedOn}
          onChange={(e) => update('receivedOn', e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="notes" className="mb-1 block text-xs text-ink-2">
          Notes (optional)
        </label>
        <Textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Anything else worth remembering about this lot."
        />
      </div>
    </div>
  );
}

function ReviewStep({ form }: { form: FormState }) {
  const countryName = (code: string) =>
    COUNTRY_CHOICES.find((c) => c.code === code)?.name ?? code;
  const riskTone =
    form.deforestationRiskClass === 'high'
      ? 'bad'
      : form.deforestationRiskClass === 'low'
        ? 'ok'
        : 'warn';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <ReviewCard title="Supplier">
          <ReviewRow label="Name" value={form.supplierName || '—'} />
          <ReviewRow label="Country" value={countryName(form.supplierCountryCode)} />
        </ReviewCard>
        <ReviewCard title="Producer">
          <ReviewRow label="Name" value={form.producerName || '—'} />
          <ReviewRow label="Country" value={countryName(form.producerCountryCode)} />
          <ReviewRow label="Region" value={form.producerRegion || '—'} />
          <ReviewRow label="Type" value={form.producerType} />
        </ReviewCard>
      </div>
      <ReviewCard title="Geolocation & EUDR">
        <ReviewRow
          label="Latitude / Longitude"
          value={
            form.producerLatitude && form.producerLongitude
              ? `${form.producerLatitude}, ${form.producerLongitude}`
              : 'Not provided'
          }
        />
        <ReviewRow label="Source" value={form.geolocationSource} />
        <ReviewRow
          label="Accuracy"
          value={form.geolocationAccuracyM ? `${form.geolocationAccuracyM} m` : '—'}
        />
        <ReviewRow
          label="Deforestation risk"
          value={
            <Pill tone={riskTone}>{form.deforestationRiskClass}</Pill>
          }
        />
      </ReviewCard>
      <ReviewCard title="Lot">
        <ReviewRow label="Variety" value={form.variety || '—'} />
        <ReviewRow label="Processing" value={form.processingMethod || '—'} />
        <ReviewRow label="Grade" value={form.grade || '—'} />
        <ReviewRow label="Green weight" value={`${form.greenWeightKg || '0'} kg`} />
        <ReviewRow label="Date received" value={form.receivedOn} />
        {form.notes && <ReviewRow label="Notes" value={form.notes} />}
      </ReviewCard>
      <p className="m-0 text-xs text-ink-3">
        On confirm, the lot is created and recorded in stock. A row is added
        to the audit log with your name and timestamp.
      </p>
    </div>
  );
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-line bg-bg-subtle p-3">
      <h4 className="m-0 mb-2 text-xs uppercase tracking-wider text-ink-3">{title}</h4>
      <dl className="m-0 flex flex-col gap-1">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}