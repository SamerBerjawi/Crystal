import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AssistantError } from '../utils/assistantAgent';
import {
  describePullStatus, fetchAssistantSettings, listInstalledModels, modelSupportsTools, pullModel, removeModel, saveAssistantSettings, testAssistant,
  type AssistantSettings, type InstalledModel, type PullProgress,
} from '../utils/assistantApi';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { TextInput } from './ui/Fields';
import { ConfirmDialog } from './ui/Overlays';
import { Select } from './ui/Pickers';
import { Banner } from './ui/States';

const PROVIDERS = [
  { id: 'builtin', label: 'Built-in engine', description: 'Crystal runs the model next to your data. Nothing leaves your server.' },
  { id: 'custom', label: 'A model server I already have', description: 'Ollama, LM Studio, llama.cpp, vLLM, or a hosted service' },
];

const gigabytes = (bytes?: number) => (bytes ? `${(bytes / 1e9).toFixed(1)} GB` : '');
const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

const Progress: React.FC<{ percent: number | null; label: string }> = ({ percent, label }) => (
  <div>
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined} className="h-1.5 overflow-hidden rounded-full bg-inset">
      <div className="h-full rounded-full bg-primary transition-[width] duration-[var(--duration-slow)]" style={{ width: `${percent ?? 4}%` }} />
    </div>
  </div>
);

/** Which language model Ask Crystal uses: one Crystal runs for you, or one you already have. */
const AssistantSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [provider, setProvider] = useState<'builtin' | 'custom'>('builtin');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [models, setModels] = useState<InstalledModel[]>([]);
  const [customName, setCustomName] = useState('');
  const [pull, setPull] = useState<{ name: string; progress: PullProgress | null } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const refreshModels = useCallback(async () => {
    try { setModels(await listInstalledModels()); } catch { setModels([]); }
  }, []);

  const apply = useCallback((next: AssistantSettings) => {
    setSettings(next);
    setProvider(next.provider);
    setBaseUrl(next.baseUrl);
    setModelName(next.model);
    setApiKey('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAssistantSettings()
      .then(next => {
        if (cancelled) return;
        apply(next);
        if ((next.provider === 'builtin' && next.builtin.reachable) || (next.provider === 'custom' && next.baseUrl)) void refreshModels();
      })
      .catch(() => { if (!cancelled) setUnavailable(true); });
    return () => { cancelled = true; abort.current?.abort(); };
  }, [apply, refreshModels]);

  if (unavailable || !settings) return null;

  const clearMessages = () => { setError(null); setWarning(null); setNotice(null); };

  const save = async (change: Partial<{ provider: 'builtin' | 'custom'; baseUrl: string; model: string | null; apiKey: string }> = {}, success = 'Saved.') => {
    clearMessages();
    setBusy(true);
    try {
      const next = await saveAssistantSettings({
        provider: change.provider ?? provider,
        baseUrl: change.baseUrl ?? baseUrl,
        model: change.model === undefined ? (modelName || null) : change.model,
        ...((change.apiKey ?? apiKey) ? { apiKey: change.apiKey ?? apiKey } : {}),
      });
      apply(next);
      setNotice(success);
      return next;
    } catch (err) {
      setError(messageOf(err, 'Could not save.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const chooseProvider = async (id: string) => {
    const next = id as 'builtin' | 'custom';
    setProvider(next);
    clearMessages();
    setModels([]);
    if (next === 'builtin') {
      const saved = await save({ provider: 'builtin', model: null }, 'Using the built-in engine. Choose a model.');
      if (saved?.builtin.reachable) void refreshModels();
    }
  };

  const useModel = async (name: string) => {
    const saved = await save({ provider: 'builtin', model: name }, `Ask Crystal will use ${name}.`);
    if (saved) await checkTools(name);
  };

  const checkTools = async (name: string) => {
    const supported = await modelSupportsTools(name).catch(() => null);
    if (supported === false) setWarning(`${name} does not support tools, which Ask Crystal needs to look up your numbers. Choose another model.`);
  };

  const download = async (rawName: string) => {
    const name = rawName.trim();
    if (!name || pull) return;
    clearMessages();
    const controller = new AbortController();
    abort.current = controller;
    setPull({ name, progress: null });
    try {
      await pullModel(name, progress => setPull({ name, progress }), controller.signal);
      await refreshModels();
      setCustomName('');
      setNotice(`${name} is ready.`);
      const supported = await modelSupportsTools(name).catch(() => null);
      if (supported === false) setWarning(`${name} downloaded, but it does not support tools, which Ask Crystal needs. Choose another model.`);
      else if (!settings.model) await save({ provider: 'builtin', model: name }, `${name} is ready, and Ask Crystal will use it.`);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') setNotice('Download cancelled. Starting it again resumes where it stopped.');
      else setError(messageOf(err, 'The download failed.'));
    } finally {
      abort.current = null;
      setPull(null);
    }
  };

  const remove = async (name: string) => {
    setRemoving(null);
    clearMessages();
    try {
      await removeModel(name);
      await refreshModels();
      apply(await fetchAssistantSettings());
      setNotice(`${name} was removed.`);
    } catch (err) {
      setError(messageOf(err, 'Could not remove the model.'));
    }
  };

  const connect = async () => {
    const saved = await save({ provider: 'custom' }, 'Connected.');
    if (saved) await refreshModels();
  };

  const test = async () => {
    clearMessages();
    setBusy(true);
    try {
      const result = await testAssistant();
      if (result.supportsTools === false) setWarning('The model answered, but it does not support tools, which Ask Crystal needs. Choose another model.');
      else setNotice(`The model answered: "${result.reply.trim() || 'ok'}". Ask Crystal is ready.`);
    } catch (err) {
      setError(messageOf(err, 'The model did not answer.'));
    } finally {
      setBusy(false);
    }
  };

  const isReady = !!settings.model && (settings.provider === 'custom' ? !!settings.baseUrl : settings.builtin.reachable);
  const installedNames = new Set(models.map(m => m.name));
  const catalog = settings.catalog.filter(entry => !installedNames.has(entry.name) && !installedNames.has(`${entry.name}:latest`));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="type-body-strong text-ink">Ask Crystal</h3>
        <Badge tone={isReady ? 'positive' : 'attention'}>{isReady ? 'Ready' : 'Not set up'}</Badge>
        {isReady && settings.model && <Badge tone="neutral">{settings.model}</Badge>}
      </div>
      <p className="type-body text-muted">Ask questions about your money in plain words. The numbers are looked up in your browser with Crystal's own calculations; the model only chooses what to look up and words the answer. Your questions and the figures it looks up go to the model you choose here, and nowhere else.</p>

      {error && <Banner tone="error">{error}</Banner>}
      {warning && <Banner tone="attention">{warning}</Banner>}
      {notice && <Banner tone="info">{notice}</Banner>}

      <Select label="Model source" value={provider} onChange={chooseProvider} options={PROVIDERS} isDisabled={isBusy || !!pull} />

      {provider === 'builtin' ? (
        <div className="space-y-4">
          {!settings.builtin.reachable ? (
            <Banner tone="attention">
              The built-in engine is not running. Start it next to Crystal with <code className="rounded bg-inset px-1.5 py-0.5">docker compose --profile ai up -d</code>, then reload this page. It needs several GB of free memory for the model. On Umbrel, or if you already run a model server, choose "A model server I already have" instead.
            </Banner>
          ) : (
            <>
              {pull && (
                <div className="surface-card space-y-2 rounded-[var(--radius-lg)] p-3" aria-live="polite">
                  <p className="type-body-strong text-ink">Downloading {pull.name}{pull.progress?.percent != null ? `, ${pull.progress.percent}%` : ''}</p>
                  <Progress percent={pull.progress?.percent ?? null} label={`Downloading ${pull.name}`} />
                  <p className="type-caption text-muted">
                    {pull.progress?.totalBytes ? `${gigabytes(pull.progress.completedBytes)} of ${gigabytes(pull.progress.totalBytes)}. ` : ''}
                    {describePullStatus(pull.progress?.status ?? '')}. Keep this page open. If it stops, start the download again and it carries on where it left off.
                  </p>
                  <Button size="sm" variant="ghost" onPress={() => abort.current?.abort()}>Cancel</Button>
                </div>
              )}
              {models.length > 0 && (
                <div>
                  <h4 className="type-label text-muted">Installed</h4>
                  <ul className="mt-1 divide-y divide-line">
                    {models.map(model => (
                      <li key={model.name} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="type-body-strong break-words text-ink">{model.name}</p>
                          <p className="type-caption text-muted">{[gigabytes(model.sizeBytes), model.parameterSize, model.quantization].filter(Boolean).join(' · ')}</p>
                        </div>
                        {settings.model === model.name
                          ? <Badge tone="positive">In use</Badge>
                          : <Button size="sm" variant="secondary" isDisabled={isBusy || !!pull} onPress={() => void useModel(model.name)}>Use</Button>}
                        <Button size="sm" variant="ghost" isDisabled={!!pull} onPress={() => setRemoving(model.name)}>Remove</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h4 className="type-label text-muted">{models.length > 0 ? 'Download another' : 'Download a model'}</h4>
                <p className="type-caption mt-1 text-muted">Models need tool support. Sizes are approximate. Small models are faster on a NAS; larger ones answer more reliably.</p>
                <ul className="mt-1 divide-y divide-line">
                  {catalog.map(entry => (
                    <li key={entry.name} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="type-body-strong text-ink">{entry.label} <span className="type-caption font-normal text-muted">about {entry.approxGb} GB</span></p>
                        <p className="type-caption text-muted">{entry.note}</p>
                      </div>
                      <Button size="sm" variant="secondary" icon="download-04" isDisabled={!!pull || isBusy} onPress={() => void download(entry.name)}>Download</Button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <TextInput className="min-w-52 flex-1" label="Any other model" autoComplete="off" value={customName} onChange={setCustomName} placeholder="for example qwen3:14b" />
                  <Button variant="secondary" icon="download-04" isDisabled={!customName.trim() || !!pull || isBusy} onPress={() => void download(customName)}>Download</Button>
                </div>
                <p className="type-caption mt-1 text-muted">Any name from the Ollama library. After a download, Crystal checks that the model can use tools.</p>
              </div>

            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput
              label="Server address"
              autoComplete="off"
              value={baseUrl}
              onChange={setBaseUrl}
              placeholder="http://192.168.1.10:11434"
              help={settings.privateUrlsAllowed ? 'Any server that speaks the OpenAI API. Addresses on your own network are allowed.' : 'Any server that speaks the OpenAI API. Addresses on your own network need ASSISTANT_ALLOW_PRIVATE_URLS=true on the server, because other people use it.'}
            />
            <TextInput label="API key (optional)" type="password" autoComplete="new-password" value={apiKey} onChange={setApiKey} placeholder={settings.hasKey ? 'Saved. Type to replace it.' : ''} help="Stored encrypted on the server and never shown again." />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {models.length > 0 ? (
              <Select className="min-w-52 flex-1" label="Model" value={modelName || null} onChange={setModelName} options={models.map(m => ({ id: m.name, label: m.name }))} placeholder="Choose a model" />
            ) : (
              <TextInput className="min-w-52 flex-1" label="Model" autoComplete="off" value={modelName} onChange={setModelName} placeholder="for example qwen3:8b" help="Connect to list the models on that server, or type its name." />
            )}
            <Button variant="secondary" isDisabled={!baseUrl.trim() || isBusy} onPress={() => void connect()}>Connect</Button>
            <Button isDisabled={!baseUrl.trim() || !modelName.trim() || isBusy} onPress={() => void save({ provider: 'custom' })}>Save</Button>
          </div>
        </div>
      )}

      <div>
        <Button variant="ghost" icon="checkmark-circle-02" isBusy={isBusy && !pull} isDisabled={!isReady || !!pull} onPress={() => void test()}>Test the model</Button>
      </div>

      <ConfirmDialog
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && void remove(removing)}
        title={`Remove ${removing ?? 'this model'}?`}
        message="It is deleted from the built-in engine and frees its disk space. You can download it again later."
        confirmLabel="Remove"
        isDestructive
      />
    </div>
  );
};

export default AssistantSettingsPanel;
